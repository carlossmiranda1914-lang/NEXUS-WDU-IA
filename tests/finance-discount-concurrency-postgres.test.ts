import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDiscountPolicyRepository } from '../src/modules/finance/discount-policy-repository.ts';
import { PostgresObligationDiscountRepository } from '../src/modules/finance/obligation-discount-repository.ts';
import { PostgresAllocationRepository } from '../src/modules/finance/allocation-repository.ts';
import { PostgresObligationAdjustmentRepository } from '../src/modules/finance/obligation-adjustment-repository.ts';
import { Money } from '../src/modules/finance/money.ts';
import { deriveObligationFinancialPosition } from '../src/modules/finance/obligation-financial-position.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();

const schema = `finance_discount_race_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const institutionId = randomUUID();
const personId = randomUUID();
const accountId = randomUUID();
const actor = {
  personId,
  personName: 'Concurrency actor',
  identityEmail: null,
  membershipId: randomUUID(),
  institutionId,
  institutionName: 'Concurrency institution',
  institutionSlug: 'discount-race',
  role: 'financial' as const,
};
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const policyRepo = new PostgresDiscountPolicyRepository(pool);
const discountRepo = new PostgresObligationDiscountRepository(pool);
const allocationRepo = new PostgresAllocationRepository(pool);
const adjustmentRepo = new PostgresObligationAdjustmentRepository(pool);

let feeItemId = '';

async function seedPayment(amount: string) {
  const id = randomUUID();
  const journalId = randomUUID();
  await pool.query(
    `INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at)
     VALUES($1,$2,'confirmed','EUR',$3,$4,'foundation_value_received',$5,1,now())`,
    [journalId, institutionId, amount, `payment-${id}`, personId]
  );
  await pool.query(
    `INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,source_type,method,amount,currency,status,allocation_status,financial_account_id,payer_person_id,effective_at,financial_profile_version,actor_person_id)
     VALUES($1,$2,$3,$4,'manual_offline','cash',$5,'EUR','confirmed','unapplied',$6,$7,now(),1,$7)`,
    [id, institutionId, `PAY-${id.replaceAll('-', '').slice(0, 28)}`, journalId, amount, accountId, personId]
  );
  return id;
}

async function seedObligation(amount: string) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,status,financial_profile_version,created_by_person_id,idempotency_key)
     VALUES($1,$2,$3,$4,1,'manual_finance',$5,$6,'EUR','open',1,$7,$8)`,
    [id, institutionId, accountId, feeItemId, `race-${id}`, amount, personId, `obligation-${id}`]
  );
  return id;
}

