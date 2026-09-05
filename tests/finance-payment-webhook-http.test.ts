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
import { PostgresPaymentProviderRepository } from '../src/modules/finance/payment-provider-repository.ts';
import { calculateAdyenHmac } from '../src/modules/finance/providers/adyen-adapter.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_wh_http_${randomUUID().replaceAll('-', '')}`;
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionA = '00000000-0000-0000-0000-000000000901';
const institutionB = '00000000-0000-0000-0000-000000000902';
const actorAdminA = '00000000-0000-0000-0000-000000000911';
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

const app = express();
app.use(express.json());
registerPaymentWebhookRoutes(app, pool);
registerPaymentProviderRoutes(app, pool, testAuth);

let server: http.Server | undefined;
const mockHmacKeyHex = '44782F3DEBEA52232C80CA829978C2E75CBE1441F10F0945B97F36E493D6BDD2';
process.env.ADYEN_HMAC_KEY = mockHmacKeyHex;

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);

    const migrations = await discoverMigrations(migrationsDir);
    await runMigrations(client, migrations);

    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES ($1,'Inst A','inst-a','active'),($2,'Inst B','inst-b','active')`, [institutionA, institutionB]);
    await client.query(`INSERT INTO people(id,name) VALUES ($1,'Admin A'),($2,'Teacher A'),($3,'System')`, [actorAdminA, actorTeacherA, actorSystem]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES ($1,1,now() - interval '1 day','PT','EUR','Europe/Lisbon','v1','["EUR","USD"]'),($2,1,now() - interval '1 day','AO','AOA','Africa/Luanda','v1','["AOA"]')`, [institutionA, institutionB]);

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

    // 1. Provider Admin: Save Adyen Config
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

    // Verify 1 payment persisted in database for Inst A
    const countPayments = await client.query(`SELECT count(*)::int as c FROM finance_payments WHERE institution_id=$1 AND provider_event_id=$2`, [institutionA, 'ADYEN-PSP-WH-001']);
    assert.equal(countPayments.rows[0].c, 1);

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
    // Signature failure returns 401 or safe rejection without creating payment
    const checkBadPayment = await client.query(`SELECT count(*)::int as c FROM finance_payments WHERE provider_event_id=$1`, ['ADYEN-PSP-BAD']);
    assert.equal(checkBadPayment.rows[0].c, 0, 'Invalid webhook signature must leave zero economic effect');

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
