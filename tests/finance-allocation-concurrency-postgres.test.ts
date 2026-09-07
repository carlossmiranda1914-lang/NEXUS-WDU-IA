import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresAllocationRepository } from '../src/modules/finance/allocation-repository.ts';
import { Money } from '../src/modules/finance/money.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

// This gate is deliberately first: these are stateful PostgreSQL races, never a local-memory proof.
await verifyApprovedTestConnection();

const schema = `finance_allocation_race_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const institutionId = randomUUID();
const personId = randomUUID();
const accountId = randomUUID();
const actor = { personId, personName: 'Concurrency actor', identityEmail: null, membershipId: randomUUID(), institutionId, institutionName: 'Concurrency institution', institutionSlug: 'allocation-race', role: 'financial' as const };
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const repository = new PostgresAllocationRepository(pool);
const effectiveAt = '2026-09-06T10:00:00.000Z';

async function seedPayment(amount: string) {
  const id = randomUUID(); const journalId = randomUUID();
  await pool.query(`INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',$3,$4,'foundation_value_received',$5,1,now())`, [journalId, institutionId, amount, `payment-${id}`, personId]);
  await pool.query(`INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,source_type,method,amount,currency,status,allocation_status,financial_account_id,payer_person_id,effective_at,financial_profile_version,actor_person_id) VALUES($1,$2,$3,$4,'manual_offline','cash',$5,'EUR','confirmed','unapplied',$6,$7,now(),1,$7)`, [id, institutionId, `PAY-${id.replaceAll('-', '').slice(0, 28)}`, journalId, amount, accountId, personId]);
  return id;
}

async function seedObligation(amount: string) {
  const id = randomUUID();
  await pool.query(`INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,status,financial_profile_version,created_by_person_id,idempotency_key) VALUES($1,$2,$3,$4,1,'manual_finance',$5,$6,'EUR','open',1,$7,$8)`, [id, institutionId, accountId, feeItemId, `race-${id}`, amount, personId, `obligation-${id}`]);
  return id;
}

