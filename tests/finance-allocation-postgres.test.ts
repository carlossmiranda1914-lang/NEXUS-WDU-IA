import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresAllocationRepository } from '../src/modules/finance/allocation-repository.ts';
import { AllocationCommandValidationError, createConfirmAllocationFingerprint, normalizeConfirmAllocationCommand } from '../src/modules/finance/allocation-service.ts';
import { Money } from '../src/modules/finance/money.ts';
import { PostgresObligationAdjustmentRepository } from '../src/modules/finance/obligation-adjustment-repository.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const schema = `finance_allocation_command_${randomUUID().replaceAll('-', '')}`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const institutionId = randomUUID(); const personId = randomUUID(); const accountId = randomUUID();
const actor = { personId, personName: 'Allocation test actor', identityEmail: null, membershipId: randomUUID(), institutionId, institutionName: 'Allocation test institution', institutionSlug: 'allocation-command', role: 'financial' as const };
const effectiveAt = '2026-09-06T10:00:00.000Z';
let feeItemId = '';
const repository = new PostgresAllocationRepository(pool);

async function payment(amount: string, status = 'confirmed') {
  const id = randomUUID(); const journalId = randomUUID();
  await pool.query(`INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',$3,$4,'foundation_value_received',$5,1,now())`, [journalId, institutionId, amount, `payment-${id}`, personId]);
  await pool.query(`INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,source_type,method,amount,currency,status,allocation_status,financial_account_id,payer_person_id,effective_at,financial_profile_version,actor_person_id) VALUES($1,$2,$3,$4,'manual_offline','cash',$5,'EUR',$6,'unapplied',$7,$8,$9,1,$8)`, [id, institutionId, `PAY-${id.slice(0, 8)}`, journalId, amount, status, accountId, personId, effectiveAt]);
  return id;
}
async function obligation(amount: string) {
  const id = randomUUID();
  await pool.query(`INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,status,financial_profile_version,created_by_person_id,idempotency_key) VALUES($1,$2,$3,$4,1,'manual_finance',$5,$6,'EUR','open',1,$7,$8)`, [id, institutionId, accountId, feeItemId, `allocation-${id}`, amount, personId, `obligation-${id}`]);
  return id;
}
const confirm = (paymentId: string, lines: Array<{ obligationId: string; amount: string }>, key: string, repo = repository) => repo.confirmAllocationInCommand(actor, { paymentId, effectiveAt, lines: lines.map(line => ({ ...line, currency: 'EUR' })) }, key);

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES($1,'Allocation test institution','allocation-command','active')`, [institutionId]);
    await client.query(`INSERT INTO people(id,name) VALUES($1,'Allocation test actor')`, [personId]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR"]')`, [institutionId]);
    await client.query(`INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'CTA-CMD','Allocation command account')`, [accountId, institutionId]);
    const feeTypeId = randomUUID(); feeItemId = randomUUID();
    await client.query(`INSERT INTO finance_fee_types(id,institution_id,source,display_name,code_prefix) VALUES($1,$2,'institution_custom','Allocation test fee','ALLOC')`, [feeTypeId, institutionId]);
    await client.query(`INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'ALLOC-000001',1,$4)`, [feeItemId, institutionId, feeTypeId, personId]);
    await client.query(`INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'Allocation test fee','fee',100,'EUR',now(),$4)`, [institutionId, feeItemId, feeTypeId, personId]);
  } finally { client.release(); }

  const raw = { paymentId: randomUUID(), effectiveAt, lines: [{ obligationId: randomUUID(), amount: '20.00', currency: 'EUR' }] };
  assert.throws(() => normalizeConfirmAllocationCommand({ ...raw, lines: [{ ...raw.lines[0], amount: 20 }] }), AllocationCommandValidationError);
  assert.throws(() => normalizeConfirmAllocationCommand({ ...raw, lines: [{ ...raw.lines[0], amount: 0.1 }] }), AllocationCommandValidationError);
  assert.equal(normalizeConfirmAllocationCommand(raw).lines[0]!.amount.canonicalAmount(), '20');
  assert.equal(createConfirmAllocationFingerprint(institutionId, normalizeConfirmAllocationCommand(raw)).length, 64);

  const paymentId = await payment('150.00'); const obligationA = await obligation('100.00'); const obligationB = await obligation('30.00');
  const first = await confirm(paymentId, [{ obligationId: obligationA, amount: '100.00' }, { obligationId: obligationB, amount: '20.00' }], 'allocation-main');
  assert.equal(first.allocations.length, 2);
  const position = await repository.getPaymentPosition(actor, paymentId); assert.equal(position.allocated.canonicalAmount(), '120'); assert.equal(position.unapplied.canonicalAmount(), '30');
  const posA = await repository.getObligationPosition(actor, obligationA); const posB = await repository.getObligationPosition(actor, obligationB);
  assert.equal(posA.covered.canonicalAmount(), '100'); assert.equal(posA.uncovered.canonicalAmount(), '0'); assert.equal(posB.covered.canonicalAmount(), '20'); assert.equal(posB.uncovered.canonicalAmount(), '10');
  const originals = await pool.query<{ payment: string; a: string; b: string }>(`SELECT (SELECT amount::text FROM finance_payments WHERE id=$1) payment,(SELECT amount::text FROM finance_obligations WHERE id=$2) a,(SELECT amount::text FROM finance_obligations WHERE id=$3) b`, [paymentId, obligationA, obligationB]);
  assert.equal(Money.parse(originals.rows[0]!.payment, 'EUR').canonicalAmount(), '150'); assert.equal(Money.parse(originals.rows[0]!.a, 'EUR').canonicalAmount(), '100'); assert.equal(Money.parse(originals.rows[0]!.b, 'EUR').canonicalAmount(), '30');
  assert.equal((await pool.query(`SELECT count(*)::int AS count FROM finance_journal_transactions WHERE institution_id=$1 AND journal_type='payment_allocation'`, [institutionId])).rows[0].count, 1);
  assert.equal((await pool.query(`SELECT count(*)::int AS count FROM finance_allocations WHERE institution_id=$1 AND payment_id=$2`, [institutionId, paymentId])).rows[0].count, 2);
  const replay = await confirm(paymentId, [{ obligationId: obligationA, amount: '100.00' }, { obligationId: obligationB, amount: '20.00' }], 'allocation-main'); assert.equal(replay.replayed, true); assert.equal(replay.allocations.length, 2);
  await assert.rejects(() => confirm(paymentId, [{ obligationId: obligationB, amount: '10.00' }], 'allocation-main'), /fingerprint conflict/i);
  assert.equal((await pool.query(`SELECT count(*)::int AS count FROM finance_allocations WHERE institution_id=$1 AND payment_id=$2`, [institutionId, paymentId])).rows[0].count, 2);

  const rollbackPayment = await payment('50'); const rollbackObligation = await obligation('50'); const failing = new PostgresAllocationRepository(pool, 'after_journal');
  await assert.rejects(() => confirm(rollbackPayment, [{ obligationId: rollbackObligation, amount: '50' }], 'allocation-rollback', failing), /Injected allocation failure/);
  assert.equal((await pool.query(`SELECT count(*)::int AS count FROM finance_allocations WHERE institution_id=$1 AND payment_id=$2`, [institutionId, rollbackPayment])).rows[0].count, 0);
  assert.equal((await pool.query(`SELECT count(*)::int AS count FROM finance_journal_transactions WHERE institution_id=$1 AND command_id='allocation-rollback'`, [institutionId])).rows[0].count, 0);
  const adjustmentPayment=await payment('100'); const adjustmentObligation=await obligation('100'); const adjustments=new PostgresObligationAdjustmentRepository(pool);
  await adjustments.recordAdjustment(actor,{obligationId:adjustmentObligation,direction:'decrease',amount:'20',currency:'EUR',reason:'Authoritative correction'},'adjustment-allocation');
  await confirm(adjustmentPayment,[{obligationId:adjustmentObligation,amount:'40'}],'adjustment-allocation-40');
  await assert.rejects(()=>confirm(adjustmentPayment,[{obligationId:adjustmentObligation,amount:'41'}],'adjustment-allocation-41'),/remaining coverable/i);
  assert.equal((await pool.query(`SELECT to_regclass('finance_reconciliations') IS NULL AS absent`)).rows[0].absent, true, 'Allocation introduces no Reconciliation side effect authority');
  console.log('TASK3_STATEFUL_POSTGRES=PASS PARTIAL_ALLOCATION=PASS MULTI_OBLIGATION_ALLOCATION=PASS PAYMENT_ORIGINAL_MONEY_IMMUTABLE=PASS OBLIGATION_ORIGINAL_MONEY_IMMUTABLE=PASS ALLOCATION_JOURNAL_ATOMICITY=PASS ROLLBACK_INJECTION=PASS IDEMPOTENCY_REPLAY=PASS IDEMPOTENCY_CONFLICT=PASS');
} finally {
  const client = await pool.connect().catch(() => undefined);
  if (client) { try { await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); } finally { client.release(); } }
  await pool.end();
}
