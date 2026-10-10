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
import { PostgresAllocationRepository } from '../src/modules/finance/allocation-repository.ts';
import {
  PostgresFinanceOperationalContextRepository,
  AmbiguousFinancialAccountError,
  StudentNotFoundError,
  EnrollmentNotFoundError,
} from '../src/modules/finance/finance-operational-context-repository.ts';
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
    const studentRefA = 'stu_1234567890123456789012';
    await client.query(
      `INSERT INTO student_profiles(id, institution_id, person_id, student_number, public_ref, status)
       VALUES ($1, $2, $3, 'ALU-001', $4, 'active')`,
      [studentProfileId, institutionA, personStudentA, studentRefA]
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

    // Another payment in Inst A attached to accountA
    const secondPaymentRes = await paymentRepo.confirmPaymentInCommand(contextA, {
      sourceType: 'manual_offline',
      method: 'bank_transfer',
      amount: '100.00',
      currency: 'EUR',
      financialAccountId: accountA.id,
      notes: 'Pagamento adicional na conta',
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

    assert.equal(ctxA.confirmedUnallocatedPayments.length, 2);
    const firstPayment = ctxA.confirmedUnallocatedPayments.find(payment => payment.id === paymentRes.payment.id)!;
    assert.equal(firstPayment.paymentReference, paymentRes.payment.paymentReference);
    assert.equal(firstPayment.amount.amount, '50');
    assert.equal(firstPayment.amount.currency, 'EUR');
    assert.equal(firstPayment.method, 'cash');
    assert.equal(firstPayment.allocationStatus, 'unapplied');

    assert.ok(ctxA.confirmedUnallocatedPayments.some(p => p.id === secondPaymentRes.payment.id));

    // Verify history contains both obligation and payment
    assert.ok(ctxA.history.length >= 2);
    assert.ok(ctxA.history.some(h => h.kind === 'obligation' && h.id === obligationRes.id));
    assert.ok(ctxA.history.some(h => h.kind === 'payment' && h.id === paymentRes.payment.id));

    // Allocation positions are reconstructed from immutable Allocation minus Reversal facts.
    const allocationRepo = new PostgresAllocationRepository(pool);
    const confirmed = await allocationRepo.confirmAllocationInCommand(contextA, {
      paymentId: paymentRes.payment.id,
      effectiveAt: new Date().toISOString(),
      lines: [{ obligationId: obligationRes.id, amount: '50.00', currency: 'EUR' }],
    }, 'idemp-projection-allocation');
    await allocationRepo.reverseAllocationInCommand(contextA, {
      originalAllocationId: confirmed.allocations[0]!.id,
      amount: '20.00',
      currency: 'EUR',
      reason: 'Correção da associação',
      effectiveAt: new Date().toISOString(),
    }, 'idemp-projection-reversal');
    const rebuilt = await opContextRepo.getByFinancialAccountId(contextA, accountA.id);
    const rebuiltAgain = await opContextRepo.getByFinancialAccountId(contextA, accountA.id);
    const projectedPayment = rebuilt.confirmedUnallocatedPayments.find((payment) => payment.id === paymentRes.payment.id)!;
    const projectedObligation = rebuilt.openObligations.find((obligation) => obligation.id === obligationRes.id)!;
    assert.deepEqual(projectedPayment.received, { amount: '50', currency: 'EUR' });
    assert.deepEqual(projectedPayment.allocated, { amount: '30', currency: 'EUR' });
    assert.deepEqual(projectedPayment.unapplied, { amount: '20', currency: 'EUR' });
    assert.equal(projectedPayment.allocationPosition, 'partially_allocated');
    assert.deepEqual(projectedObligation.original, { amount: '150', currency: 'EUR' });
    assert.deepEqual(projectedObligation.covered, { amount: '30', currency: 'EUR' });
    assert.deepEqual(projectedObligation.uncovered, { amount: '120', currency: 'EUR' });
    assert.equal(projectedObligation.coveragePosition, 'partially_covered');
    const allocationHistory = rebuilt.history.find((item) => item.kind === 'allocation' && item.id === confirmed.allocations[0]!.id);
    assert.ok(allocationHistory && allocationHistory.kind === 'allocation');
    assert.equal(allocationHistory.allocation.reversals.length, 1);
    assert.equal(allocationHistory.allocation.reversals[0]!.reason, 'Correção da associação');
    assert.deepEqual(rebuilt, rebuiltAgain, 'A refetch rebuilds the same projection solely from canonical facts');

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

    // 2. Resolve operational context by Student Ref
    const ctxByStudent = await opContextRepo.getByStudentRef(contextA, studentRefA);
    assert.equal(ctxByStudent.financialAccount.id, accountA.id, 'Student A must resolve Account A');
    assert.equal(ctxByStudent.openObligations.length, 1);

    // 3. Resolve operational context by Enrollment ID
    const ctxByEnrollment = await opContextRepo.getByEnrollmentId(contextA, enrollmentId);
    assert.equal(ctxByEnrollment.financialAccount.id, accountA.id, 'Enrollment of Student A must resolve Account A');

    // 4. Negative proof: Foreign tenant Student Ref fails closed
    await assert.rejects(
      async () => {
        await opContextRepo.getByStudentRef(contextB, studentRefA);
      },
      (err: any) => err instanceof StudentNotFoundError
    );

    // 5. Negative proof: Foreign tenant Enrollment ID fails closed
    await assert.rejects(
      async () => {
        await opContextRepo.getByEnrollmentId(contextB, enrollmentId);
      },
      (err: any) => err instanceof EnrollmentNotFoundError
    );

    // 6. Negative proof: Student with NO financial account fails closed with FinancialAccountNotFoundError
    const personStudentNoAcc = randomUUID();
    const studentRefNoAcc = 'stu_9999999999999999999999';
    await client.query(`INSERT INTO people(id, name) VALUES ($1, 'Student No Account')`, [personStudentNoAcc]);
    await client.query(
      `INSERT INTO student_profiles(id, institution_id, person_id, student_number, public_ref, status)
       VALUES ($1, $2, $3, 'ALU-NO-ACC', $4, 'active')`,
      [randomUUID(), institutionA, personStudentNoAcc, studentRefNoAcc]
    );
    await assert.rejects(
      async () => {
        await opContextRepo.getByStudentRef(contextA, studentRefNoAcc);
      },
      (err: any) => err instanceof FinancialAccountNotFoundError
    );

    // 7. Negative proof: Ambiguous student associated with multiple accounts fails with AmbiguousFinancialAccountError
    const personStudentAmbiguous = randomUUID();
    const studentRefAmbiguous = 'stu_8888888888888888888888';
    await client.query(`INSERT INTO people(id, name) VALUES ($1, 'Student Ambiguous')`, [personStudentAmbiguous]);
    await client.query(
      `INSERT INTO student_profiles(id, institution_id, person_id, student_number, public_ref, status)
       VALUES ($1, $2, $3, 'ALU-AMB', $4, 'active')`,
      [randomUUID(), institutionA, personStudentAmbiguous, studentRefAmbiguous]
    );
    // Create second account in Inst A
    const accountA2 = await accountRepo.create(contextA, {
      name: 'Segunda Conta Inst A',
      primaryPersonId: personPayerA,
    }, 'idemp-acc-003');
    // Link ambiguous student to both accountA and accountA2 as active party
    await client.query(
      `INSERT INTO finance_financial_account_parties (id, institution_id, financial_account_id, person_id, role, status)
       VALUES ($1, $2, $3, $4, 'beneficiary', 'active'), ($5, $2, $6, $4, 'beneficiary', 'active')`,
      [randomUUID(), institutionA, accountA.id, personStudentAmbiguous, randomUUID(), accountA2.id]
    );

    await assert.rejects(
      async () => {
        await opContextRepo.getByStudentRef(contextA, studentRefAmbiguous);
      },
      (err: any) => err instanceof AmbiguousFinancialAccountError
    );

    // 8. PostgresFinancialAccountRepository bounded search verification
    {
      // Search by operational account number
      const resultsNum = await accountRepo.list(contextA, 'active', { q: 'CTA-000001' });
      assert.equal(resultsNum.length, 1);
      assert.equal(resultsNum[0].id, accountA.id);

      // Search by account name
      const resultsName = await accountRepo.list(contextA, 'active', { q: 'Familiar' });
      assert.equal(resultsName.length, 1);
      assert.equal(resultsName[0].id, accountA.id);

      // Search by primary person name
      const resultsPerson = await accountRepo.list(contextA, 'active', { q: 'Payer A' });
      assert.equal(resultsPerson.length, 2); // accountA and accountA2 both have primary person Payer A
      assert.equal(resultsPerson[0].accountNumber, 'CTA-000001');
      assert.equal(resultsPerson[1].accountNumber, 'CTA-000002');

      // Search with limit
      const resultsLimit = await accountRepo.list(contextA, 'active', { q: 'Payer A', limit: 1 });
      assert.equal(resultsLimit.length, 1);

      // Tenant isolation: contextB cannot find Inst A accounts
      const resultsTenant = await accountRepo.list(contextB, 'active', { q: 'Familiar Payer A' });
      assert.equal(resultsTenant.length, 0);
    }

    console.log('PostgresFinanceOperationalContextRepository tests passed successfully.');
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
    client.release();
  }
} finally {
  await pool.end();
}
