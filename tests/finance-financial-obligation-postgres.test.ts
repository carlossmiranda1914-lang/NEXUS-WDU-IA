import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import path from 'node:path';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { PostgresFinancialAccountRepository } from '../src/modules/finance/financial-account-repository.ts';
import { PostgresFinancialObligationRepository } from '../src/modules/finance/financial-obligation-repository.ts';
import { PostgresFeeCatalogueRepository } from '../src/modules/finance/fee-catalogue-repository.ts';
import { PostgresFeeTypeRepository } from '../src/modules/finance/fee-type-repository.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import type { FinancialProfileStore } from '../src/modules/finance/financial-context.ts';

await verifyApprovedTestConnection();
const schema = `fin_obl_${randomUUID().replaceAll('-', '')}`;
const quote = (x: string) => `"${x}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});

const institutionA = '00000000-0000-0000-0000-000000000001';
const institutionB = '00000000-0000-0000-0000-000000000002';
const personA = '00000000-0000-0000-0000-000000000011';
const personB = '00000000-0000-0000-0000-000000000022';
const studentPersonId = '00000000-0000-0000-0000-000000000033';
const foreignPersonId = '00000000-0000-0000-0000-000000000099';

const actorA: InstitutionalContext = {
  institutionId: institutionA,
  personId: personA,
  personName: 'Admin A',
  identityEmail: 'admin.a@test.local',
  membershipId: '00000000-0000-0000-0000-000000000091',
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  role: 'institution_admin',
};

const actorB: InstitutionalContext = {
  institutionId: institutionB,
  personId: personB,
  personName: 'Admin B',
  identityEmail: 'admin.b@test.local',
  membershipId: '00000000-0000-0000-0000-000000000092',
  institutionName: 'Inst B',
  institutionSlug: 'inst-b',
  role: 'institution_admin',
};

const mockProfiles: FinancialProfileStore = {
  async resolveEffective(instId: string) {
    if (instId !== institutionA && instId !== institutionB) return null;
    return {
      institutionId: instId,
      version: 1,
      effectiveFrom: new Date(Date.now() - 1000000000).toISOString(),
      effectiveTo: null,
      primaryJurisdiction: 'PRT',
      functionalCurrency: 'EUR',
      financialTimezone: 'Europe/Lisbon',
      monetaryPolicyVersion: '1',
      enabledCurrencies: ['EUR'],
    };
  },
};

const emptyProfiles: FinancialProfileStore = {
  async resolveEffective() {
    return null;
  },
};

async function runTests() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)},public`);
    await runMigrations(client, await discoverMigrations(path.resolve('src/db/migrations')));

    // Seed institutions, people, and memberships
    await client.query(`
      INSERT INTO institutions (id, name, slug) VALUES 
        ('${institutionA}', 'Inst A', 'inst-a'),
        ('${institutionB}', 'Inst B', 'inst-b')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO people (id, name) VALUES
        ('${personA}', 'Person A'),
        ('${personB}', 'Person B'),
        ('${studentPersonId}', 'Student Silva'),
        ('${foreignPersonId}', 'Foreign Person')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO memberships (institution_id, person_id, role, status) VALUES
        ('${institutionA}', '${personA}', 'institution_admin', 'active'),
        ('${institutionA}', '${studentPersonId}', 'student', 'active'),
        ('${institutionB}', '${personB}', 'institution_admin', 'active'),
        ('${institutionB}', '${foreignPersonId}', 'student', 'active')
      ON CONFLICT DO NOTHING;
    `);

    const accountRepo = new PostgresFinancialAccountRepository(pool);
    const feeTypeRepo = new PostgresFeeTypeRepository(pool);
    const feeCatalogueRepo = new PostgresFeeCatalogueRepository(pool, mockProfiles);
    const obligationRepo = new PostgresFinancialObligationRepository(pool, mockProfiles);

    const uid = Math.random().toString(36).substring(2, 6).toUpperCase();
    const keyObl1 = `key-obl-1-${uid}`;
    const keyObl2 = `key-obl-2-${uid}`;

    // 1. Create Financial Account in Institution A
    const acc = await accountRepo.create(actorA, {
      name: `Conta Familia Silva ${uid}`,
      primaryPersonId: personA,
    }, `key-acc-f2-1-${uid}`);

    // 2. Create Fee Type & Fee Catalogue Item in Institution A with 50.00 EUR
    const feeTypeRes = await feeTypeRepo.create(actorA, {
      displayName: `Propina F2 Test ${uid}`,
      codePrefix: `P${uid}`.substring(0, 5),
    }, `key-type-f2-1-${uid}`);

    const feeItemRes = await feeCatalogueRepo.create(actorA, {
      feeTypeId: feeTypeRes.result.id,
      name: 'Propina Mensal Test',
      amount: '50.00',
      currency: 'EUR',
      effectiveFrom: new Date(Date.now() - 100000).toISOString(),
    }, `key-fee-f2-1-${uid}`);
    const feeItem = feeItemRes.result;

    assert.equal(feeItem.currentVersion, 1);
    assert.equal(feeItem.current.money.amount, '50');

    // 3. Issue Financial Obligation
    const obl1 = await obligationRepo.issue(actorA, {
      financialAccountId: acc.id,
      feeCatalogueItemId: feeItem.id,
      beneficiaryPersonId: studentPersonId,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      notes: 'Mensalidade Outubro 2026',
    }, keyObl1);

    assert.ok(obl1.id);
    assert.equal(obl1.status, 'open');
    assert.equal(obl1.money.amount, '50');
    assert.equal(obl1.money.currency, 'EUR');
    assert.equal(obl1.feeCatalogueVersion, 1);
    assert.equal(obl1.beneficiaryPersonId, studentPersonId);

    // 4. Update Fee Catalogue Item to v2 with NEW amount (75.00 EUR)
    const updateRes = await feeCatalogueRepo.update(actorA, feeItem.id, {
      expectedVersion: 1,
      name: 'Propina Mensal Aumentada',
      amount: '75.00',
      currency: 'EUR',
      effectiveFrom: new Date().toISOString(),
    }, `key-fee-update-f2-${uid}`);
    const updatedFeeItem = updateRes.result;
    assert.equal(updatedFeeItem.currentVersion, 2);
    assert.equal(updatedFeeItem.current.money.amount, '75');

    // 5. CRITICAL MONEY SNAPSHOT LAW:
    // Existing obligation obl1 MUST RETAIN exact 50.00 EUR and version 1!
    const obl1Reloaded = await obligationRepo.getById(actorA, obl1.id);
    assert.equal(obl1Reloaded.money.amount, '50', 'Obligation amount must remain unchanged at 50 EUR');
    assert.equal(obl1Reloaded.feeCatalogueVersion, 1, 'Obligation version must remain 1');

    // 6. Newly issued obligation receives the new snapshot (75 EUR, v2)
    const obl2 = await obligationRepo.issue(actorA, {
      financialAccountId: acc.id,
      feeCatalogueItemId: feeItem.id,
      beneficiaryPersonId: studentPersonId,
    }, keyObl2);
    assert.equal(obl2.money.amount, '75');
    assert.equal(obl2.feeCatalogueVersion, 2);

    // 7. P1-04 Canonical Idempotency: Replaying with same key returns the exact same obligation from command results
    const obl1Replay = await obligationRepo.issue(actorA, {
      financialAccountId: acc.id,
      feeCatalogueItemId: feeItem.id,
      beneficiaryPersonId: studentPersonId,
      dueAt: obl1.dueAt,
      notes: 'Mensalidade Outubro 2026',
    }, keyObl1);
    assert.equal(obl1Replay.id, obl1.id);
    assert.equal(obl1Replay.money.amount, '50');

    // 8. P1-04 Replaying with same key but DIFFERENT payload throws fingerprint mismatch conflict
    const differentAcc = await accountRepo.create(actorA, {
      name: `Outra Conta ${uid}`,
      primaryPersonId: personA,
    }, `key-acc-f2-diff-${uid}`);

    await assert.rejects(async () => {
      await obligationRepo.issue(actorA, {
        financialAccountId: differentAcc.id,
        feeCatalogueItemId: feeItem.id,
      }, keyObl1);
    }, (err: any) => err.message.includes('fingerprint conflict') || err.code === 'FINANCIAL_OBLIGATION_CONFLICT');

    // 9. P1-01 Exact Money precision and boundary scale round-trip in PostgreSQL
    const exactFeeType = await feeTypeRepo.create(actorA, {
      displayName: `Exact Type ${uid}`,
      codePrefix: `EX${uid}`.substring(0, 5),
    }, `key-type-ex-${uid}`);

    const exactFeeItem = await feeCatalogueRepo.create(actorA, {
      feeTypeId: exactFeeType.result.id,
      name: 'Exact Item',
      amount: '123.456789012345',
      currency: 'EUR',
      effectiveFrom: new Date(Date.now() - 100000).toISOString(),
    }, `key-fee-ex-${uid}`);

    const exactObl = await obligationRepo.issue(actorA, {
      financialAccountId: acc.id,
      feeCatalogueItemId: exactFeeItem.result.id,
    }, `key-obl-ex-${uid}`);

    assert.equal(exactObl.money.amount, '123.456789012345', 'Exact 12 decimal scale preserved in round-trip');

    // 10. P1-02 Tenant-Safe Composite Relational Integrity at PostgreSQL boundary
    // 10a. Cross-tenant financial account in obligation is rejected by DB FK
    await assert.rejects(async () => {
      await client.query(
        `INSERT INTO finance_obligations (
          institution_id, financial_account_id, fee_catalogue_item_id, fee_catalogue_version,
          source_type, source_ref, amount, currency, status, financial_profile_version,
          created_by_person_id, idempotency_key
        ) VALUES (
          '${institutionB}', '${acc.id}', '${feeItem.id}', 1,
          'manual_finance', 'test', 50, 'EUR', 'open', 1,
          '${personB}', 'test-cross-acc-fk'
        )`,
      );
    }, (err: any) => err.code === '23503', 'Cross-tenant financial account FK must be rejected by PostgreSQL');

    // 10b. Cross-tenant fee catalogue item in obligation is rejected by DB FK
    const accB = await accountRepo.create(actorB, {
      name: `Conta Inst B ${uid}`,
      primaryPersonId: personB,
    }, `key-acc-b-${uid}`);

    await assert.rejects(async () => {
      await client.query(
        `INSERT INTO finance_obligations (
          institution_id, financial_account_id, fee_catalogue_item_id, fee_catalogue_version,
          source_type, source_ref, amount, currency, status, financial_profile_version,
          created_by_person_id, idempotency_key
        ) VALUES (
          '${institutionB}', '${accB.id}', '${feeItem.id}', 1,
          'manual_finance', 'test', 50, 'EUR', 'open', 1,
          '${personB}', 'test-cross-fee-fk'
        )`,
      );
    }, (err: any) => err.code === '23503', 'Cross-tenant fee catalogue item FK must be rejected by PostgreSQL');

    // 10c. Cross-tenant party in financial account is rejected by DB FK
    await assert.rejects(async () => {
      await client.query(
        `INSERT INTO finance_financial_account_parties (
          institution_id, financial_account_id, person_id, role, status
        ) VALUES (
          '${institutionB}', '${acc.id}', '${personB}', 'primary_debtor', 'active'
        )`,
      );
    }, (err: any) => err.code === '23503', 'Cross-tenant financial account party FK must be rejected by PostgreSQL');

    // 11. P1-03 Missing or Ineffective Financial Profile fails closed
    const brokenProfileRepo = new PostgresFinancialObligationRepository(pool, emptyProfiles);
    await assert.rejects(async () => {
      await brokenProfileRepo.issue(actorA, {
        financialAccountId: acc.id,
        feeCatalogueItemId: feeItem.id,
      }, `key-obl-broken-prof-${uid}`);
    }, (err: any) => err.message.includes('financial profile') || err.message.includes('Financial profile'));

    // 12. P1-05 Beneficiary Institutional Eligibility: foreign person fails closed
    await assert.rejects(async () => {
      await obligationRepo.issue(actorA, {
        financialAccountId: acc.id,
        feeCatalogueItemId: feeItem.id,
        beneficiaryPersonId: foreignPersonId, // Member of Institution B only
      }, `key-obl-foreign-ben-${uid}`);
    }, (err: any) => err.message.includes('não pertence à instituição ativa'));

    // 13. Tenant isolation: Institution B cannot read Institution A obligations
    const listB = await obligationRepo.list(actorB);
    assert.ok(!listB.some((o) => o.id === obl1.id));

    await assert.rejects(async () => {
      await obligationRepo.getById(actorB, obl1.id);
    }, (err: any) => err.code === 'FINANCIAL_OBLIGATION_NOT_FOUND');

    console.log('Finance financial obligation PostgreSQL tests: PASS');
  } finally {
    client.release();
    await pool.end();
  }
}

runTests().catch((e) => {
  console.error('Test failure:', e);
  process.exit(1);
});
