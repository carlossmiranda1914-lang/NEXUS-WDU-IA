import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { Money } from '../src/modules/finance/money.ts';
import { PostgresFinancialProfileStore } from '../src/modules/finance/financial-context.ts';
import { PostgresPaymentRepository } from '../src/modules/finance/payment-repository.ts';
import { PostgresFinancialObligationRepository } from '../src/modules/finance/financial-obligation-repository.ts';
import { PostgresFinancialAccountRepository, FinancialAccountNotFoundError } from '../src/modules/finance/financial-account-repository.ts';
import { PostgresFeeCatalogueRepository } from '../src/modules/finance/fee-catalogue-repository.ts';
import { PostgresFeeTypeRepository } from '../src/modules/finance/fee-type-repository.ts';
import { PostgresFinanceOperationalContextRepository } from '../src/modules/finance/finance-operational-context-repository.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_op_ctx_pg_${randomUUID().replaceAll('-', '')}`;
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionA = '00000000-0000-0000-0000-000000000401';
const institutionB = '00000000-0000-0000-0000-000000000402';
const actorA = '00000000-0000-0000-0000-000000000411';
const actorB = '00000000-0000-0000-0000-000000000412';
const personPayerA = '00000000-0000-0000-0000-000000000421';
const personStudentA = '00000000-0000-0000-0000-000000000422';
const personPayerB = '00000000-0000-0000-0000-000000000423';

const contextA = {
  institutionId: institutionA,
  personId: actorA,
  personName: 'Actor A',
  identityEmail: 'actor.a@test.local',
  membershipId: randomUUID(),
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  role: 'financial' as const,
};