let feeItemId = '';
async function confirm(paymentId: string, obligationId: string, amount: string, key: string = randomUUID()) {
  return repository.confirmAllocationInCommand(actor, { paymentId, effectiveAt, lines: [{ obligationId, amount, currency: 'EUR' }] }, key);
}
async function netFor(sql: string, id: string) {
  const result = await pool.query<{ value: string }>(sql, [institutionId, id]);
  return Money.parse(result.rows[0]!.value, 'EUR');
}

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await runMigrations(client, await discoverMigrations(migrations));
    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES($1,'Concurrency institution','allocation-race','active')`, [institutionId]);
    await client.query(`INSERT INTO people(id,name) VALUES($1,'Concurrency actor')`, [personId]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR"]')`, [institutionId]);
    await client.query(`INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'CTA-RACE','Concurrency account')`, [accountId, institutionId]);
    const feeTypeId = randomUUID(); feeItemId = randomUUID();
    await client.query(`INSERT INTO finance_fee_types(id,institution_id,source,display_name,code_prefix) VALUES($1,$2,'institution_custom','Concurrency fee','RACE')`, [feeTypeId, institutionId]);
    await client.query(`INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'RACE-000001',1,$4)`, [feeItemId, institutionId, feeTypeId, personId]);
    await client.query(`INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'Concurrency fee','fee',100,'EUR',now(),$4)`, [institutionId, feeItemId, feeTypeId, personId]);
  } finally { client.release(); }

  // A: one locked Payment permits at most its 100 EUR net allocation.
  const paymentA = await seedPayment('100'); const obligationA = await seedObligation('100');
  const paymentRace = await Promise.allSettled([confirm(paymentA, obligationA, '80', 'payment-a'), confirm(paymentA, obligationA, '80', 'payment-b')]);
  assert.equal(paymentRace.filter((result) => result.status === 'fulfilled').length, 1);
  assert.ok((await netFor(`SELECT (COALESCE(SUM(a.amount),0)-COALESCE((SELECT SUM(r.amount) FROM finance_allocation_reversals r JOIN finance_allocations ar ON ar.institution_id=r.institution_id AND ar.id=r.original_allocation_id WHERE r.institution_id=$1 AND ar.payment_id=$2),0))::text value FROM finance_allocations a WHERE a.institution_id=$1 AND a.payment_id=$2`, paymentA)).compare(Money.parse('100', 'EUR')) <= 0);

  // B: independently locked Payments contend on one deterministically locked Obligation.
  const obligationB = await seedObligation('100'); const paymentB1 = await seedPayment('100'); const paymentB2 = await seedPayment('100');
  const obligationRace = await Promise.allSettled([confirm(paymentB1, obligationB, '70', 'obligation-a'), confirm(paymentB2, obligationB, '70', 'obligation-b')]);
  assert.equal(obligationRace.filter((result) => result.status === 'fulfilled').length, 1);
  assert.ok((await netFor(`SELECT (COALESCE(SUM(a.amount),0)-COALESCE((SELECT SUM(r.amount) FROM finance_allocation_reversals r JOIN finance_allocations ar ON ar.institution_id=r.institution_id AND ar.id=r.original_allocation_id WHERE r.institution_id=$1 AND ar.obligation_id=$2),0))::text value FROM finance_allocations a WHERE a.institution_id=$1 AND a.obligation_id=$2`, obligationB)).compare(Money.parse('100', 'EUR')) <= 0);

  // C: the original allocation row serializes reversals; the related payment and obligation are locked too.
  const paymentC = await seedPayment('100'); const obligationC = await seedObligation('100'); const allocation = (await confirm(paymentC, obligationC, '100', 'original-allocation')).allocations[0]!;
  const reversalRace = await Promise.allSettled([
    repository.reverseAllocationInCommand(actor, { originalAllocationId: allocation.id, amount: '70', currency: 'EUR', reason: 'race a', effectiveAt }, 'reversal-a'),
    repository.reverseAllocationInCommand(actor, { originalAllocationId: allocation.id, amount: '70', currency: 'EUR', reason: 'race b', effectiveAt }, 'reversal-b'),
  ]);
  assert.equal(reversalRace.filter((result) => result.status === 'fulfilled').length, 1);
  assert.ok((await netFor(`SELECT COALESCE(SUM(amount),0)::text value FROM finance_allocation_reversals WHERE institution_id=$1 AND original_allocation_id=$2`, allocation.id)).compare(Money.parse('100', 'EUR')) <= 0);

  // D: a new allocation and a reversal contend on the same payment/obligation
  // resources.  Either serial order is legitimate, but no derived position may
  // escape its exact [0, original] envelope.
  const paymentD = await seedPayment('100'); const obligationD = await seedObligation('100');
  const originalD = (await confirm(paymentD, obligationD, '60', 'allocation-reversal-original')).allocations[0]!;
  const allocationReversalRace = await Promise.allSettled([
    confirm(paymentD, obligationD, '70', 'allocation-during-reversal'),
    repository.reverseAllocationInCommand(actor, { originalAllocationId: originalD.id, amount: '60', currency: 'EUR', reason: 'concurrent correction', effectiveAt }, 'reversal-during-allocation'),
  ]);
  assert.ok(allocationReversalRace.some((result) => result.status === 'fulfilled'));
  const paymentDPosition = await repository.getPaymentPosition(actor, paymentD);
  const obligationDPosition = await repository.getObligationPosition(actor, obligationD);
  for (const value of [paymentDPosition.allocated, paymentDPosition.unapplied, obligationDPosition.covered, obligationDPosition.uncovered]) {
    assert.ok(value.compare(Money.parse('0', 'EUR')) >= 0, 'derived position must never be negative');
  }
  assert.ok(paymentDPosition.allocated.compare(Money.parse('100', 'EUR')) <= 0, 'payment cannot be over-allocated');
  assert.ok(obligationDPosition.covered.compare(Money.parse('100', 'EUR')) <= 0, 'obligation cannot be over-covered');
  const reversedD = await netFor(`SELECT COALESCE(SUM(amount),0)::text value FROM finance_allocation_reversals WHERE institution_id=$1 AND original_allocation_id=$2`, originalD.id);
  assert.ok(reversedD.compare(Money.parse('60', 'EUR')) <= 0, 'allocation cannot be over-reversed');

  // E: line normalization is ID ordered, and the repository uses ORDER BY id FOR UPDATE for every target.
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/modules/finance/allocation-repository.ts', import.meta.url), 'utf8'));
  assert.match(source, /ORDER BY id FOR UPDATE/);
  assert.doesNotMatch(source, /SERIALIZABLE|Mutex|mutex/);
  console.log('ALLOCATION_REVERSAL_RACE=PASS NEGATIVE_DERIVED_POSITION=NO OVERALLOCATION_AFTER_RACE=NO OVERCOVERAGE_AFTER_RACE=NO OVERREVERSAL_AFTER_RACE=NO');
} finally {
  const cleanup = await pool.connect().catch(() => undefined);
  if (cleanup) { try { await cleanup.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); } finally { cleanup.release(); } }
  await pool.end();
}
