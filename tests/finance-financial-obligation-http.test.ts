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
import { registerFeeCatalogueRoutes } from '../src/modules/finance/fee-catalogue-http.ts';
import { registerFeeTypeRoutes } from '../src/modules/finance/fee-type-http.ts';
import { registerFinancialAccountRoutes } from '../src/modules/finance/financial-account-http.ts';
import { registerFinancialObligationRoutes } from '../src/modules/finance/financial-obligation-http.ts';
import type { FinancialProfileStore } from '../src/modules/finance/financial-context.ts';

await verifyApprovedTestConnection();
const schema = `fin_http_${randomUUID().replaceAll('-', '')}`;
const quote = (x: string) => `"${x}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});

const institutionA = '00000000-0000-0000-0000-000000000001';
const institutionB = '00000000-0000-0000-0000-000000000002';
const personA = '00000000-0000-0000-0000-000000000011';
const personB = '00000000-0000-0000-0000-000000000022';
const studentPerson = '00000000-0000-0000-0000-000000000033';

const tokenMap: Record<string, { uid: string; institutionId: string; personId: string; role: string }> = {
  'token-fin-a': { uid: 'uid-fin-a', institutionId: institutionA, personId: personA, role: 'financial' },
  'token-admin-a': { uid: 'uid-admin-a', institutionId: institutionA, personId: personA, role: 'institution_admin' },
  'token-sec-a': { uid: 'uid-sec-a', institutionId: institutionA, personId: personA, role: 'secretariat' },
  'token-fin-b': { uid: 'uid-fin-b', institutionId: institutionB, personId: personB, role: 'financial' },
};

const profiles: FinancialProfileStore = {
  async resolveEffective(instId) {
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

async function runTests() {
  const client = await pool.connect();
  let server: http.Server | undefined;
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)},public`);
    await runMigrations(client, await discoverMigrations(path.resolve('src/db/migrations')));

    // Seed
    await client.query(`
      INSERT INTO institutions (id, name, slug) VALUES 
        ('${institutionA}', 'Inst A', 'inst-a'),
        ('${institutionB}', 'Inst B', 'inst-b')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO people (id, name, email) VALUES
        ('${personA}', 'Person A', 'person.a@test.local'),
        ('${personB}', 'Person B', 'person.b@test.local'),
        ('${studentPerson}', 'Student Test', 'student.test@test.local')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO memberships (institution_id, person_id, role, status) VALUES
        ('${institutionA}', '${personA}', 'institution_admin', 'active'),
        ('${institutionA}', '${studentPerson}', 'student', 'active'),
        ('${institutionB}', '${personB}', 'institution_admin', 'active')
      ON CONFLICT DO NOTHING;
    `);

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
            membershipId: '00000000-0000-0000-0000-000000000099',
            institutionName: 'Test Institution',
            institutionSlug: 'test-inst',
            role: item.role as any,
            permissions: ['admin'],
          },
        };
      },
    });

    const app = express();
    app.use(express.json());
    registerFeeCatalogueRoutes(app, pool, profiles, auth);
    registerFeeTypeRoutes(app, pool, auth);
    registerFinancialAccountRoutes(app, pool, auth);
    registerFinancialObligationRoutes(app, pool, profiles, auth);

    server = http.createServer(app);
    server.listen(0);
    await once(server, 'listening');
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const request = async (token: string | null, path: string, options: any = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${baseUrl}${path}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    };

    // 1. Financial Accounts: 401 when no token
    const noTokenAcc = await request(null, '/api/finance/financial-accounts');
    assert.equal(noTokenAcc.status, 401);

    // 2. Financial Accounts: 403 for unauthorized role
    const forbiddenAcc = await request('token-sec-a', '/api/finance/financial-accounts');
    assert.equal(forbiddenAcc.status, 403);

    // 3. Financial Accounts: 201 Create account
    const uid = Math.random().toString(36).substring(2, 6).toUpperCase();
    const createAccRes = await request('token-fin-a', '/api/finance/financial-accounts', {
      method: 'POST',
      headers: { 'Idempotency-Key': `key-acc-http-${uid}` },
      body: { name: `Conta Familiar HTTP ${uid}`, primaryPersonId: personA },
    });
    assert.equal(createAccRes.status, 201);
    assert.ok(createAccRes.body.accountNumber.startsWith('CTA-'));
    const accId = createAccRes.body.id;

    // 4. Create Fee Type & Fee Item
    const createTypeRes = await request('token-fin-a', '/api/finance/fee-types', {
      method: 'POST',
      headers: { 'Idempotency-Key': `key-type-http-${uid}` },
      body: { displayName: `Propina HTTP ${uid}`, codePrefix: `H${uid}`.substring(0, 5) },
    });
    assert.equal(createTypeRes.status, 201);
    const feeTypeId = createTypeRes.body.id;

    const createFeeRes = await request('token-fin-a', '/api/finance/fee-catalogue', {
      method: 'POST',
      headers: { 'Idempotency-Key': `key-fee-http-${uid}` },
      body: {
        feeTypeId,
        name: 'Propina HTTP Test',
        amount: '60.00',
        currency: 'EUR',
        effectiveFrom: new Date(Date.now() - 100000).toISOString(),
      },
    });
    assert.equal(createFeeRes.status, 201);
    const feeItemId = createFeeRes.body.id;

    // 5. Obligations API: 401 when missing token
    const noTokenObl = await request(null, '/api/finance/obligations');
    assert.equal(noTokenObl.status, 401);

    // 6. Obligations API: 403 for unauthorized role
    const forbiddenObl = await request('token-sec-a', '/api/finance/obligations');
    assert.equal(forbiddenObl.status, 403);

    // 7. Obligations API: 201 Issue obligation
    const issueRes = await request('token-fin-a', '/api/finance/obligations', {
      method: 'POST',
      headers: { 'Idempotency-Key': `key-obl-http-${uid}` },
      body: {
        financialAccountId: accId,
        feeCatalogueItemId: feeItemId,
        beneficiaryPersonId: studentPerson,
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        notes: 'Obrigação HTTP Test',
      },
    });
    assert.equal(issueRes.status, 201);
    assert.equal(issueRes.body.status, 'open');
    assert.equal(issueRes.body.money.amount, '60');
    assert.equal(issueRes.body.money.currency, 'EUR');
    assert.equal(issueRes.body.feeCatalogueVersion, 1);
    const oblId = issueRes.body.id;

    // 8. Obligations API: 200 List obligations
    const listRes = await request('token-fin-a', '/api/finance/obligations');
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.some((o: any) => o.id === oblId));

    // 9. Obligations API: 200 Get single obligation
    const getRes = await request('token-fin-a', `/api/finance/obligations/${oblId}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.id, oblId);

    // 10. Obligations API: P1-06 Correction Law: in-place cancel route is removed (404)
    const cancelRes = await request('token-fin-a', `/api/finance/obligations/${oblId}/cancel`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `key-cancel-http-${uid}` },
      body: { reason: 'Anulado a pedido do encarregado de educação' },
    });
    assert.equal(cancelRes.status, 404, 'In-place cancel endpoint must not exist in F2-01');

    // 11. Cross-tenant isolation: Tenant B cannot access Tenant A obligation (404)
    const tenantBGet = await request('token-fin-b', `/api/finance/obligations/${oblId}`);
    assert.equal(tenantBGet.status, 404);

    console.log('Finance financial obligation HTTP tests: PASS');
  } finally {
    if (server) {
      server.closeAllConnections?.();
      server.close();
    }
    client.release();
    await pool.end();
  }
}

runTests().then(() => {
  process.exit(0);
}).catch((e) => {
  console.error('Test failure:', e);
  process.exit(1);
});
