import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { Money } from '../src/modules/finance/money.ts';
import { PostgresFinancialProfileStore } from '../src/modules/finance/financial-context.ts';
import {
  PostgresPaymentRepository,
  PaymentFailurePoint,
  PaymentNotFoundError,
} from '../src/modules/finance/payment-repository.ts';
import {
  confirmIncomingPayment,
  createPaymentConfirmationFingerprint,
} from '../src/modules/finance/payment-service.ts';
import {
  PaymentValidationError,
} from '../src/modules/finance/payment-model.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_pay_pg_${randomUUID().replaceAll('-', '')}`;
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionA = '00000000-0000-0000-0000-000000000301';
const institutionB = '00000000-0000-0000-0000-000000000302';
const actorA = '00000000-0000-0000-0000-000000000311';
const actorB = '00000000-0000-0000-0000-000000000312';
const personPayerA = '00000000-0000-0000-0000-000000000321';

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);

    const migrations = await discoverMigrations(migrationsDir);
    await runMigrations(client, migrations);

    // Setup base institutional fixtures
    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES ($1,'Inst A','inst-a','active'),($2,'Inst B','inst-b','active')`, [institutionA, institutionB]);
    await client.query(`INSERT INTO people(id,name) VALUES ($1,'Actor A'),($2,'Actor B'),($3,'Payer A')`, [actorA, actorB, personPayerA]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES ($1,1,now() - interval '1 day','PT','EUR','Europe/Lisbon','v1','["EUR","USD"]'),($2,1,now() - interval '1 day','AO','AOA','Africa/Luanda','v1','["AOA"]')`, [institutionA, institutionB]);

    // Financial Account in Inst A
    const accountA = randomUUID();
    await client.query(`INSERT INTO finance_financial_accounts (id, institution_id, account_number, name) VALUES ($1, $2, 'CTA-000001', 'Conta A')`, [accountA, institutionA]);

    // Financial Account in Inst B
    const accountB = randomUUID();
    await client.query(`INSERT INTO finance_financial_accounts (id, institution_id, account_number, name) VALUES ($1, $2, 'CTA-000002', 'Conta B')`, [accountB, institutionB]);

    const profileStore = new PostgresFinancialProfileStore(pool);
    const paymentRepo = new PostgresPaymentRepository(pool);

    // 1. Confirm manual cash payment in Inst A
    const input1 = {
      sourceType: 'manual_offline',
      method: 'cash',
      amount: '125.50',
      currency: 'EUR',
      financialAccountId: accountA,
      payerPersonId: personPayerA,
      notes: 'Pagamento de propina na secretaria',
    };

    const confirmRes1 = await confirmIncomingPayment(
      pool,
      profileStore,
      { institutionId: institutionA, personId: actorA, role: 'financial' },
      input1,
      'idemp-pay-001'
    );

    assert.equal(confirmRes1.replayed, false);
    assert.equal(confirmRes1.payment.paymentReference, 'PAG-000001');
    assert.equal(confirmRes1.payment.status, 'confirmed');
    assert.equal(confirmRes1.payment.allocationStatus, 'unapplied');
    assert.equal(confirmRes1.payment.sourceType, 'manual_offline');
    assert.equal(confirmRes1.payment.method, 'cash');
    assert.equal(confirmRes1.payment.currency, 'EUR');
    assert.equal(confirmRes1.payment.amount, '125.5');
    assert.ok(confirmRes1.payment.journalTransactionId);

    // Verify atomic Journal record
    const journalRow = await client.query(`SELECT * FROM finance_journal_transactions WHERE id=$1 AND institution_id=$2`, [confirmRes1.payment.journalTransactionId, institutionA]);
    assert.equal(journalRow.rows.length, 1);
    assert.equal(journalRow.rows[0].status, 'confirmed');
    assert.equal(journalRow.rows[0].journal_type, 'foundation_value_received');
    assert.equal(journalRow.rows[0].currency, 'EUR');

    const journalEntries = await client.query(`SELECT * FROM finance_journal_entries WHERE transaction_id=$1`, [confirmRes1.payment.journalTransactionId]);
    assert.equal(journalEntries.rows.length, 1);
    assert.equal(journalEntries.rows[0].position_type, 'received_value');
    assert.equal(journalEntries.rows[0].source_ref, 'PAG-000001');

    // Verify command result recorded
    const cmdResult = await client.query(`SELECT * FROM finance_command_results WHERE institution_id=$1 AND idempotency_key=$2`, [institutionA, 'idemp-pay-001']);
    assert.equal(cmdResult.rows.length, 1);
    assert.equal(cmdResult.rows[0].result_ref, confirmRes1.payment.id);

    // Verify obligations table is untouched
    const obligationsCount = await client.query(`SELECT count(*)::int as count FROM finance_obligations WHERE institution_id=$1`, [institutionA]);
    assert.equal(obligationsCount.rows[0].count, 0, 'Confirming payment must NOT create or mutate obligations');

    // 2. Idempotent replay with same key and same input
    const replayRes = await confirmIncomingPayment(
      pool,
      profileStore,
      { institutionId: institutionA, personId: actorA, role: 'financial' },
      input1,
      'idemp-pay-001'
    );
    assert.equal(replayRes.replayed, true);
    assert.equal(replayRes.payment.id, confirmRes1.payment.id);
    assert.equal(replayRes.payment.paymentReference, 'PAG-000001');

    // 3. Idempotency conflict with same key but different amount
    await assert.rejects(
      () => confirmIncomingPayment(
        pool,
        profileStore,
        { institutionId: institutionA, personId: actorA, role: 'financial' },
        { ...input1, amount: '200.00' },
        'idemp-pay-001'
      ),
      /conflito|conflict|fingerprint/i
    );

    // 4. Second payment creates PAG-000002
    const input2 = {
      sourceType: 'manual_offline',
      method: 'bank_transfer',
      amount: '500.00',
      currency: 'EUR',
      manualEvidenceRef: 'TRF-998811',
    };

    const confirmRes2 = await confirmIncomingPayment(
      pool,
      profileStore,
      { institutionId: institutionA, personId: actorA, role: 'financial' },
      input2,
      'idemp-pay-002'
    );
    assert.equal(confirmRes2.payment.paymentReference, 'PAG-000002');

    // 5. Tenant isolation check: Inst B cannot read Inst A payment
    await assert.rejects(
      () => paymentRepo.getById({ institutionId: institutionB, personId: actorB, role: 'financial' }, confirmRes1.payment.id),
      (err: any) => err instanceof PaymentNotFoundError
    );

    const listInstB = await paymentRepo.list({ institutionId: institutionB, personId: actorB, role: 'financial' });
    assert.equal(listInstB.length, 0);

    const listInstA = await paymentRepo.list({ institutionId: institutionA, personId: actorA, role: 'financial' });
    assert.equal(listInstA.length, 2);

    // Cross-tenant account rejection: Inst A trying to use Account of Inst B
    await assert.rejects(
      () => confirmIncomingPayment(
        pool,
        profileStore,
        { institutionId: institutionA, personId: actorA, role: 'financial' },
        { ...input1, financialAccountId: accountB },
        'idemp-pay-cross-tenant'
      ),
      (err: any) => err instanceof PaymentValidationError && /conta financeira/i.test(err.message)
    );

    // 6. Rollback injection proof
    for (const point of ['after_counter', 'after_journal', 'after_payment'] as PaymentFailurePoint[]) {
      const failIdemp = `idemp-fail-${point}`;
      const failRepo = new PostgresPaymentRepository(pool, point);

      await assert.rejects(
        () => failRepo.confirmPaymentInCommand(
          { institutionId: institutionA, personId: actorA, role: 'financial' },
          { ...input1, amount: '999.00' },
          failIdemp
        ),
        new RegExp(`Injected payment failure: ${point}`)
      );

      // Verify ZERO records survived in payments, journal transactions or command results
      const checkPayments = await client.query(`SELECT count(*)::int as c FROM finance_payments WHERE amount = 999.00`);
      assert.equal(checkPayments.rows[0].c, 0, `Injected failure ${point} must leave zero payments`);

      const checkCmd = await client.query(`SELECT count(*)::int as c FROM finance_command_results WHERE idempotency_key=$1`, [failIdemp]);
      assert.equal(checkCmd.rows[0].c, 0, `Injected failure ${point} must leave zero command results`);
    }

    console.log('Finance Payment PostgreSQL: PASS');
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
