import { strict as assert } from 'node:assert';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { PostgresFinancialAccountRepository } from '../src/modules/finance/financial-account-repository.ts';
import { PostgresFinancialObligationRepository } from '../src/modules/finance/financial-obligation-repository.ts';
import { PostgresFeeCatalogueRepository } from '../src/modules/finance/fee-catalogue-repository.ts';
import { PostgresFeeTypeRepository } from '../src/modules/finance/fee-type-repository.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import type { FinancialProfileStore } from '../src/modules/finance/financial-context.ts';

dotenv.config();
if (process.env.TEST_DATABASE_LOCAL_AUTHORIZED === 'true') {
  dotenv.config({ path: '.env.test.local', override: true });
}

const dbUrl = process.env.TEST_DATABASE_URL;
if (!dbUrl) {
  console.log('Skipping PostgresFinancialObligationRepository tests (no TEST_DATABASE_URL)');
  process.exit(0);
}

const pool = new Pool({ connectionString: dbUrl });

const institutionA = '00000000-0000-0000-0000-000000000001';
const institutionB = '00000000-0000-0000-0000-000000000002';
const personA = '00000000-0000-0000-0000-000000000011';
const personB = '00000000-0000-0000-0000-000000000022';
const studentPersonId = '00000000-0000-0000-0000-000000000033';

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
  async resolveEffective() {
    return {
      institutionId: institutionA,
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

async function runTests() {
  const client = await pool.connect();
  try {
    // Seed institutions and people
    await client.query(`
      INSERT INTO institutions (id, name, slug) VALUES 
        ('${institutionA}', 'Inst A', 'inst-a'),
        ('${institutionB}', 'Inst B', 'inst-b')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO people (id, name, email) VALUES
        ('${personA}', 'Person A', 'person.a@test.local'),
        ('${personB}', 'Person B', 'person.b@test.local'),
        ('${studentPersonId}', 'Student Silva', 'student.silva@test.local')
      ON CONFLICT (id) DO NOTHING;
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

    // 7. Idempotency: Replaying with same key returns the exact same obligation
    const obl1Replay = await obligationRepo.issue(actorA, {
      financialAccountId: acc.id,
      feeCatalogueItemId: feeItem.id,
      beneficiaryPersonId: studentPersonId,
    }, keyObl1);
    assert.equal(obl1Replay.id, obl1.id);
    assert.equal(obl1Replay.money.amount, '50');

    // 8. Replaying with same key but DIFFERENT payload throws 409 conflict
    const differentAcc = await accountRepo.create(actorA, {
      name: `Outra Conta ${uid}`,
      primaryPersonId: personA,
    }, `key-acc-f2-diff-${uid}`);

    await assert.rejects(async () => {
      await obligationRepo.issue(actorA, {
        financialAccountId: differentAcc.id,
        feeCatalogueItemId: feeItem.id,
      }, keyObl1);
    }, (err: any) => err.code === 'FINANCIAL_OBLIGATION_CONFLICT');

    // 9. Tenant isolation: Institution B cannot read or list Institution A obligations
    const listB = await obligationRepo.list(actorB);
    assert.ok(!listB.some((o) => o.id === obl1.id));

    await assert.rejects(async () => {
      await obligationRepo.getById(actorB, obl1.id);
    }, (err: any) => err.code === 'FINANCIAL_OBLIGATION_NOT_FOUND');

    // 10. Cancel obligation
    const cancelled = await obligationRepo.cancel(actorA, obl1.id, 'Erro de emissão manual');
    assert.equal(cancelled.status, 'cancelled');
    assert.ok(cancelled.notes?.includes('Cancelado: Erro de emissão manual'));

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
