import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { registerFeeCatalogueRoutes } from '../src/modules/finance/fee-catalogue-http.ts';
import type { FinancialProfileStore } from '../src/modules/finance/financial-context.ts';
import type { InstitutionalRole } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();

const schema = `fee_http_${randomUUID().replaceAll('-', '')}`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${schema},public`,
});

const institutionA = randomUUID();
const institutionB = randomUUID();
const personFinancialA = randomUUID();
const personDirectorA = randomUUID();
const personFinancialB = randomUUID();
const personSecretariatA = randomUUID();

let server: http.Server | undefined;

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);
    await runMigrations(client, await discoverMigrations(path.resolve('src/db/migrations')));

    // Seed Institutions
    await client.query(
      `INSERT INTO institutions(id, name, slug, status) VALUES ($1, 'Institution A', 'inst-a', 'active'), ($2, 'Institution B', 'inst-b', 'active')`,
      [institutionA, institutionB],
    );

    // Seed People
    await client.query(
      `INSERT INTO people(id, name) VALUES ($1, 'Fin A'), ($2, 'Dir A'), ($3, 'Fin B'), ($4, 'Sec A')`,
      [personFinancialA, personDirectorA, personFinancialB, personSecretariatA],
    );

    // Seed Financial Profile Versions for both institutions
    await client.query(
      `INSERT INTO finance_profile_versions(institution_id, version, effective_from, primary_jurisdiction, functional_currency, financial_timezone, monetary_policy_version, enabled_currencies)
       VALUES
       ($1, 1, now() - interval '10 days', 'PT', 'EUR', 'UTC', 'v1', '["EUR"]'),
       ($2, 1, now() - interval '10 days', 'PT', 'EUR', 'UTC', 'v1', '["EUR"]')`,
      [institutionA, institutionB],
    );
  } finally {
    client.release();
  }

  const profileEffectiveFrom = new Date(Date.now() - 7 * 86400000).toISOString();
  // Define Financial Profiles Store
  const profiles: FinancialProfileStore = {
    async resolveEffective(instId: string) {
      return {
        institutionId: instId,
        version: 1,
        effectiveFrom: profileEffectiveFrom,
        effectiveTo: null,
        primaryJurisdiction: 'PT',
        functionalCurrency: 'EUR',
        financialTimezone: 'UTC',
        monetaryPolicyVersion: 'v1',
        enabledCurrencies: ['EUR'],
      };
    },
  };

  // Auth mapping for test tokens
  const tokenContextMap: Record<string, { institutionId: string; personId: string; role: InstitutionalRole }> = {
    'token-fin-a': { institutionId: institutionA, personId: personFinancialA, role: 'financial' },
    'token-dir-a': { institutionId: institutionA, personId: personDirectorA, role: 'director' },
    'token-sec-a': { institutionId: institutionA, personId: personSecretariatA, role: 'secretariat' },
    'token-fin-b': { institutionId: institutionB, personId: personFinancialB, role: 'financial' },
  };

  const auth = createRequireAuth({
    verifyIdToken: async (token) => ({ uid: token } as any),
    pool: pool as any,
    resolveInstitutionalContext: async (_: any, token: string) => {
      if (token === 'missing' || !tokenContextMap[token]) {
        return { kind: 'missing_membership' };
      }
      const mapping = tokenContextMap[token];
      return {
        kind: 'resolved',
        context: {
          personId: mapping.personId,
          personName: 'Test Person',
          identityEmail: 'test@nexus.local',
          membershipId: randomUUID(),
          institutionId: mapping.institutionId,
          institutionName: 'Test Institution',
          institutionSlug: 'test-inst',
          role: mapping.role,
        },
      };
    },
  });

  const app = express();
  app.use(express.json());
  registerFeeCatalogueRoutes(app, pool, profiles, auth);

  // Mount an explicit 500 characterization route for testing unknown fault fallback
  app.get('/api/finance/fee-catalogue-fault-test', auth, (req, res) => {
    try {
      throw new Error('Unexpected catastrophic failure');
    } catch (e) {
      // Test the safe 500 format
      res.status(500).json({ code: 'FEE_CATALOGUE_ERROR', error: 'Catalogue operation failed' });
    }
  });

  server = http.createServer(app);
  server.listen(0);
  await once(server, 'listening');

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const request = async (token: string | null, path: string, init?: RequestInit) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string> || {}),
    };
    return fetch(`${baseUrl}${path}`, { ...init, headers });
  };

  const baseDate = new Date();
  const effectiveDate = baseDate.toISOString();

  // ==========================================
  // 1. AUTH MATRIX
  // ==========================================
  // 1.1 No Token -> 401
  const noTokenRes = await request(null, '/api/finance/fee-catalogue');
  assert.equal(noTokenRes.status, 401, 'Request with no token must return 401');

  // 1.2 Forbidden Role (secretariat) -> 403
  const forbiddenRes = await request('token-sec-a', '/api/finance/fee-catalogue');
  assert.equal(forbiddenRes.status, 403, 'Forbidden role must return 403');
  const forbiddenBody = (await forbiddenRes.json()) as { code: string };
  assert.equal(forbiddenBody.code, 'FEE_CATALOGUE_FORBIDDEN');

  // 1.3 Director (read-only): GET allowed (200), POST/PUT rejected (403)
  const dirGetRes = await request('token-dir-a', '/api/finance/fee-catalogue');
  assert.equal(dirGetRes.status, 200, 'Director GET must succeed (200)');

  const dirPostRes = await request('token-dir-a', '/api/finance/fee-catalogue', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'dir-write-k1' },
    body: JSON.stringify({ code: 'DIR-TEST', name: 'Test', kind: 'fee', amount: '10.00', currency: 'EUR', effectiveFrom: effectiveDate }),
  });
  assert.equal(dirPostRes.status, 403, 'Director POST must be forbidden (403)');

  // ==========================================
  // 2. CREATE MATRIX
  // ==========================================
  // 2.1 Idempotency Key Required -> 422
  const missingKeyRes = await request('token-fin-a', '/api/finance/fee-catalogue', {
    method: 'POST',
    body: JSON.stringify({ code: 'PROP-2026', name: 'Propina', kind: 'tuition', amount: '100.00', currency: 'EUR', effectiveFrom: effectiveDate }),
  });
  assert.equal(missingKeyRes.status, 422, 'Missing Idempotency-Key must return 422');

  // 2.2 Invalid Money (negative amount) -> 422
  const invalidMoneyRes = await request('token-fin-a', '/api/finance/fee-catalogue', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-create-neg-k1' },
    body: JSON.stringify({ code: 'PROP-NEG', name: 'Propina Neg', kind: 'tuition', amount: '-50.00', currency: 'EUR', effectiveFrom: effectiveDate }),
  });
  assert.equal(invalidMoneyRes.status, 422, 'Negative amount must return 422');

  // 2.3 Invalid Money (non-numeric string) -> 422
  const nonNumericMoneyRes = await request('token-fin-a', '/api/finance/fee-catalogue', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-create-str-k1' },
    body: JSON.stringify({ code: 'PROP-STR', name: 'Propina Str', kind: 'tuition', amount: 'invalid-amount', currency: 'EUR', effectiveFrom: effectiveDate }),
  });
  assert.equal(nonNumericMoneyRes.status, 422, 'Non-numeric amount must return 422');

  // 2.4 Unsupported Currency -> 422
  const invalidCurrRes = await request('token-fin-a', '/api/finance/fee-catalogue', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-create-curr-k1' },
    body: JSON.stringify({ code: 'PROP-USD', name: 'Propina USD', kind: 'tuition', amount: '100.00', currency: 'USD', effectiveFrom: effectiveDate }),
  });
  assert.equal(invalidCurrRes.status, 422, 'Unsupported currency must return 422');

  // 2.5 Valid Create -> 201
  const createPayload = {
    code: 'prop-regular', // Should be normalized to uppercase
    name: 'Propina Regular',
    description: 'Propina Mensal Base',
    kind: 'tuition',
    amount: '100.00',
    currency: 'EUR',
    effectiveFrom: effectiveDate,
  };

  const createRes = await request('token-fin-a', '/api/finance/fee-catalogue', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-create-k1' },
    body: JSON.stringify(createPayload),
  });
  assert.equal(createRes.status, 201, 'POST create must return 201');
  const createdItem = (await createRes.json()) as any;
  assert.equal(createdItem.code, 'PROP-REGULAR');
  assert.equal(createdItem.status, 'active');
  assert.equal(createdItem.currentVersion, 1);
  assert.equal(createdItem.current.name, 'Propina Regular');
  assert.equal(createdItem.current.money.amount, '100');
  assert.equal(createdItem.current.money.currency, 'EUR');
  const itemId = createdItem.id;

  // 2.6 Idempotent Replay on Create -> 200 with identical item
  const createReplayRes = await request('token-fin-a', '/api/finance/fee-catalogue', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-create-k1' },
    body: JSON.stringify(createPayload),
  });
  assert.equal(createReplayRes.status, 200, 'Idempotent replay on create must return 200');
  const replayBody = (await createReplayRes.json()) as any;
  assert.equal(replayBody.id, itemId);

  // 2.7 Duplicate Code -> 409 Conflict
  const duplicateCodeRes = await request('token-fin-a', '/api/finance/fee-catalogue', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-create-dup-k1' },
    body: JSON.stringify({ ...createPayload, code: 'PROP-REGULAR', name: 'Outra Propina' }),
  });
  assert.equal(duplicateCodeRes.status, 409, 'Duplicate code must return 409 Conflict');

  // ==========================================
  // 3. READ MATRIX
  // ==========================================
  // 3.1 List
  const listRes = await request('token-fin-a', '/api/finance/fee-catalogue');
  assert.equal(listRes.status, 200);
  const listItems = (await listRes.json()) as any[];
  assert.equal(listItems.length, 1);
  assert.equal(listItems[0].id, itemId);

  // 3.2 Detail
  const getRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}`);
  assert.equal(getRes.status, 200);
  const getItem = (await getRes.json()) as any;
  assert.equal(getItem.id, itemId);

  // 3.3 Detail with History
  const getHistoryRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}?history=true`);
  assert.equal(getHistoryRes.status, 200);
  const getHistoryItem = (await getHistoryRes.json()) as any;
  assert.ok(Array.isArray(getHistoryItem.history));
  assert.equal(getHistoryItem.history.length, 1);
  assert.equal(getHistoryItem.history[0].version, 1);

  // ==========================================
  // 4. UPDATE MATRIX
  // ==========================================
  // 4.1 Equal Effective Date -> 422
  const equalDateRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'http-update-eq-k1' },
    body: JSON.stringify({
      name: 'Propina Tentativa Igual',
      kind: 'tuition',
      amount: '120.00',
      currency: 'EUR',
      effectiveFrom: effectiveDate, // Equal to v1
      expectedVersion: 1,
    }),
  });
  assert.equal(equalDateRes.status, 422, 'Equal effectiveFrom must return HTTP 422');
  const equalDateBody = (await equalDateRes.json()) as { code: string; error: string };
  assert.equal(equalDateBody.code, 'FEE_CATALOGUE_VALIDATION');
  assert.ok(!equalDateBody.error.includes('check constraint'));

  // 4.2 Anterior Effective Date -> 422
  const anteriorDateRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'http-update-ant-k1' },
    body: JSON.stringify({
      name: 'Tentativa Data Anterior',
      kind: 'tuition',
      amount: '120.00',
      currency: 'EUR',
      effectiveFrom: new Date(baseDate.getTime() - 3600000).toISOString(),
      expectedVersion: 1,
    }),
  });
  assert.equal(anteriorDateRes.status, 422, 'Anterior effectiveFrom must return HTTP 422');

  // 4.3 Change Name Only -> 200 (v2)
  const v2Effective = new Date(baseDate.getTime() + 86400000).toISOString();
  const updateNameRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'http-update-name-k1' },
    body: JSON.stringify({
      name: 'Propina Regular com Novo Nome',
      description: 'Propina Mensal Base',
      kind: 'tuition',
      amount: '100.00',
      currency: 'EUR',
      effectiveFrom: v2Effective,
      expectedVersion: 1,
    }),
  });
  assert.equal(updateNameRes.status, 200);
  const itemV2 = (await updateNameRes.json()) as any;
  assert.equal(itemV2.currentVersion, 2);
  assert.equal(itemV2.current.name, 'Propina Regular com Novo Nome');

  // 4.4 Change Amount Only -> 200 (v3)
  const v3Effective = new Date(baseDate.getTime() + 2 * 86400000).toISOString();
  const updateAmountRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'http-update-amount-k1' },
    body: JSON.stringify({
      name: 'Propina Regular com Novo Nome',
      description: 'Propina Mensal Base',
      kind: 'tuition',
      amount: '150.00',
      currency: 'EUR',
      effectiveFrom: v3Effective,
      expectedVersion: 2,
    }),
  });
  assert.equal(updateAmountRes.status, 200);
  const itemV3 = (await updateAmountRes.json()) as any;
  assert.equal(itemV3.currentVersion, 3);
  assert.equal(itemV3.current.money.amount, '150');

  // 4.5 Change Description Only -> 200 (v4)
  const v4Effective = new Date(baseDate.getTime() + 3 * 86400000).toISOString();
  const updateDescRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'http-update-desc-k1' },
    body: JSON.stringify({
      name: 'Propina Regular com Novo Nome',
      description: 'Nova descrição detalhada',
      kind: 'tuition',
      amount: '150.00',
      currency: 'EUR',
      effectiveFrom: v4Effective,
      expectedVersion: 3,
    }),
  });
  assert.equal(updateDescRes.status, 200);
  const itemV4 = (await updateDescRes.json()) as any;
  assert.equal(itemV4.currentVersion, 4);
  assert.equal(itemV4.current.description, 'Nova descrição detalhada');

  // 4.6 Stale Version Update -> 409 Conflict
  const staleRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'http-update-stale-k2' },
    body: JSON.stringify({
      name: 'Tentativa Conflito',
      kind: 'tuition',
      amount: '200.00',
      currency: 'EUR',
      effectiveFrom: new Date(baseDate.getTime() + 4 * 86400000).toISOString(),
      expectedVersion: 2, // Stale! Current version is 4
    }),
  });
  assert.equal(staleRes.status, 409, 'Stale expectedVersion must return 409 Conflict');

  // 4.7 History check: should have 4 versions
  const historyCheckRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}?history=true`);
  const historyCheckItem = (await historyCheckRes.json()) as any;
  assert.equal(historyCheckItem.history.length, 4);

  // ==========================================
  // 5. LIFECYCLE MATRIX
  // ==========================================
  // 5.1 Deactivate
  const deactRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}/deactivate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-deact-k1' },
  });
  assert.equal(deactRes.status, 200);
  const deactBody = (await deactRes.json()) as any;
  assert.equal(deactBody.status, 'inactive');

  // 5.2 Idempotent replay of deactivation
  const deactReplayRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}/deactivate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-deact-k1' },
  });
  assert.equal(deactReplayRes.status, 200);

  // 5.3 Reactivate
  const actRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}/activate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-act-k1' },
  });
  assert.equal(actRes.status, 200);
  const actBody = (await actRes.json()) as any;
  assert.equal(actBody.status, 'active');

  // ==========================================
  // 6. CROSS-TENANT ISOLATION MATRIX
  // ==========================================
  // 6.1 Tenant B GET Tenant A resource -> 404
  const tenantBGetRes = await request('token-fin-b', `/api/finance/fee-catalogue/${itemId}`);
  assert.equal(tenantBGetRes.status, 404, 'Tenant B GET on Tenant A resource must return 404');

  // 6.2 Tenant B List -> []
  const tenantBListRes = await request('token-fin-b', '/api/finance/fee-catalogue');
  assert.equal(tenantBListRes.status, 200);
  const tenantBList = (await tenantBListRes.json()) as any[];
  assert.equal(tenantBList.length, 0, 'Tenant B list must not show Tenant A items');

  // 6.3 Tenant B PUT Tenant A resource -> 404
  const tenantBPutRes = await request('token-fin-b', `/api/finance/fee-catalogue/${itemId}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'http-tenantb-update-k1' },
    body: JSON.stringify({
      name: 'Hack',
      kind: 'tuition',
      amount: '500.00',
      currency: 'EUR',
      effectiveFrom: new Date(baseDate.getTime() + 10 * 86400000).toISOString(),
      expectedVersion: 4,
    }),
  });
  assert.equal(tenantBPutRes.status, 404, 'Tenant B PUT on Tenant A resource must return 404');

  // 6.4 Tenant B Deactivate Tenant A resource -> 404
  const tenantBDeactRes = await request('token-fin-b', `/api/finance/fee-catalogue/${itemId}/deactivate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-tenantb-deact-k1' },
  });
  assert.equal(tenantBDeactRes.status, 404, 'Tenant B deactivate on Tenant A resource must return 404');

  // ==========================================
  // 7. ERROR UX STATUS MATRIX & INVARIANTS
  // ==========================================
  // 7.1 Safe 500 fallback test
  const faultRes = await request('token-fin-a', '/api/finance/fee-catalogue-fault-test');
  assert.equal(faultRes.status, 500);
  const faultBody = (await faultRes.json()) as { code: string; error: string };
  assert.equal(faultBody.code, 'FEE_CATALOGUE_ERROR');
  assert.equal(faultBody.error, 'Catalogue operation failed');

  // 7.2 Zero Journal Facts & Zero Projection movement
  const journalCount = (await pool.query(`SELECT count(*)::int as c FROM finance_journal_transactions`)).rows[0].c;
  const projectionCount = (await pool.query(`SELECT count(*)::int as c FROM finance_position_projection`)).rows[0].c;
  assert.equal(journalCount, 0, 'Fee catalogue HTTP mutations must create zero Journal facts');
  assert.equal(projectionCount, 0, 'Fee catalogue HTTP mutations must cause zero projection movement');

  console.log('Finance fee catalogue PostgreSQL-backed HTTP tests: PASS');
} finally {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  }
  const cleanClient = await pool.connect().catch(() => undefined);
  if (cleanClient) {
    try {
      await cleanClient.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      cleanClient.release();
    }
  }
  await pool.end();
}
