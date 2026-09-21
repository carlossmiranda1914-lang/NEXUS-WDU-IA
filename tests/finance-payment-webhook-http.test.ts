import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { registerPaymentWebhookRoutes } from '../src/modules/finance/payment-webhook-http.ts';
import { registerPaymentProviderRoutes } from '../src/modules/finance/payment-provider-http.ts';
import { calculateAdyenHmac } from '../src/modules/finance/providers/adyen-adapter.ts';
import { DefaultSecretResolver } from '../src/modules/finance/secret-resolver.ts';
import { Money } from '../src/modules/finance/money.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_wh_http_${randomUUID().replaceAll('-', '')}`;
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionA = '00000000-0000-0000-0000-000000000901';
const institutionB = '00000000-0000-0000-0000-000000000902';
const institutionNoProfile = '00000000-0000-0000-0000-000000000903';
const actorAdminA = '00000000-0000-0000-0000-000000000911';
const actorAdminB = '00000000-0000-0000-0000-000000000914';
const actorTeacherA = '00000000-0000-0000-0000-000000000912';
const actorSystem = '00000000-0000-0000-0000-000000000913';

const tokenMap: Record<string, any> = {
  'token-admin-a': {
    institutionId: institutionA,
    personId: actorAdminA,
    personName: 'Admin A',
    identityEmail: 'admin.a@test.local',
    membershipId: randomUUID(),
    institutionName: 'Inst A',
    institutionSlug: 'inst-a',
    role: 'institution_admin',
  },
  'token-admin-b': {
    institutionId: institutionB,
    personId: actorAdminB,
    personName: 'Admin B',
    identityEmail: 'admin.b@test.local',
    membershipId: randomUUID(),
    institutionName: 'Inst B',
    institutionSlug: 'inst-b',
    role: 'institution_admin',
  },
  'token-teacher-a': {
    institutionId: institutionA,
    personId: actorTeacherA,
    personName: 'Teacher A',
    identityEmail: 'teach.a@test.local',
    membershipId: randomUUID(),
    institutionName: 'Inst A',
    institutionSlug: 'inst-a',
    role: 'teacher',
  },
};

const testAuth: any = (req: any, _res: any, next: any) => {
  const header = req.header('Authorization');
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    if (tokenMap[token]) {
      req.institutionalContext = tokenMap[token];
    }
  }
  next();
};

const mockHmacKeyHex = '44782F3DEBEA52232C80CA829978C2E75CBE1441F10F0945B97F36E493D6BDD2';
const mockHmacKeyHexB = 'B4782F3DEBEA52232C80CA829978C2E75CBE1441F10F0945B97F36E493D6BDDB';
const secretResolver = new DefaultSecretResolver();
secretResolver.registerSecret('vault://secrets/adyen', mockHmacKeyHex);
secretResolver.registerSecret('vault://secrets/adyen-b', mockHmacKeyHexB);

const app = express();
app.use(express.json());
registerPaymentWebhookRoutes(app, pool, secretResolver);
registerPaymentProviderRoutes(app, pool, testAuth);

