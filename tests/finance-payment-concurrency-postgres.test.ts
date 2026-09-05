import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresFinancialProfileStore } from '../src/modules/finance/financial-context.ts';
import { confirmIncomingPayment } from '../src/modules/finance/payment-service.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_pay_conc_${randomUUID().replaceAll('-', '')}`;
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionA = '00000000-0000-0000-0000-000000000401';
const actorA = '00000000-0000-0000-0000-000000000411';

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);

    const migrations = await discoverMigrations(migrationsDir);
    await runMigrations(client, migrations);

    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES ($1,'Inst A','inst-a','active')`, [institutionA]);
    await client.query(`INSERT INTO people(id,name) VALUES ($1,'Actor A')`, [actorA]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES ($1,1,now() - interval '1 day','PT','EUR','Europe/Lisbon','v1','["EUR"]')`, [institutionA]);

    const profileStore = new PostgresFinancialProfileStore(pool);
    const actor = { institutionId: institutionA, personId: actorA, role: 'financial' as const };

    // 1. Concurrency Test: 20 simultaneous duplicate confirmations with same idempotency key
    const inputDuplicate = {
      sourceType: 'manual_offline',
      method: 'cash',
      amount: '75.00',
      currency: 'EUR',
      notes: 'Concurrent test payment',
    };
    const idempKey = 'idemp-concurrent-20x';

    const promises = Array.from({ length: 20 }, () =>
      confirmIncomingPayment(pool, profileStore, actor, inputDuplicate, idempKey)
    );

    const results = await Promise.all(promises);

    // All results must return the EXACT SAME payment ID and payment reference
    const firstPaymentId = results[0].payment.id;
    const firstPaymentRef = results[0].payment.paymentReference;

    for (const res of results) {
      assert.equal(res.payment.id, firstPaymentId);
      assert.equal(res.payment.paymentReference, firstPaymentRef);
    }

    // Exactly 1 payment in DB
    const countPayments = await client.query(`SELECT count(*)::int as c FROM finance_payments WHERE institution_id=$1`, [institutionA]);
    assert.equal(countPayments.rows[0].c, 1, 'Exactly ONE payment must exist after 20 concurrent requests');

    // Exactly 1 journal transaction in DB
    const countJournal = await client.query(`SELECT count(*)::int as c FROM finance_journal_transactions WHERE institution_id=$1`, [institutionA]);
    assert.equal(countJournal.rows[0].c, 1, 'Exactly ONE journal transaction must exist after 20 concurrent requests');

    // Exactly 1 command result
    const countCmd = await client.query(`SELECT count(*)::int as c FROM finance_command_results WHERE institution_id=$1 AND idempotency_key=$2`, [institutionA, idempKey]);
    assert.equal(countCmd.rows[0].c, 1, 'Exactly ONE command result must exist');

    // 2. Concurrency Test: 2 distinct valid payments with same amount but different idempotency keys
    const [p1, p2] = await Promise.all([
      confirmIncomingPayment(pool, profileStore, actor, { ...inputDuplicate, notes: 'Payment 1' }, 'idemp-dist-1'),
      confirmIncomingPayment(pool, profileStore, actor, { ...inputDuplicate, notes: 'Payment 2' }, 'idemp-dist-2'),
    ]);

    assert.notEqual(p1.payment.id, p2.payment.id);
    assert.notEqual(p1.payment.paymentReference, p2.payment.paymentReference);

    const countFinalPayments = await client.query(`SELECT count(*)::int as c FROM finance_payments WHERE institution_id=$1`, [institutionA]);
    assert.equal(countFinalPayments.rows[0].c, 3);

    console.log('Finance Payment Concurrency 20x PostgreSQL: PASS');
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