const contextB = {
  institutionId: institutionB,
  personId: actorB,
  personName: 'Actor B',
  identityEmail: 'actor.b@test.local',
  membershipId: randomUUID(),
  institutionName: 'Inst B',
  institutionSlug: 'inst-b',
  role: 'financial' as const,
};

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);

    const migrations = await discoverMigrations(migrationsDir);
    await runMigrations(client, migrations);

    // Base fixtures
    await client.query(
      `INSERT INTO institutions(id,name,slug,status) VALUES ($1,'Inst A','inst-a','active'),($2,'Inst B','inst-b','active')`,
      [institutionA, institutionB]
    );
    await client.query(
      `INSERT INTO people(id,name) VALUES ($1,'Actor A'),($2,'Actor B'),($3,'Payer A'),($4,'Student A'),($5,'Payer B')`,
      [actorA, actorB, personPayerA, personStudentA, personPayerB]
    );
    await client.query(
      `INSERT INTO memberships(id,institution_id,person_id,role,status) VALUES
       ($1,$2,$3,'financial','active'),
       ($4,$5,$6,'financial','active'),
       ($7,$8,$9,'parent','active'),
       ($10,$11,$12,'parent','active')`,
      [
        randomUUID(), institutionA, actorA,
        randomUUID(), institutionB, actorB,
        randomUUID(), institutionA, personPayerA,
        randomUUID(), institutionB, personPayerB
      ]
    );
    await client.query(
      `INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies)
       VALUES ($1,1,now() - interval '1 day','PT','EUR','Europe/Lisbon','v1','["EUR","USD"]'),
              ($2,1,now() - interval '1 day','AO','AOA','Africa/Luanda','v1','["AOA"]')`,
      [institutionA, institutionB]
    );

    // Student profile & Guardian relationship in Inst A
    const studentProfileId = randomUUID();
    await client.query(
      `INSERT INTO student_profiles(id, institution_id, person_id, student_number, status)
       VALUES ($1, $2, $3, 'ALU-001', 'active')`,
      [studentProfileId, institutionA, personStudentA]
    );
    await client.query(
      `INSERT INTO guardian_relationships(id, institution_id, guardian_person_id, student_person_id, relationship, status, is_primary, financial_responsible)
       VALUES ($1, $2, $3, $4, 'Encarregado de Educação', 'active', true, true)`,
      [randomUUID(), institutionA, personPayerA, personStudentA]
    );

    // Academic year & Enrollment application in Inst A
    const academicYearId = randomUUID();
    await client.query(
      `INSERT INTO academic_years(id, institution_id, name, starts_on, ends_on, status)
       VALUES ($1, $2, '2026/2027', '2026-09-01', '2027-06-30', 'active')`,
      [academicYearId, institutionA]
    );
    const offerId = randomUUID();
    await client.query(
      `INSERT INTO enrollment_offers(id, institution_id, academic_year_id, name, code, status)
       VALUES ($1, $2, $3, 'Oferta 10º Ano', 'OFF-10', 'active')`,
      [offerId, institutionA, academicYearId]
    );
    const enrollmentId = randomUUID();
    await client.query(
      `INSERT INTO enrollment_applications(id, institution_id, student_person_id, guardian_person_id, academic_year_id, offer_id, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $7)`,
      [enrollmentId, institutionA, personStudentA, personPayerA, academicYearId, offerId, actorA]
    );

    // Financial Account in Inst A
    const accountRepo = new PostgresFinancialAccountRepository(pool);
    const accountA = await accountRepo.create(contextA, {
      name: 'Conta Familiar Payer A',
      primaryPersonId: personPayerA,
    }, 'idemp-acc-001');

    // Financial Account in Inst B
    const accountB = await accountRepo.create(contextB, {
      name: 'Conta Familiar Payer B',
      primaryPersonId: personPayerB,
    }, 'idemp-acc-002');

    // Fee Catalogue item in Inst A
    const typeRepo = new PostgresFeeTypeRepository(pool);
    const types = await typeRepo.list(contextA);
    const tuitionType = types.find((t) => t.codePrefix === 'PROP')!;

    const profileStore = new PostgresFinancialProfileStore(pool);
    const feeRepo = new PostgresFeeCatalogueRepository(pool, profileStore);
    const feeCreateRes = await feeRepo.create(contextA, {
      feeTypeId: tuitionType.id,
      name: 'Mensalidade 10º Ano',
      amount: '150.00',
      currency: 'EUR',
      effectiveFrom: new Date(Date.now() - 86400000).toISOString(),
    }, 'idemp-fee-001');
    const feeItem = feeCreateRes.result;

    // Obligation in Inst A
    const obligationRepo = new PostgresFinancialObligationRepository(pool, profileStore);
    const obligationRes = await obligationRepo.issue(contextA, {
      financialAccountId: accountA.id,
      beneficiaryPersonId: personStudentA,
      feeCatalogueItemId: feeItem.id,
      sourceType: 'manual_finance',
      sourceRef: 'REF-MAN-001',
      dueAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    }, 'idemp-ob-001');

    // Payment in Inst A attached to accountA
    const paymentRepo = new PostgresPaymentRepository(pool);
    const paymentRes = await paymentRepo.confirmPaymentInCommand(contextA, {
      sourceType: 'manual_offline',
      method: 'cash',
      amount: '50.00',
      currency: 'EUR',
      financialAccountId: accountA.id,
      payerPersonId: personPayerA,
      notes: 'Entrada de pagamento',
    }, 'idemp-pay-001');

    // Another payment in Inst A NOT attached to accountA
    const unlinkedPaymentRes = await paymentRepo.confirmPaymentInCommand(contextA, {
      sourceType: 'manual_offline',
      method: 'bank_transfer',
      amount: '100.00',
      currency: 'EUR',
      notes: 'Pagamento avulso sem conta',
    }, 'idemp-pay-002');

    // Test Operational Context Repository
    const opContextRepo = new PostgresFinanceOperationalContextRepository(pool);

    // 1. Get operational context for accountA in Inst A
    const ctxA = await opContextRepo.getByFinancialAccountId(contextA, accountA.id);

    assert.equal(ctxA.financialAccount.id, accountA.id);
    assert.equal(ctxA.financialAccount.accountNumber, 'CTA-000001');
    assert.equal(ctxA.financialAccount.name, 'Conta Familiar Payer A');
    assert.equal(ctxA.financialAccount.status, 'active');

    assert.ok(ctxA.responsiblePerson);
    assert.equal(ctxA.responsiblePerson?.personId, personPayerA);
    assert.equal(ctxA.responsiblePerson?.displayName, 'Payer A');

    assert.ok(ctxA.students.length >= 1, 'Should resolve associated student');
    const stu = ctxA.students.find(s => s.personId === personStudentA);
    assert.ok(stu, 'Student A must be present in students list');
    assert.equal(stu.displayName, 'Student A');
    assert.equal(stu.enrollmentId, enrollmentId);
    assert.equal(stu.enrollmentStatus, 'active');

    assert.equal(ctxA.openObligations.length, 1);
    assert.equal(ctxA.openObligations[0].id, obligationRes.id);
    assert.equal(ctxA.openObligations[0].amount.amount, '150');
    assert.equal(ctxA.openObligations[0].amount.currency, 'EUR');
    assert.equal(ctxA.openObligations[0].status, 'open');
    assert.equal(ctxA.openObligations[0].feeItemCode, feeItem.code);

    assert.equal(ctxA.confirmedUnallocatedPayments.length, 1);
    assert.equal(ctxA.confirmedUnallocatedPayments[0].id, paymentRes.payment.id);
    assert.equal(ctxA.confirmedUnallocatedPayments[0].paymentReference, paymentRes.payment.paymentReference);
    assert.equal(ctxA.confirmedUnallocatedPayments[0].amount.amount, '50');
    assert.equal(ctxA.confirmedUnallocatedPayments[0].amount.currency, 'EUR');
    assert.equal(ctxA.confirmedUnallocatedPayments[0].method, 'cash');
    assert.equal(ctxA.confirmedUnallocatedPayments[0].allocationStatus, 'unapplied');

    // Verify unlinked payment was NOT included in accountA context
    assert.ok(!ctxA.confirmedUnallocatedPayments.some(p => p.id === unlinkedPaymentRes.payment.id));

    // Verify history contains both obligation and payment
    assert.ok(ctxA.history.length >= 2);
    assert.ok(ctxA.history.some(h => h.kind === 'obligation' && h.id === obligationRes.id));
    assert.ok(ctxA.history.some(h => h.kind === 'payment' && h.id === paymentRes.payment.id));

    // Multi-tenant isolation: Inst A cannot access accountB
    await assert.rejects(
      async () => {
        await opContextRepo.getByFinancialAccountId(contextA, accountB.id);
      },
      (err: any) => err instanceof FinancialAccountNotFoundError
    );

    // Multi-tenant isolation: Inst B cannot access accountA
    await assert.rejects(
      async () => {
        await opContextRepo.getByFinancialAccountId(contextB, accountA.id);
      },
      (err: any) => err instanceof FinancialAccountNotFoundError
    );

    // Non-existent account fails closed
    await assert.rejects(
      async () => {
        await opContextRepo.getByFinancialAccountId(contextA, randomUUID());
      },
      (err: any) => err instanceof FinancialAccountNotFoundError
    );

    console.log('PostgresFinanceOperationalContextRepository tests passed successfully.');
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
    client.release();
  }
} finally {
  await pool.end();
}
