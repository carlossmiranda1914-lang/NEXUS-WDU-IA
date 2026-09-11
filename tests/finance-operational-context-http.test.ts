import { strict as assert } from 'node:assert';
import http from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import path from 'node:path';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { registerFinancialAccountRoutes } from '../src/modules/finance/financial-account-http.ts';
import { registerFinanceOperationalContextRoutes } from '../src/modules/finance/finance-operational-context-http.ts';
import { PostgresFinancialAccountRepository } from '../src/modules/finance/financial-account-repository.ts';

await verifyApprovedTestConnection();
const schema = `fin_op_http_${randomUUID().replaceAll('-', '')}`;
const quote = (x: string) => `"${x}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});

const institutionA = '00000000-0000-0000-0000-000000000501';
const institutionB = '00000000-0000-0000-0000-000000000502';
const personA = '00000000-0000-0000-0000-000000000511';
const personB = '00000000-0000-0000-0000-000000000512';
const studentPerson = '00000000-0000-0000-0000-000000000521';
const payerPerson = '00000000-0000-0000-0000-000000000522';

const tokenMap: Record<string, { uid: string; institutionId: string; personId: string; role: string }> = {
  'token-fin-a': { uid: 'uid-fin-a', institutionId: institutionA, personId: personA, role: 'financial' },
  'token-admin-a': { uid: 'uid-admin-a', institutionId: institutionA, personId: personA, role: 'institution_admin' },
  'token-student-a': { uid: 'uid-student-a', institutionId: institutionA, personId: studentPerson, role: 'student' },
  'token-fin-b': { uid: 'uid-fin-b', institutionId: institutionB, personId: personB, role: 'financial' },
};

async function runTests() {
  const client = await pool.connect();
  let server: http.Server | undefined;
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)},public`);
    await runMigrations(client, await discoverMigrations(path.resolve('src/db/migrations')));

    // Fixtures
    await client.query(`
      INSERT INTO institutions (id, name, slug) VALUES
        ('${institutionA}', 'Inst A', 'inst-a'),
        ('${institutionB}', 'Inst B', 'inst-b')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO people (id, name, email) VALUES
        ('${personA}', 'Staff A', 'staff.a@test.local'),
        ('${personB}', 'Staff B', 'staff.b@test.local'),
        ('${studentPerson}', 'Student Test', 'student.test@test.local'),
        ('${payerPerson}', 'Payer Test', 'payer.test@test.local')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO memberships (id, institution_id, person_id, role, status) VALUES
        ('${randomUUID()}', '${institutionA}', '${personA}', 'financial', 'active'),
        ('${randomUUID()}', '${institutionA}', '${studentPerson}', 'student', 'active'),
        ('${randomUUID()}', '${institutionA}', '${payerPerson}', 'parent', 'active'),
        ('${randomUUID()}', '${institutionB}', '${personB}', 'financial', 'active')
      ON CONFLICT DO NOTHING;

      INSERT INTO finance_profile_versions(institution_id, version, effective_from, primary_jurisdiction, functional_currency, financial_timezone, monetary_policy_version, enabled_currencies)
      VALUES
        ('${institutionA}', 1, now() - interval '1 day', 'PT', 'EUR', 'Europe/Lisbon', 'v1', '["EUR"]'),
        ('${institutionB}', 1, now() - interval '1 day', 'PT', 'EUR', 'Europe/Lisbon', 'v1', '["EUR"]')
      ON CONFLICT DO NOTHING;
    `);

    // Create accounts in A and B
    const accountRepo = new PostgresFinancialAccountRepository(pool);
    const accountA = await accountRepo.create(
      {
        institutionId: institutionA,
        personId: personA,
        role: 'financial',
        personName: 'Staff A',
        identityEmail: 'staff.a@test.local',
        membershipId: randomUUID(),
        institutionName: 'Inst A',
        institutionSlug: 'inst-a',
      },
      { name: 'Conta Aluno Test', primaryPersonId: payerPerson },
      'idemp-acc-001'
    );

    // Link studentPerson to accountA
    await client.query(
      `INSERT INTO finance_financial_account_parties (id, institution_id, financial_account_id, person_id, role, status)
       VALUES ($1, $2, $3, $4, 'beneficiary', 'active')`,
      [randomUUID(), institutionA, accountA.id, studentPerson]
    );

    const studentRefHttp = 'stu_1111222233334444555566';
    await client.query(
      `INSERT INTO student_profiles(id, institution_id, person_id, student_number, public_ref, status)
       VALUES ($1, $2, $3, 'ALU-HTTP-01', $4, 'active')`,
      [randomUUID(), institutionA, studentPerson, studentRefHttp]
    );

    const academicYearId = randomUUID();
    await client.query(
      `INSERT INTO academic_years(id, institution_id, name, starts_on, ends_on, status)
       VALUES ($1, $2, '2026/2027', '2026-09-01', '2027-06-30', 'active')`,
      [academicYearId, institutionA]
    );
    const offerId = randomUUID();
    await client.query(
      `INSERT INTO enrollment_offers(id, institution_id, academic_year_id, name, code, status)
       VALUES ($1, $2, $3, 'Oferta HTTP', 'OFF-HTTP', 'active')`,
      [offerId, institutionA, academicYearId]
    );
    const enrollmentIdHttp = randomUUID();
    await client.query(
      `INSERT INTO enrollment_applications(id, institution_id, student_person_id, guardian_person_id, academic_year_id, offer_id, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $7)`,
      [enrollmentIdHttp, institutionA, studentPerson, payerPerson, academicYearId, offerId, personA]
    );

    const accountB = await accountRepo.create(
      {
        institutionId: institutionB,
        personId: personB,
        role: 'financial',
        personName: 'Staff B',
        identityEmail: 'staff.b@test.local',
        membershipId: randomUUID(),
        institutionName: 'Inst B',
        institutionSlug: 'inst-b',
      },
      { name: 'Conta B', primaryPersonId: personB },
      'idemp-acc-002'
    );

    const auth = createRequireAuth({
      verifyIdToken: async (token: string) => {
        const item = tokenMap[token];
        if (!item) throw new Error('Invalid test token');
        return { uid: item.uid, email: `${item.uid}@test.local` };
      },
      pool: pool as any,
      resolveInstitutionalContext: async (_executor: any, uid: string) => {
        const item = Object.values(tokenMap).find((x) => x.uid === uid);
        if (!item) return { kind: 'missing_membership' };
        return {
          kind: 'resolved',
          context: {
            institutionId: item.institutionId,
            personId: item.personId,
            personName: item.uid,
            identityEmail: `${item.uid}@test.local`,
            membershipId: randomUUID(),
            institutionName: 'Test Institution',
            institutionSlug: 'test-inst',
            role: item.role as any,
          },
        };
      },
    });

    const app = express();
    app.use(express.json());
    registerFinancialAccountRoutes(app, pool, auth);
    registerFinanceOperationalContextRoutes(app, pool, auth);

    server = http.createServer(app);
    server.listen(0);
    await once(server, 'listening');
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. 401 Unauthorized - No token
    {
      const res = await fetch(`${baseUrl}/api/finance/operational-context?financialAccountId=${accountA.id}`);
      assert.equal(res.status, 401);
      const json = await res.json();
      assert.ok(json.error);
    }

    // 2. 403 Forbidden - Role without Finance read capability (student)
    {
      const res = await fetch(`${baseUrl}/api/finance/operational-context?financialAccountId=${accountA.id}`, {
        headers: { Authorization: 'Bearer token-student-a' },
      });
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.code, 'FINANCE_FORBIDDEN');
    }

    // 3. 400 Bad Request - Missing query parameters (financialAccountId, studentRef, or enrollmentId)
    {
      const res = await fetch(`${baseUrl}/api/finance/operational-context`, {
        headers: { Authorization: 'Bearer token-fin-a' },
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.code, 'INVALID_QUERY_PARAMS');
    }

    // 4. 400 Bad Request - Invalid financialAccountId format (not a UUID)
    {
      const res = await fetch(`${baseUrl}/api/finance/operational-context?financialAccountId=not-a-uuid`, {
        headers: { Authorization: 'Bearer token-fin-a' },
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.code, 'INVALID_FINANCIAL_ACCOUNT_ID');
    }

    // 5. 200 OK - Authorized financial role in Institution A reading Account A
    {
      const res = await fetch(`${baseUrl}/api/finance/operational-context?financialAccountId=${accountA.id}`, {
        headers: { Authorization: 'Bearer token-fin-a' },
      });
      assert.equal(res.status, 200);
      const json = await res.json();

      // Assert presentation safety: no internal secrets or unwanted leakage
      assert.equal(json.financialAccount.id, accountA.id);
      assert.equal(json.financialAccount.accountNumber, 'CTA-000001');
      assert.equal(json.financialAccount.name, 'Conta Aluno Test');
      assert.equal(json.financialAccount.status, 'active');
      assert.equal(json.responsiblePerson.personId, payerPerson);
      assert.equal(json.responsiblePerson.displayName, 'Payer Test');
      assert.ok(Array.isArray(json.students));
      assert.ok(Array.isArray(json.openObligations));
      assert.ok(Array.isArray(json.confirmedUnallocatedPayments));
      assert.ok(Array.isArray(json.history));

      // Assert absence of internal leakage
      assert.strictEqual((json as any).institutionId, undefined);
      assert.strictEqual((json as any).idempotencyKey, undefined);
    }

    // 6. 404 Not Found - Cross-tenant isolation (Institution A user attempting to read Account B)
    {
      const res = await fetch(`${baseUrl}/api/finance/operational-context?financialAccountId=${accountB.id}`, {
        headers: { Authorization: 'Bearer token-fin-a' },
      });
      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.code, 'FINANCIAL_ACCOUNT_NOT_FOUND');
    }

    // 7. 404 Not Found - Non-existent account in Institution A
    {
      const res = await fetch(`${baseUrl}/api/finance/operational-context?financialAccountId=${randomUUID()}`, {
        headers: { Authorization: 'Bearer token-fin-a' },
      });
      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.code, 'FINANCIAL_ACCOUNT_NOT_FOUND');
    }

    // 8. Canonical Financial Accounts list route contract: GET /api/finance/financial-accounts?status=active
    {
      const res = await fetch(`${baseUrl}/api/finance/financial-accounts?status=active`, {
        headers: { Authorization: 'Bearer token-fin-a' },
      });
      assert.equal(res.status, 200);
      const accounts = await res.json();
      assert.ok(Array.isArray(accounts), 'financial-accounts must return an array');
      assert.ok(accounts.some((a: any) => a.id === accountA.id), 'Must include account A');
      assert.ok(!accounts.some((a: any) => a.id === accountB.id), 'Must NOT include account B (tenant isolation)');
    }

    // 9. Contextual resolution via Student Ref: GET /api/finance/operational-context?studentRef=...
    {
      const res = await fetch(`${baseUrl}/api/finance/operational-context?studentRef=${studentRefHttp}`, {
        headers: { Authorization: 'Bearer token-fin-a' },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.financialAccount.id, accountA.id);
      assert.equal(json.financialAccount.accountNumber, 'CTA-000001');
    }

    // 10. Contextual resolution via Enrollment ID: GET /api/finance/operational-context?enrollmentId=...
    {
      const res = await fetch(`${baseUrl}/api/finance/operational-context?enrollmentId=${enrollmentIdHttp}`, {
        headers: { Authorization: 'Bearer token-fin-a' },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.financialAccount.id, accountA.id);
    }

    // 11. Tenant isolation on Student Ref: Inst B reading Inst A student returns 404
    {
      const res = await fetch(`${baseUrl}/api/finance/operational-context?studentRef=${studentRefHttp}`, {
        headers: { Authorization: 'Bearer token-fin-b' },
      });
      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.code, 'STUDENT_NOT_FOUND');
    }

    // 12. Tenant isolation on Enrollment ID: Inst B reading Inst A enrollment returns 404
    {
      const res = await fetch(`${baseUrl}/api/finance/operational-context?enrollmentId=${enrollmentIdHttp}`, {
        headers: { Authorization: 'Bearer token-fin-b' },
      });
      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.code, 'ENROLLMENT_NOT_FOUND');
    }

    // 13. Server-side Bounded Search in GET /api/finance/financial-accounts?q=...&limit=...
    {
      // Search by account number (CTA-000001)
      const resNum = await fetch(`${baseUrl}/api/finance/financial-accounts?status=active&q=CTA-000001`, {
        headers: { Authorization: 'Bearer token-fin-a' },
      });
      assert.equal(resNum.status, 200);
      const accountsNum = await resNum.json();
      assert.equal(accountsNum.length, 1);
      assert.equal(accountsNum[0].id, accountA.id);

      // Search by account name
      const resName = await fetch(`${baseUrl}/api/finance/financial-accounts?status=active&q=Aluno%20Test`, {
        headers: { Authorization: 'Bearer token-fin-a' },
      });
      assert.equal(resName.status, 200);
      const accountsName = await resName.json();
      assert.equal(accountsName.length, 1);
      assert.equal(accountsName[0].id, accountA.id);

      // Search by primary responsible person name
      const resPerson = await fetch(`${baseUrl}/api/finance/financial-accounts?status=active&q=Payer%20Test`, {
        headers: { Authorization: 'Bearer token-fin-a' },
      });
      assert.equal(resPerson.status, 200);
      const accountsPerson = await resPerson.json();
      assert.equal(accountsPerson.length, 1);
      assert.equal(accountsPerson[0].id, accountA.id);

      // Search tenant isolation: Inst B searching for Inst A specific account yields 0 results
      const resTenant = await fetch(`${baseUrl}/api/finance/financial-accounts?status=active&q=Aluno%20Test`, {
        headers: { Authorization: 'Bearer token-fin-b' },
      });
      assert.equal(resTenant.status, 200);
      const accountsTenant = await resTenant.json();
      assert.equal(accountsTenant.length, 0);

      // Limit bound
      const resLimit = await fetch(`${baseUrl}/api/finance/financial-accounts?status=active&limit=1`, {
        headers: { Authorization: 'Bearer token-fin-a' },
      });
      assert.equal(resLimit.status, 200);
      const accountsLimit = await resLimit.json();
      assert.ok(accountsLimit.length <= 1);
    }

    console.log('FinanceOperationalContext HTTP contract tests passed successfully.');
  } finally {
    if (server) server.close();
    await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
    client.release();
    await pool.end();
  }
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
