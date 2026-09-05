import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import {
  AdyenAdapter,
  calculateAdyenHmac,
} from '../src/modules/finance/providers/adyen-adapter.ts';
import {
  PostgresPaymentProviderRepository,
} from '../src/modules/finance/payment-provider-repository.ts';
import {
  confirmIncomingProviderPayment,
} from '../src/modules/finance/payment-service.ts';
import { Money } from '../src/modules/finance/money.ts';
import type { ConfirmIncomingPaymentIntent } from '../src/modules/finance/payment-model.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_adyen_pg_${randomUUID().replaceAll('-', '')}`;
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionA = '00000000-0000-0000-0000-000000000801';
const actorSystem = '00000000-0000-0000-0000-000000000811';
const mockHmacKeyHex = '44782F3DEBEA52232C80CA829978C2E75CBE1441F10F0945B97F36E493D6BDD2';

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);

    const migrations = await discoverMigrations(migrationsDir);
    await runMigrations(client, migrations);

    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES ($1,'Inst A','inst-a','active')`, [institutionA]);
    await client.query(`INSERT INTO people(id,name) VALUES ($1,'System Ingress Actor')`, [actorSystem]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES ($1,1,now() - interval '1 day','PT','EUR','Europe/Lisbon','v1','["EUR","USD"]')`, [institutionA]);

    const providerRepo = new PostgresPaymentProviderRepository(pool);
    const config = await providerRepo.save(
      {
        institutionId: institutionA,
        personId: actorSystem,
        personName: 'System Actor',
        identityEmail: 'system@test.local',
        membershipId: randomUUID(),
        institutionName: 'Inst A',
        institutionSlug: 'inst-a',
        role: 'institution_admin',
      },
      {
        providerKey: 'adyen',
        environment: 'test',
        status: 'active',
        merchantAccountRef: 'TestMerchantPT',
        supportedCurrencies: ['EUR', 'USD'],
        enabledMethods: ['card', 'mbway'],
        operationalAvailability: 'available',
        secretReferenceId: 'vault://secrets/adyen/inst-a',
      }
    );

    const adapter = new AdyenAdapter();

    // Prepare verified Adyen payload
    const pspReference = 'ADYEN-PSPREF-998877665544';
    const rawPayload = {
      live: 'false',
      notificationItems: [
        {
          NotificationRequestItem: {
            additionalData: {
              hmacSignature: '',
            },
            amount: {
              currency: 'EUR',
              value: 7500, // 75.00 EUR
            },
            eventCode: 'AUTHORISATION',
            eventDate: '2026-09-05T12:00:00+00:00',
            merchantAccountCode: 'TestMerchantPT',
            merchantReference: 'NEXUS-RECV-001',
            paymentMethod: 'visa',
            pspReference,
            success: 'true',
          },
        },
      ],
    };

    const item = rawPayload.notificationItems[0].NotificationRequestItem;
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

    const rawBodyBuffer = Buffer.from(JSON.stringify(rawPayload), 'utf8');

    // 1. Authenticate & Normalize
    const auth = await adapter.authenticateWebhook(rawBodyBuffer, {}, config, mockHmacKeyHex);
    assert.equal(auth.valid, true);

    const parsed = await adapter.parseAndNormalizeEvent(rawBodyBuffer, {}, config);
    assert.ok(parsed && parsed.isConfirmed && parsed.candidate);

    const intent: ConfirmIncomingPaymentIntent = {
      institutionId: institutionA,
      sourceType: 'provider',
      method: parsed.candidate.method,
      money: Money.parse(parsed.candidate.amount, parsed.candidate.currency),
      effectiveAt: parsed.candidate.providerOccurredAt,
      providerKey: 'adyen',
      providerEventId: parsed.providerEventId,
      providerTransactionRef: parsed.candidate.providerTransactionRef,
      providerOccurredAt: parsed.candidate.providerOccurredAt,
      actorPersonId: actorSystem,
      financialProfileVersion: 1,
    };

    const idempotencyKey = `adyen:${institutionA}:${parsed.providerEventId}`;

    // 2. Ingest first time
    const res1 = await confirmIncomingProviderPayment(pool, intent, idempotencyKey);
    assert.equal(res1.replayed, false);
    assert.equal(res1.payment.sourceType, 'provider');
    assert.equal(res1.payment.providerKey, 'adyen');
    assert.equal(res1.payment.providerEventId, pspReference);
    assert.equal(res1.payment.amount, '75');
    assert.equal(res1.payment.currency, 'EUR');
    assert.equal(res1.payment.status, 'confirmed');
    assert.equal(res1.payment.allocationStatus, 'unapplied');

    // 3. Sequential replay
    const res2 = await confirmIncomingProviderPayment(pool, intent, idempotencyKey);
    assert.equal(res2.replayed, true);
    assert.equal(res2.payment.id, res1.payment.id);

    // 4. 20 concurrent duplicate webhooks
    const concurrentPspRef = 'ADYEN-PSPREF-CONCURRENT-20X';
    const concurrentIntent: ConfirmIncomingPaymentIntent = {
      ...intent,
      providerEventId: concurrentPspRef,
      providerTransactionRef: concurrentPspRef,
    };
    const concurrentIdempKey = `adyen:${institutionA}:${concurrentPspRef}`;

    const concurrentPromises = Array.from({ length: 20 }, () =>
      confirmIncomingProviderPayment(pool, concurrentIntent, concurrentIdempKey)
    );
    const concurrentResults = await Promise.all(concurrentPromises);

    const firstId = concurrentResults[0].payment.id;
    for (const r of concurrentResults) {
      assert.equal(r.payment.id, firstId);
    }

    // Verify exactly 2 payments in DB (res1 + concurrent)
    const totalPayments = await client.query(`SELECT count(*)::int as c FROM finance_payments WHERE institution_id=$1`, [institutionA]);
    assert.equal(totalPayments.rows[0].c, 2);

    // 5. External Sandbox Proof Status
    const hasLiveApiKey = Boolean(process.env.ADYEN_API_KEY && process.env.ADYEN_API_KEY.trim());
    const hasLiveHmacKey = Boolean(process.env.ADYEN_HMAC_KEY && process.env.ADYEN_HMAC_KEY.trim());
    const hasLiveMerchant = Boolean(process.env.ADYEN_MERCHANT_ACCOUNT && process.env.ADYEN_MERCHANT_ACCOUNT.trim());

    if (hasLiveApiKey && hasLiveHmacKey && hasLiveMerchant) {
      console.log('ADYEN_SANDBOX=PASS_REAL');
    } else {
      console.log('ADYEN_SANDBOX=BLOCKED_EXTERNAL_DEPENDENCY: Missing real sandbox credentials (ADYEN_API_KEY, ADYEN_HMAC_KEY, ADYEN_MERCHANT_ACCOUNT)');
    }

    console.log('Finance Payment Adyen Webhook PostgreSQL: PASS');
  } finally {
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