async function getObligationPosition(obligationId: string) {
  const obRes = await pool.query<{ amount: string; currency: string }>(
    `SELECT amount, currency FROM finance_obligations WHERE institution_id=$1 AND id=$2`,
    [institutionId, obligationId]
  );
  const original = Money.parse(obRes.rows[0]!.amount, obRes.rows[0]!.currency);

  const allocsRes = await pool.query<{ amount: string }>(
    `SELECT amount FROM finance_allocations WHERE institution_id=$1 AND obligation_id=$2`,
    [institutionId, obligationId]
  );
  const revsRes = await pool.query<{ amount: string }>(
    `SELECT r.amount FROM finance_allocation_reversals r
     JOIN finance_allocations a ON a.institution_id=r.institution_id AND a.id=r.original_allocation_id
     WHERE r.institution_id=$1 AND a.obligation_id=$2`,
    [institutionId, obligationId]
  );
  const adjsRes = await pool.query<{ direction: 'increase' | 'decrease'; amount: string }>(
    `SELECT direction, amount FROM finance_obligation_adjustments WHERE institution_id=$1 AND obligation_id=$2`,
    [institutionId, obligationId]
  );
  const discountsRes = await pool.query<{ id: string; amount: string }>(
    `SELECT id, amount FROM finance_obligation_discounts WHERE institution_id=$1 AND obligation_id=$2`,
    [institutionId, obligationId]
  );
  const discRevsRes = await pool.query<{ original_discount_id: string; amount: string }>(
    `SELECT r.original_discount_id, r.amount FROM finance_obligation_discount_revocations r
     JOIN finance_obligation_discounts d ON d.institution_id=r.institution_id AND d.id=r.original_discount_id
     WHERE r.institution_id=$1 AND d.obligation_id=$2`,
    [institutionId, obligationId]
  );

  return deriveObligationFinancialPosition({
    original,
    allocations: allocsRes.rows.map((r) => Money.parse(r.amount, original.currency)),
    allocationReversals: revsRes.rows.map((r) => Money.parse(r.amount, original.currency)),
    adjustments: adjsRes.rows.map((r) => ({
      direction: r.direction,
      amount: Money.parse(r.amount, original.currency),
    })),
    discounts: discountsRes.rows.map((r) => ({
      id: r.id,
      amount: Money.parse(r.amount, original.currency),
    })),
    discountRevocations: discRevsRes.rows.map((r) => ({
      originalDiscountId: r.obligation_discount_id,
      amount: Money.parse(r.amount, original.currency),
    })),
  });
}

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await runMigrations(client, await discoverMigrations(migrations));
    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES($1,'Concurrency institution','discount-race','active')`, [institutionId]);
    await client.query(`INSERT INTO people(id,name) VALUES($1,'Concurrency actor')`, [personId]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR"]')`, [institutionId]);
    await client.query(`INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'CTA-DISC-RACE','Concurrency account')`, [accountId, institutionId]);
    const feeTypeId = randomUUID();
    feeItemId = randomUUID();
    await client.query(`INSERT INTO finance_fee_types(id,institution_id,source,display_name,code_prefix) VALUES($1,$2,'institution_custom','Concurrency fee','DISCRACE')`, [feeTypeId, institutionId]);
    await client.query(`INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'DISCRACE-000001',1,$4)`, [feeItemId, institutionId, feeTypeId, personId]);
    await client.query(`INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'Concurrency fee','fee',100,'EUR',now(),$4)`, [institutionId, feeItemId, feeTypeId, personId]);
  } finally {
    client.release();
  }

  // Seed standard discount policies
  const bolsa20 = await policyRepo.createDiscountPolicy(
    actor,
    {
      code: 'BOLSA-20',
      name: 'Bolsa de Mérito 20%',
      calculationMode: 'percentage',
      value: '20.00',
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    }
  );

  const irmaos10 = await policyRepo.createDiscountPolicy(
    actor,
    {
      code: 'IRMAOS-10',
      name: 'Desconto Irmãos 10 EUR',
      calculationMode: 'fixed_amount',
      value: '10.00',
      currency: 'EUR',
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    }
  );

  const excedente70 = await policyRepo.createDiscountPolicy(
    actor,
    {
      code: 'EXCEDENTE-70',
      name: 'Desconto Excedente 70 EUR',
      calculationMode: 'fixed_amount',
      value: '70.00',
      currency: 'EUR',
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    }
  );

  // ==========================================
  // RACE 1: Apply x Apply Race
  // ==========================================
  const obRace1 = await seedObligation('100.00');
  const r1Results = await Promise.allSettled([
    discountRepo.applyObligationDiscount(actor, { obligationId: obRace1, discountPolicyId: bolsa20.id, reason: 'Race 1 Apply A' }, 'r1-a'),
    discountRepo.applyObligationDiscount(actor, { obligationId: obRace1, discountPolicyId: bolsa20.id, reason: 'Race 1 Apply B' }, 'r1-b'),
  ]);
  const r1Fulfilled = r1Results.filter((r) => r.status === 'fulfilled');
  const r1Rejected = r1Results.filter((r) => r.status === 'rejected');
  assert.equal(r1Fulfilled.length, 1, 'Race 1: Exactly 1 Apply must succeed');
  assert.equal(r1Rejected.length, 1, 'Race 1: Exactly 1 Apply must fail');
  assert.match((r1Rejected[0] as PromiseRejectedResult).reason.message, /DISCOUNT_ALREADY_ACTIVE|already active/i);

  const r1Pos = await getObligationPosition(obRace1);
  assert.equal(r1Pos.effectiveDue.canonicalAmount(), '80');
  assert.equal(r1Pos.remainingCoverable.canonicalAmount(), '80');
  const r1Discounts = await pool.query(`SELECT count(*)::int c FROM finance_obligation_discounts WHERE institution_id=$1 AND obligation_id=$2`, [institutionId, obRace1]);
  assert.equal(r1Discounts.rows[0].c, 1);
  const r1Journals = await pool.query(`SELECT count(*)::int c FROM finance_journal_transactions WHERE institution_id=$1 AND journal_type='obligation_discount'`, [institutionId]);
  assert.equal(r1Journals.rows[0].c, 1);

  // ==========================================
  // RACE 2: Apply x Allocation Race
  // ==========================================
  const obRace2 = await seedObligation('100.00');
  const payRace2 = await seedPayment('100.00');
  // Initial: 40 EUR allocated
  await allocationRepo.confirmAllocationInCommand(
    actor,
    { paymentId: payRace2, effectiveAt: '2026-09-06T10:00:00.000Z', lines: [{ obligationId: obRace2, amount: '40.00', currency: 'EUR' }] },
    'r2-init'
  );

  // Race: Apply BOLSA-20 (20 EUR discount) vs Allocate 50 EUR
  const r2Results = await Promise.allSettled([
    discountRepo.applyObligationDiscount(actor, { obligationId: obRace2, discountPolicyId: bolsa20.id, reason: 'Race 2 Apply' }, 'r2-apply'),
    allocationRepo.confirmAllocationInCommand(
      actor,
      { paymentId: payRace2, effectiveAt: '2026-09-06T10:00:00.000Z', lines: [{ obligationId: obRace2, amount: '50.00', currency: 'EUR' }] },
      'r2-alloc'
    ),
  ]);
  // Either Apply commits first (effectiveDue 80, remaining 40) -> 50 EUR allocation fails capacity;
  // OR Allocation commits first (covered 90) -> 20 EUR discount fails floor violation.
  assert.equal(r2Results.filter((r) => r.status === 'fulfilled').length, 1, 'Race 2: Exactly 1 operation must succeed');
  const r2Pos = await getObligationPosition(obRace2);
  assert.ok(r2Pos.effectiveDue.compare(r2Pos.netCovered) >= 0, 'Race 2: effectiveDue must never fall below netCovered');
  assert.ok(r2Pos.remainingCoverable.compare(Money.parse('0', 'EUR')) >= 0, 'Race 2: remainingCoverable must not be negative');

  // ==========================================
  // RACE 3: Apply x Adjustment Race
  // ==========================================
  const obRace3 = await seedObligation('100.00');
  const r3Results = await Promise.allSettled([
    discountRepo.applyObligationDiscount(actor, { obligationId: obRace3, discountPolicyId: bolsa20.id, reason: 'Race 3 Apply' }, 'r3-apply'),
    adjustmentRepo.recordAdjustment(
      actor,
      { obligationId: obRace3, direction: 'decrease', amount: '30.00', currency: 'EUR', reason: 'Race 3 Decrease adjustment' },
      'r3-adj'
    ),
  ]);
  assert.equal(r3Results.filter((r) => r.status === 'fulfilled').length, 2, 'Race 3: Both operations must succeed');
  const r3Pos = await getObligationPosition(obRace3);
  assert.equal(r3Pos.effectiveDue.canonicalAmount(), '50');
  assert.equal(r3Pos.remainingCoverable.canonicalAmount(), '50');

  // ==========================================
  // RACE 4: Apply x Allocation Reversal Race
  // ==========================================
  const obRace4 = await seedObligation('100.00');
  const payRace4 = await seedPayment('100.00');
  const r4Alloc = (
    await allocationRepo.confirmAllocationInCommand(
      actor,
      { paymentId: payRace4, effectiveAt: '2026-09-06T10:00:00.000Z', lines: [{ obligationId: obRace4, amount: '40.00', currency: 'EUR' }] },
      'r4-init'
    )
  ).allocations[0]!;

  // Op A: Apply EXCEDENTE-70 (70 EUR discount); Op B: Reverse 20 EUR allocation
  const r4Results = await Promise.allSettled([
    discountRepo.applyObligationDiscount(actor, { obligationId: obRace4, discountPolicyId: excedente70.id, reason: 'Race 4 Apply 70' }, 'r4-apply'),
    allocationRepo.reverseAllocationInCommand(
      actor,
      { originalAllocationId: r4Alloc.id, amount: '20.00', currency: 'EUR', reason: 'Race 4 Reversal', effectiveAt: '2026-09-06T10:00:00.000Z' },
      'r4-rev'
    ),
  ]);
  // Either Reversal commits first (covered becomes 20) -> Apply 70 succeeds (effectiveDue 30 >= 20);
  // OR Apply runs first against 40 covered -> floor violation fails, then Reversal succeeds.
  assert.ok(r4Results.some((r) => r.status === 'fulfilled'), 'Race 4: At least 1 operation must succeed');
  const r4Pos = await getObligationPosition(obRace4);
  assert.ok(r4Pos.effectiveDue.compare(r4Pos.netCovered) >= 0, 'Race 4: effectiveDue >= netCovered invariant');
  assert.ok(r4Pos.remainingCoverable.compare(Money.parse('0', 'EUR')) >= 0, 'Race 4: remainingCoverable >= 0 invariant');

  // ==========================================
  // RACE 5: Revoke x Allocation Race
  // ==========================================
  const obRace5 = await seedObligation('100.00');
  const payRace5 = await seedPayment('100.00');
  await allocationRepo.confirmAllocationInCommand(
    actor,
    { paymentId: payRace5, effectiveAt: '2026-09-06T10:00:00.000Z', lines: [{ obligationId: obRace5, amount: '40.00', currency: 'EUR' }] },
    'r5-init'
  );
  const r5Disc = (
    await discountRepo.applyObligationDiscount(
      actor,
      { obligationId: obRace5, discountPolicyId: bolsa20.id, reason: 'Race 5 Active Discount' },
      'r5-disc-init'
    )
  ).discount;

  // Race: Revoke discount (+20) vs Allocate 50 EUR
  const r5Results = await Promise.allSettled([
    discountRepo.revokeObligationDiscount(actor, { obligationId: obRace5, discountId: r5Disc.id, reason: 'Race 5 Revoke' }, 'r5-revoke'),
    allocationRepo.confirmAllocationInCommand(
      actor,
      { paymentId: payRace5, effectiveAt: '2026-09-06T10:00:00.000Z', lines: [{ obligationId: obRace5, amount: '50.00', currency: 'EUR' }] },
      'r5-alloc'
    ),
  ]);
  // Either Revoke first (remaining becomes 60) -> 50 allocation succeeds;
  // OR Allocation first (attempts 50 on 40 remaining) -> fails capacity; Revoke succeeds.
  assert.ok(r5Results.some((r) => r.status === 'fulfilled'), 'Race 5: At least 1 operation must succeed');
  const r5Pos = await getObligationPosition(obRace5);
  assert.ok(r5Pos.effectiveDue.compare(r5Pos.netCovered) >= 0, 'Race 5: effectiveDue >= netCovered invariant');
  assert.ok(r5Pos.remainingCoverable.compare(Money.parse('0', 'EUR')) >= 0, 'Race 5: remainingCoverable >= 0 invariant');

  // ==========================================
  // RACE 6: Revoke x Adjustment Race
  // ==========================================
  const obRace6 = await seedObligation('100.00');
  const r6Disc = (
    await discountRepo.applyObligationDiscount(
      actor,
      { obligationId: obRace6, discountPolicyId: bolsa20.id, reason: 'Race 6 Active Discount' },
      'r6-disc-init'
    )
  ).discount;

  const r6Results = await Promise.allSettled([
    discountRepo.revokeObligationDiscount(actor, { obligationId: obRace6, discountId: r6Disc.id, reason: 'Race 6 Revoke' }, 'r6-revoke'),
    adjustmentRepo.recordAdjustment(
      actor,
      { obligationId: obRace6, direction: 'increase', amount: '10.00', currency: 'EUR', reason: 'Race 6 Increase adjustment' },
      'r6-adj'
    ),
  ]);
  assert.equal(r6Results.filter((r) => r.status === 'fulfilled').length, 2, 'Race 6: Both operations commute and succeed');
  const r6Pos = await getObligationPosition(obRace6);
  assert.equal(r6Pos.effectiveDue.canonicalAmount(), '110');
  assert.equal(r6Pos.remainingCoverable.canonicalAmount(), '110');

  // ==========================================
  // RACE 7: Revoke x Discount Apply Race
  // ==========================================
  const obRace7 = await seedObligation('100.00');
  const r7Disc = (
    await discountRepo.applyObligationDiscount(
      actor,
      { obligationId: obRace7, discountPolicyId: bolsa20.id, reason: 'Race 7 Active Discount 1' },
      'r7-disc1'
    )
  ).discount;

  const r7Results = await Promise.allSettled([
    discountRepo.revokeObligationDiscount(actor, { obligationId: obRace7, discountId: r7Disc.id, reason: 'Race 7 Revoke 1' }, 'r7-revoke'),
    discountRepo.applyObligationDiscount(actor, { obligationId: obRace7, discountPolicyId: irmaos10.id, reason: 'Race 7 Apply 2' }, 'r7-apply2'),
  ]);
  // Either Revoke first -> Apply 2 succeeds (effective 90);
  // OR Apply 2 first -> fails (already active), then Revoke succeeds (effective 100).
  assert.ok(r7Results.some((r) => r.status === 'fulfilled'), 'Race 7: At least 1 operation must succeed');
  const r7Pos = await getObligationPosition(obRace7);
  assert.ok(
    r7Pos.effectiveDue.canonicalAmount() === '90' || r7Pos.effectiveDue.canonicalAmount() === '100',
    `Race 7: effectiveDue must be either 90 or 100, got ${r7Pos.effectiveDue.canonicalAmount()}`
  );

  // ==========================================
  // RACE 8: Revoke x Revoke Race
  // ==========================================
  const obRace8 = await seedObligation('100.00');
  const r8Disc = (
    await discountRepo.applyObligationDiscount(
      actor,
      { obligationId: obRace8, discountPolicyId: bolsa20.id, reason: 'Race 8 Active Discount' },
      'r8-disc-init'
    )
  ).discount;

  const r8Results = await Promise.allSettled([
    discountRepo.revokeObligationDiscount(actor, { obligationId: obRace8, discountId: r8Disc.id, reason: 'Race 8 Revoke A' }, 'r8-rev-a'),
    discountRepo.revokeObligationDiscount(actor, { obligationId: obRace8, discountId: r8Disc.id, reason: 'Race 8 Revoke B' }, 'r8-rev-b'),
  ]);
  const r8Fulfilled = r8Results.filter((r) => r.status === 'fulfilled');
  const r8Rejected = r8Results.filter((r) => r.status === 'rejected');
  assert.equal(r8Fulfilled.length, 1, 'Race 8: Exactly 1 Revoke must succeed');
  assert.equal(r8Rejected.length, 1, 'Race 8: Exactly 1 Revoke must fail');
  assert.match((r8Rejected[0] as PromiseRejectedResult).reason.message, /DISCOUNT_ALREADY_REVOKED|already revoked/i);

  const r8Revocations = await pool.query(
    `SELECT count(*)::int c FROM finance_obligation_discount_revocations WHERE institution_id=$1 AND original_discount_id=$2`,
    [institutionId, r8Disc.id]
  );
  assert.equal(r8Revocations.rows[0].c, 1, 'Race 8: Exactly 1 revocation fact row must exist');

  console.log('Finance discount concurrency PostgreSQL (8 races): PASS');
} finally {
  await pool.end();
}