let server: http.Server | undefined;

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);

    const migrations = await discoverMigrations(migrationsDir);
    await runMigrations(client, migrations);

    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES ($1,'Inst A','inst-a','active'),($2,'Inst B','inst-b','active'),($3,'Inst No Profile','inst-no-prof','active')`, [institutionA, institutionB, institutionNoProfile]);
    await client.query(`INSERT INTO people(id,name) VALUES ($1,'Admin A'),($2,'Teacher A'),($3,'System'),($4,'Admin B')`, [actorAdminA, actorTeacherA, actorSystem, actorAdminB]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES ($1,1,'2026-09-01T00:00:00Z','PT','EUR','Europe/Lisbon','v1','["EUR","USD"]'),($2,1,'2026-09-01T00:00:00Z','AO','AOA','Africa/Luanda','v1','["AOA"]')`, [institutionA, institutionB]);

    server = http.createServer(app);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const makeRequest = async (token: string | null, route: string, options: any = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${baseUrl}${route}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    };

    // 1. Provider Admin: Save Adyen Config for Inst A
    const resSaveAdyen = await makeRequest('token-admin-a', '/api/finance/providers/configs/adyen', {
      method: 'PUT',
      body: {
        environment: 'test',
        status: 'active',
        merchantAccountRef: 'TestMerchantPT',
        supportedCurrencies: ['EUR'],
        enabledMethods: ['card', 'mbway'],
        operationalAvailability: 'available',
        secretReferenceId: 'vault://secrets/adyen',
      },
    });
    assert.equal(resSaveAdyen.status, 200);
    assert.equal(resSaveAdyen.body.providerKey, 'adyen');
    assert.equal(resSaveAdyen.body.status, 'active');
    assert.equal(resSaveAdyen.body.secretReferenceId, undefined, 'Secrets must never be returned in API response');

    // Save Adyen Config for Inst B
    const resSaveAdyenB = await makeRequest('token-admin-b', '/api/finance/providers/configs/adyen', {
      method: 'PUT',
      body: {
        environment: 'test',
        status: 'active',
        merchantAccountRef: 'TestMerchantAO',
        supportedCurrencies: ['AOA'],
        enabledMethods: ['card'],
        operationalAvailability: 'available',
        secretReferenceId: 'vault://secrets/adyen-b',
      },
    });
    assert.equal(resSaveAdyenB.status, 200);

    // 2. Provider Admin: Teacher Forbidden
    const resTeacher = await makeRequest('token-teacher-a', '/api/finance/providers/configs/adyen', {
      method: 'PUT',
      body: { status: 'inactive' },
    });
    assert.equal(resTeacher.status, 403);

    // 3. Webhook Ingress: Adyen verified webhook ingestion
    const adyenPayload = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: { hmacSignature: '' },
            amount: { currency: 'EUR', value: 9900 },
            eventCode: 'AUTHORISATION',
            eventDate: '2026-09-05T12:00:00+00:00',
            merchantAccountCode: 'TestMerchantPT',
            merchantReference: 'REF-WH-001',
            paymentMethod: 'visa',
            pspReference: 'ADYEN-PSP-WH-001',
            success: 'true',
          },
        },
      ],
    };

    const item = adyenPayload.notificationItems[0].NotificationRequestItem;
    item.additionalData.hmacSignature = calculateAdyenHmac(
      {
        pspReference: item.pspReference,
        originalReference: '',
        merchantAccountCode: item.merchantAccountCode,
        merchantReference: item.merchantReference,
        value: String(item.amount.value),
        currency: item.amount.currency,
        eventCode: item.eventCode,
        success: item.success,
      },
      mockHmacKeyHex
    );

    const resWh = await makeRequest(null, `/api/finance/webhooks/adyen/${institutionA}`, {
      method: 'POST',
      body: adyenPayload,
    });
    assert.equal(resWh.status, 200);
    assert.equal(resWh.body.notificationResponse, '[accepted]');

    // Verify 1 payment persisted in database for Inst A with actor_kind='provider'
    const paymentRow = await client.query(`SELECT * FROM finance_payments WHERE institution_id=$1 AND provider_event_id=$2`, [institutionA, 'ADYEN-PSP-WH-001']);
    assert.equal(paymentRow.rows.length, 1);
    assert.equal(paymentRow.rows[0].actor_kind, 'provider');
    assert.equal(paymentRow.rows[0].actor_person_id, null);
    assert.equal(paymentRow.rows[0].amount, '99.000000000000');

    // 4. Webhook Ingress: Invalid signature rejected with zero economic effect
    const badSigPayload = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: { hmacSignature: 'bad-sig' },
            amount: { currency: 'EUR', value: 5000 },
            eventCode: 'AUTHORISATION',
            eventDate: '2026-09-05T12:00:00+00:00',
            merchantAccountCode: 'TestMerchantPT',
            merchantReference: 'REF-BAD',
            paymentMethod: 'visa',
            pspReference: 'ADYEN-PSP-BAD',
            success: 'true',
          },
        },
      ],
    };

    const resBadWh = await makeRequest(null, `/api/finance/webhooks/adyen/${institutionA}`, {
      method: 'POST',
      body: badSigPayload,
    });
    assert.equal(resBadWh.status, 401);
    const checkBadPayment = await client.query(`SELECT count(*)::int as c FROM finance_payments WHERE provider_event_id=$1`, ['ADYEN-PSP-BAD']);
    assert.equal(checkBadPayment.rows[0].c, 0, 'Invalid webhook signature must leave zero economic effect');

    // 5. Tenant Isolation / Cross-tenant Replay Negative Test:
    // Sending valid Inst A payload to Inst B webhook URL must fail authentication (secret mismatch) or tenant binding (merchant mismatch)
    const resCrossTenant = await makeRequest(null, `/api/finance/webhooks/adyen/${institutionB}`, {
      method: 'POST',
      body: adyenPayload,
    });
    assert.equal(resCrossTenant.status, 401, 'Cross-tenant webhook replay must fail auth or tenant check');
    const countPaymentsB = await client.query(`SELECT count(*)::int as c FROM finance_payments WHERE institution_id=$1`, [institutionB]);
    assert.equal(countPaymentsB.rows[0].c, 0, 'Inst B must have zero payments');

    // 6. Currency not enabled in financial profile: fail closed (400)
    const unenabledCurrPayload = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: { hmacSignature: '' },
            amount: { currency: 'JPY', value: 5000 },
            eventCode: 'AUTHORISATION',
            eventDate: '2026-09-05T12:00:00+00:00',
            merchantAccountCode: 'TestMerchantPT',
            merchantReference: 'REF-JPY-001',
            paymentMethod: 'visa',
            pspReference: 'ADYEN-PSP-JPY',
            success: 'true',
          },
        },
      ],
    };
    const jpyItem = unenabledCurrPayload.notificationItems[0].NotificationRequestItem;
    jpyItem.additionalData.hmacSignature = calculateAdyenHmac(
      {
        pspReference: jpyItem.pspReference,
        originalReference: '',
        merchantAccountCode: jpyItem.merchantAccountCode,
        merchantReference: jpyItem.merchantReference,
        value: String(jpyItem.amount.value),
        currency: jpyItem.amount.currency,
        eventCode: jpyItem.eventCode,
        success: jpyItem.success,
      },
      mockHmacKeyHex
    );
    const resJpy = await makeRequest(null, `/api/finance/webhooks/adyen/${institutionA}`, {
      method: 'POST',
      body: unenabledCurrPayload,
    });
    assert.equal(resJpy.status, 400);

    // 7. Missing active financial profile: fail closed (422)
    // Setup Adyen config for institutionNoProfile
    await client.query(`
      INSERT INTO finance_payment_provider_configs (
        id, institution_id, provider_key, environment, status, merchant_account_ref,
        supported_currencies, enabled_methods, operational_availability, secret_reference_id
      ) VALUES (
        $1, $2, 'adyen', 'test', 'active', 'TestMerchantNoProf',
        '["EUR"]'::jsonb, '["card"]'::jsonb, 'available', 'vault://secrets/adyen'
      )
    `, [randomUUID(), institutionNoProfile]);

    const noProfPayload = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: { hmacSignature: '' },
            amount: { currency: 'EUR', value: 2000 },
            eventCode: 'AUTHORISATION',
            eventDate: '2026-09-05T12:00:00+00:00',
            merchantAccountCode: 'TestMerchantNoProf',
            merchantReference: 'REF-NOPROF',
            paymentMethod: 'visa',
            pspReference: 'ADYEN-PSP-NOPROF',
            success: 'true',
          },
        },
      ],
    };
    const noProfItem = noProfPayload.notificationItems[0].NotificationRequestItem;
    noProfItem.additionalData.hmacSignature = calculateAdyenHmac(
      {
        pspReference: noProfItem.pspReference,
        originalReference: '',
        merchantAccountCode: noProfItem.merchantAccountCode,
        merchantReference: noProfItem.merchantReference,
        value: String(noProfItem.amount.value),
        currency: noProfItem.amount.currency,
        eventCode: noProfItem.eventCode,
        success: noProfItem.success,
      },
      mockHmacKeyHex
    );

    const resNoProf = await makeRequest(null, `/api/finance/webhooks/adyen/${institutionNoProfile}`, {
      method: 'POST',
      body: noProfPayload,
    });
    assert.equal(resNoProf.status, 422);

    console.log('Finance Payment Webhook Ingress & Provider Admin HTTP: PASS');
  } finally {
    if (server) {
      server.close();
    }
    client.release();
  }
} finally {
  const c = await pool.connect().catch(() => undefined);
  if (c) {
    try {
      await c.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
    } finally {
      c.release();
    }
  }
  await pool.end();
}
