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

    // 3. 400 Bad Request - Missing financialAccountId parameter
    {
      const res = await fetch(`${baseUrl}/api/finance/operational-context`, {
        headers: { Authorization: 'Bearer token-fin-a' },
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.code, 'INVALID_FINANCIAL_ACCOUNT_ID');
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
