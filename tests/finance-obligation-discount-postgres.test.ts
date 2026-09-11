import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { PostgresObligationDiscountRepository } from '../src/modules/finance/obligation-discount-repository.ts';
import { PostgresDiscountPolicyRepository } from '../src/modules/finance/discount-policy-repository.ts';

await verifyApprovedTestConnection();
const schema = `finance_discount_cmd_${randomUUID().replaceAll('-', '')}`;
const q = (v: string) => `"${v.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${q(schema)},public` });

const institutionId = randomUUID();
const personId = randomUUID();
const accountId = randomUUID();
const feeTypeId = randomUUID();
const feeId = randomUUID();
const actor = {
  personId,
  personName: 'Financial Actor',
  identityEmail: null,
  membershipId: randomUUID(),
  institutionId,
  institutionName: 'Discount School',
  institutionSlug: 'discount-school',
  role: 'financial' as const,
};

const policyRepo = new PostgresDiscountPolicyRepository(pool);
const discountRepo = new PostgresObligationDiscountRepository(pool);

async function createTestObligation(amount = '100'): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO finance_obligations (
       id, institution_id, financial_account_id, fee_catalogue_item_id, fee_catalogue_version,
       source_type, source_ref, amount, currency, status, financial_profile_version, created_by_person_id, idempotency_key
     ) VALUES ($1, $2, $3, $4, 1, 'manual_finance', $5, $6, 'EUR', 'open', 1, $7, $8)`,
    [id, institutionId, accountId, feeId, `ref-${id}`, amount, personId, `key-${id}`]
  );
  return id;
}

try {
  const c = await pool.connect();
  try {
    await c.query(`CREATE SCHEMA ${q(schema)}`);
    await runMigrations(c, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));

    await c.query(`INSERT INTO institutions(id, name, slug, status) VALUES ($1, 'Discount School', 'discount-school', 'active')`, [institutionId]);
    await c.query(`INSERT INTO people(id, name) VALUES ($1, 'Financial Actor')`, [personId]);
    await c.query(`INSERT INTO finance_profile_versions(institution_id, version, effective_from, primary_jurisdiction, functional_currency, financial_timezone, monetary_policy_version, enabled_currencies) VALUES ($1, 1, now(), 'PT', 'EUR', 'Europe/Lisbon', 'v1', '["EUR"]')`, [institutionId]);
    await c.query(`INSERT INTO finance_financial_accounts(id, institution_id, account_number, name) VALUES ($1, $2, 'ACC-1', 'Main Account')`, [accountId, institutionId]);
    await c.query(`INSERT INTO finance_fee_types(id, institution_id, source, display_name, code_prefix) VALUES ($1, $2, 'institution_custom', 'Tuition', 'TUI')`, [feeTypeId, institutionId]);
    await c.query(`INSERT INTO finance_fee_catalogue_items(id, institution_id, fee_type_id, code, current_version, created_by_person_id) VALUES ($1, $2, $3, 'TUI-1', 1, $4)`, [feeId, institutionId, feeTypeId, personId]);
    await c.query(`INSERT INTO finance_fee_catalogue_versions(institution_id, item_id, fee_type_id, version, name, kind, amount, currency, effective_from, created_by_person_id) VALUES ($1, $2, $3, 1, 'Tuition Fee', 'fee', '100', 'EUR', now(), $4)`, [institutionId, feeId, feeTypeId, personId]);
  } finally {
    c.release();
  }

  // Setup test policies
  const bolsa20 = await policyRepo.createDiscountPolicy(actor, {
    code: 'BOLSA-20',
    name: 'Bolsa de Mérito 20%',
    calculationMode: 'percentage',
    value: '20.00',
    currency: null,
    effectiveFrom: new Date('2026-09-01T00:00:00Z'),
    effectiveTo: new Date('2027-08-31T23:59:59Z'),
  });

  const irmaos10 = await policyRepo.createDiscountPolicy(actor, {
    code: 'IRMAOS-10',
    name: 'Desconto Irmãos 10 EUR',
    calculationMode: 'fixed_amount',
    value: '10.00',
    currency: 'EUR',
    effectiveFrom: new Date('2026-09-01T00:00:00Z'),
    effectiveTo: new Date('2027-08-31T23:59:59Z'),
  });

  const excedente70 = await policyRepo.createDiscountPolicy(actor, {
    code: 'EXCEDENTE-70',
    name: 'Desconto Excedente 70 EUR',
    calculationMode: 'fixed_amount',
    value: '70.00',
    currency: 'EUR',
    effectiveFrom: new Date('2026-09-01T00:00:00Z'),
    effectiveTo: new Date('2027-08-31T23:59:59Z'),
  });

  const usdPolicy = await policyRepo.createDiscountPolicy(actor, {
    code: 'USD-15',
    name: 'USD Discount',
    calculationMode: 'fixed_amount',
    value: '15.00',
    currency: 'USD',
    effectiveFrom: new Date('2026-09-01T00:00:00Z'),
    effectiveTo: new Date('2027-08-31T23:59:59Z'),
  });

  // 1. Percentage discount application: 20% on 100 EUR -> 20.00 EUR
  const ob1 = await createTestObligation('100');
  const app1 = await discountRepo.applyObligationDiscount(
    actor,
    {
      obligationId: ob1,
      discountPolicyId: bolsa20.id,
      reason: 'Merit scholarship application',
    },
    'app-key-1'
  );
  assert.equal(app1.discount.amount.canonicalAmount(), '20');
  assert.equal(app1.position.effectiveDue.canonicalAmount(), '80');
  assert.equal(app1.position.grossDiscounts.canonicalAmount(), '20');
  assert.equal(app1.position.netDiscounts.canonicalAmount(), '20');

  // Verify Journal entry created atomically
  const journalRows = await pool.query(
    `SELECT * FROM finance_journal_transactions WHERE id = $1`,
    [app1.discount.journalTransactionId]
  );
  assert.equal(journalRows.rows.length, 1);
  assert.equal(journalRows.rows[0].journal_type, 'obligation_discount');

  // 2. Idempotency replay and conflict on apply
  const replay1 = await discountRepo.applyObligationDiscount(
    actor,
    {
      obligationId: ob1,
      discountPolicyId: bolsa20.id,
      reason: 'Merit scholarship application',
    },
    'app-key-1'
  );
  assert.equal(replay1.replayed, true);
  assert.equal(replay1.discount.id, app1.discount.id);

  await assert.rejects(
    () =>
      discountRepo.applyObligationDiscount(
        actor,
        {
          obligationId: ob1,
          discountPolicyId: bolsa20.id,
          reason: 'Different reason with same key',
        },
        'app-key-1'
      ),
    /fingerprint|conflict/i
  );

  // 3. One active discount invariant: applying second discount on ob1 fails with DISCOUNT_ALREADY_ACTIVE
  await assert.rejects(
    () =>
      discountRepo.applyObligationDiscount(
        actor,
        {
          obligationId: ob1,
          discountPolicyId: irmaos10.id,
          reason: 'Second discount attempt',
        },
        'app-key-2'
      ),
    /DISCOUNT_ALREADY_ACTIVE|already active/i
  );

  // 4. Currency mismatch rejection
  const ob2 = await createTestObligation('100');
  await assert.rejects(
    () =>
      discountRepo.applyObligationDiscount(
        actor,
        {
          obligationId: ob2,
          discountPolicyId: usdPolicy.id,
          reason: 'USD discount on EUR obligation',
        },
        'app-key-3'
      ),
    /DISCOUNT_CURRENCY_MISMATCH|currency/i
  );

  // 5. Covered floor validation: mock 40 EUR allocation covered on ob2, attempt 70 EUR discount
  const floorPayJournalId = randomUUID();
  const floorPayId = randomUUID();
  await pool.query(
    `INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at)
     VALUES($1,$2,'confirmed','EUR','40.00',$3,'foundation_value_received',$4,1,now())`,
    [floorPayJournalId, institutionId, `cmd-${floorPayId}`, personId]
  );
  await pool.query(
    `INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,source_type,method,amount,currency,status,allocation_status,financial_account_id,payer_person_id,effective_at,financial_profile_version,actor_person_id)
     VALUES($1,$2,$3,$4,'manual_offline','cash','40.00','EUR','confirmed','unapplied',$5,$6,now(),1,$6)`,
    [floorPayId, institutionId, `PAY-FLOOR`, floorPayJournalId, accountId, personId]
  );
  const allocJournalId = randomUUID();
  await pool.query(
    `INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at)
     VALUES($1,$2,'confirmed','EUR','40.00',$3,'payment_allocation',$4,1,now())`,
    [allocJournalId, institutionId, `cmd-alloc-${allocJournalId}`, personId]
  );
  await pool.query(
    `INSERT INTO finance_allocations (
       id, institution_id, payment_id, financial_account_id, obligation_id, amount, currency,
       journal_transaction_id, effective_at, actor_kind, actor_person_id
     ) VALUES ($1, $2, $3, $4, $5, '40.00', 'EUR', $6, now(), 'human', $7)`,
    [randomUUID(), institutionId, floorPayId, accountId, ob2, allocJournalId, personId]
  );

  await assert.rejects(
    () =>
      discountRepo.applyObligationDiscount(
        actor,
        {
          obligationId: ob2,
          discountPolicyId: excedente70.id,
          reason: 'Floor breach attempt',
        },
        'app-key-4'
      ),
    /DISCOUNT_FLOOR_VIOLATION|below covered|floor/i
  );

  // 6. Revocation flow: revoke app1 on ob1
  const rev1 = await discountRepo.revokeObligationDiscount(
    actor,
    {
      obligationId: ob1,
      discountId: app1.discount.id,
      reason: 'Loss of scholarship eligibility',
    },
    'rev-key-1'
  );
  assert.equal(rev1.revocation.amount.canonicalAmount(), '20');
  assert.equal(rev1.position.effectiveDue.canonicalAmount(), '100');
  assert.equal(rev1.position.revokedDiscounts.canonicalAmount(), '20');
  assert.equal(rev1.position.netDiscounts.canonicalAmount(), '0');

  // Verify revocation Journal entry
  const revJournalRows = await pool.query(
    `SELECT * FROM finance_journal_transactions WHERE id = $1`,
    [rev1.revocation.journalTransactionId]
  );
  assert.equal(revJournalRows.rows.length, 1);
  assert.equal(revJournalRows.rows[0].journal_type, 'obligation_discount');

  // 7. Once-only revocation
  await assert.rejects(
    () =>
      discountRepo.revokeObligationDiscount(
        actor,
        {
          obligationId: ob1,
          discountId: app1.discount.id,
          reason: 'Duplicate revocation attempt',
        },
        'rev-key-2'
      ),
    /DISCOUNT_ALREADY_REVOKED|already revoked/i
  );

  // 8. New application allowed after revocation
  const app2 = await discountRepo.applyObligationDiscount(
    actor,
    {
      obligationId: ob1,
      discountPolicyId: irmaos10.id,
      reason: 'Sibling discount after scholarship revoked',
    },
    'app-key-5'
  );
  assert.equal(app2.discount.amount.canonicalAmount(), '10');
  assert.equal(app2.position.effectiveDue.canonicalAmount(), '90');
  assert.equal(app2.position.grossDiscounts.canonicalAmount(), '30');
  assert.equal(app2.position.revokedDiscounts.canonicalAmount(), '20');
  assert.equal(app2.position.netDiscounts.canonicalAmount(), '10');

  console.log('Finance obligation discount commands PostgreSQL: PASS');
} finally {
  const c = await pool.connect().catch(() => undefined);
  if (c) {
    try { await c.query(`DROP SCHEMA IF EXISTS ${q(schema)} CASCADE`); } finally { c.release(); }
  }
  await pool.end();
}
