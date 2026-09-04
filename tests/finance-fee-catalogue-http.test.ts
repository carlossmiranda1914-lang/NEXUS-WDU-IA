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
    verifyIdToken: async (token) => ({ uid: token }),
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
          identityEmail: null,
          membershipId: randomUUID(),
          institutionId: mapping.institutionId,
          institutionName: 'Test Inst',
          institutionSlug: 'test-inst',
          role: mapping.role,
        },
      };
    },
  });

  const app = express();
  app.use(express.json());
  registerFeeCatalogueRoutes(app, pool, profiles, auth);

  server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = (token?: string, path = '/api/finance/fee-catalogue', init: RequestInit = {}) =>
    fetch(base + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });

  // 1. Unauthenticated & Missing Membership fail closed
  assert.equal((await request()).status, 401, 'No token must return 401');
  assert.equal((await request('missing')).status, 403, 'Missing membership must return 403');
  assert.equal((await request('unknown-token')).status, 403, 'Unknown token must return 403');

  // 2. Role Fencing: Non-permitted roles (secretariat) fail closed
  assert.equal((await request('token-sec-a')).status, 403, 'Secretariat read must be forbidden (403)');
  assert.equal(
    (await request('token-sec-a', '/api/finance/fee-catalogue', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'sec-k1' },
      body: JSON.stringify({ code: 'SEC', name: 'S', kind: 'fee', amount: '10.00', currency: 'EUR', effectiveFrom: new Date().toISOString() }),
    })).status,
    403,
    'Secretariat write must be forbidden (403)',
  );

  // 3. Director role: Read allowed (200), Write forbidden (403)
  assert.equal((await request('token-dir-a')).status, 200, 'Director read must succeed (200)');
  assert.equal(
    (await request('token-dir-a', '/api/finance/fee-catalogue', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'dir-k1' },
      body: JSON.stringify({ code: 'DIR', name: 'D', kind: 'fee', amount: '10.00', currency: 'EUR', effectiveFrom: new Date().toISOString() }),
    })).status,
    403,
    'Director write must be forbidden (403)',
  );

  // 4. Missing Idempotency-Key header on mutations returns 422
  assert.equal(
    (await request('token-fin-a', '/api/finance/fee-catalogue', {
      method: 'POST',
      body: JSON.stringify({ code: 'PROP', name: 'Propina', kind: 'tuition', amount: '100.00', currency: 'EUR', effectiveFrom: new Date().toISOString() }),
    })).status,
    422,
    'POST mutation without Idempotency-Key must return 422',
  );

  // 5. Validation error returns 422
  const invalidValRes = await request('token-fin-a', '/api/finance/fee-catalogue', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'val-err-1' },
    body: JSON.stringify({ code: 'PROP', name: 'Propina', kind: 'tuition', amount: '-10.00', currency: 'EUR', effectiveFrom: new Date().toISOString() }),
  });
  assert.equal(invalidValRes.status, 422, 'Negative amount must return 422');
  const invalidValBody = (await invalidValRes.json()) as { code: string };
  assert.equal(invalidValBody.code, 'FEE_CATALOGUE_VALIDATION');

  // 6. Positive Authorized Mutation reaching real PostgreSQL Fee Catalogue authority
  const baseDate = new Date(Date.now() - 86400000); // Yesterday
  const effectiveDate = baseDate.toISOString();
  const createPayload = {
    code: 'PROP-REG',
    name: 'Propina Regular',
    description: 'Propina anual regular',
    kind: 'tuition',
    amount: '100.0000',
    currency: 'EUR',
    effectiveFrom: effectiveDate,
  };

  const createRes = await request('token-fin-a', '/api/finance/fee-catalogue', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-create-k1' },
    body: JSON.stringify(createPayload),
  });

  assert.equal(createRes.status, 201, 'Successful creation must return 201');
  const createdItem = (await createRes.json()) as any;
  assert.equal(createdItem.code, 'PROP-REG');
  assert.equal(createdItem.currentVersion, 1);
  assert.equal(createdItem.status, 'active');
  assert.equal(createdItem.current.money.amount, '100');
  const itemId = createdItem.id;

  // Verify PostgreSQL physical authority state
  const dbItemRow = (await pool.query(`SELECT * FROM finance_fee_catalogue_items WHERE id = $1`, [itemId])).rows[0];
  assert.ok(dbItemRow, 'Item must exist in finance_fee_catalogue_items');
  assert.equal(dbItemRow.institution_id, institutionA);
  assert.equal(dbItemRow.current_version, 1);
  assert.equal(dbItemRow.status, 'active');

  const dbVersionRow = (await pool.query(`SELECT * FROM finance_fee_catalogue_versions WHERE item_id = $1 AND version = 1`, [itemId])).rows[0];
  assert.ok(dbVersionRow, 'Version 1 must exist in finance_fee_catalogue_versions');
  assert.equal(dbVersionRow.name, 'Propina Regular');
  assert.equal(Number(dbVersionRow.amount), 100);

  // 7. Idempotent Replay via HTTP
  const replayRes = await request('token-fin-a', '/api/finance/fee-catalogue', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-create-k1' },
    body: JSON.stringify(createPayload),
  });
  assert.equal(replayRes.status, 200, 'Idempotent replay must return 200');
  const replayedItem = (await replayRes.json()) as any;
  assert.equal(replayedItem.id, itemId);
  const itemCountAfterReplay = (await pool.query(`SELECT count(*)::int as c FROM finance_fee_catalogue_items WHERE institution_id = $1`, [institutionA])).rows[0].c;
  assert.equal(itemCountAfterReplay, 1, 'Replay must not create duplicate items');

  // 8. GET list & GET by ID
  const listRes = await request('token-fin-a', '/api/finance/fee-catalogue');
  assert.equal(listRes.status, 200);
  const listBody = (await listRes.json()) as any[];
  assert.equal(listBody.length, 1);
  assert.equal(listBody[0].id, itemId);

  const getRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}?history=true`);
  assert.equal(getRes.status, 200);
  const getBody = (await getRes.json()) as any;
  assert.equal(getBody.id, itemId);
  assert.equal(getBody.history?.length, 1);

  // 9. Characterization: Equal effectiveFrom on PUT returns HTTP 422 (never raw DB check constraint error)
  const equalDateRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'http-update-equal-k1' },
    body: JSON.stringify({
      name: 'Tentativa Data Igual',
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
  assert.ok(!equalDateBody.error.includes('check constraint'), 'Must not leak raw check constraint message');
  assert.ok(!equalDateBody.error.includes('relation "'), 'Must not leak database table name');

  // Characterization: Anterior effectiveFrom on PUT returns HTTP 422
  const anteriorDateRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'http-update-ant-k1' },
    body: JSON.stringify({
      name: 'Tentativa Data Anterior',
      kind: 'tuition',
      amount: '120.00',
      currency: 'EUR',
      effectiveFrom: new Date(baseDate.getTime() - 3600000).toISOString(), // Anterior to v1
      expectedVersion: 1,
    }),
  });
  assert.equal(anteriorDateRes.status, 422, 'Anterior effectiveFrom must return HTTP 422');
  const anteriorDateBody = (await anteriorDateRes.json()) as { code: string; error: string };
  assert.equal(anteriorDateBody.code, 'FEE_CATALOGUE_VALIDATION');
  assert.ok(!anteriorDateBody.error.includes('check constraint'));

  // Confirm database state untouched after 422 rejections
  const dbItemAfter422 = (await pool.query(`SELECT current_version FROM finance_fee_catalogue_items WHERE id = $1`, [itemId])).rows[0];
  assert.equal(dbItemAfter422.current_version, 1, 'Version must still be 1');

  // 10. Positive PUT Update with strictly posterior effectiveFrom reaching real PostgreSQL Fee Catalogue authority
  const posteriorEffective = new Date(baseDate.getTime() + 86400000).toISOString();
  const updatePayload = {
    name: 'Propina Regular Atualizada',
    description: 'Atualizada para 120 EUR',
    kind: 'tuition',
    amount: '120.00',
    currency: 'EUR',
    effectiveFrom: posteriorEffective,
    expectedVersion: 1,
  };

  const updateRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'http-update-k1' },
    body: JSON.stringify(updatePayload),
  });

  assert.equal(updateRes.status, 200, 'PUT update must return 200');
  const updatedItem = (await updateRes.json()) as any;
  assert.equal(updatedItem.currentVersion, 2);
  assert.equal(updatedItem.current.name, 'Propina Regular Atualizada');
  assert.equal(updatedItem.current.money.amount, '120');

  // Verify PostgreSQL updated authority state
  const dbItemUpdated = (await pool.query(`SELECT current_version FROM finance_fee_catalogue_items WHERE id = $1`, [itemId])).rows[0];
  assert.equal(dbItemUpdated.current_version, 2);

  const dbVersions = (await pool.query(`SELECT version, name, amount::text, effective_from, effective_to FROM finance_fee_catalogue_versions WHERE item_id = $1 ORDER BY version ASC`, [itemId])).rows;
  assert.equal(dbVersions.length, 2);
  assert.equal(dbVersions[0].version, 1);
  assert.equal(new Date(dbVersions[0].effective_to).toISOString(), posteriorEffective, 'v1 effective_to must match v2 effective_from');
  assert.equal(dbVersions[1].version, 2);
  assert.equal(dbVersions[1].name, 'Propina Regular Atualizada');
  assert.equal(dbVersions[1].effective_to, null);

  // 11. 409 Stale-Version Conflict through HTTP Boundary
  const staleUpdatePayload = {
    name: 'Tentativa Conflito',
    description: null,
    kind: 'tuition',
    amount: '130.00',
    currency: 'EUR',
    effectiveFrom: new Date(baseDate.getTime() + 2 * 86400000).toISOString(),
    expectedVersion: 1, // Stale! Current version is 2
  };

  const conflictRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'http-update-stale-k1' },
    body: JSON.stringify(staleUpdatePayload),
  });

  assert.equal(conflictRes.status, 409, 'Stale expectedVersion must return 409 Conflict');
  const conflictBody = (await conflictRes.json()) as { code: string; error: string };
  assert.equal(conflictBody.code, 'FEE_CATALOGUE_CONFLICT');

  // Verify PostgreSQL version was NOT incremented on 409 conflict
  const dbItemAfterConflict = (await pool.query(`SELECT current_version FROM finance_fee_catalogue_items WHERE id = $1`, [itemId])).rows[0];
  assert.equal(dbItemAfterConflict.current_version, 2, 'Version must remain 2 after conflict rejection');

  // 12. Lifecycle Actions (Deactivate & Activate) through HTTP Boundary
  const deactRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}/deactivate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-deact-k1' },
  });
  assert.equal(deactRes.status, 200);
  const deactBody = (await deactRes.json()) as any;
  assert.equal(deactBody.status, 'inactive');

  const dbItemDeact = (await pool.query(`SELECT status FROM finance_fee_catalogue_items WHERE id = $1`, [itemId])).rows[0];
  assert.equal(dbItemDeact.status, 'inactive');

  const actRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}/activate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-act-k1' },
  });
  assert.equal(actRes.status, 200);
  const actBody = (await actRes.json()) as any;
  assert.equal(actBody.status, 'active');

  const dbItemAct = (await pool.query(`SELECT status FROM finance_fee_catalogue_items WHERE id = $1`, [itemId])).rows[0];
  assert.equal(dbItemAct.status, 'active');

  // 13. Cross-Tenant Isolation: Tenant B attempting to read / mutate Tenant A resource fails closed (404)
  const tenantBGetRes = await request('token-fin-b', `/api/finance/fee-catalogue/${itemId}`);
  assert.equal(tenantBGetRes.status, 404, 'Tenant B GET on Tenant A resource must fail closed (404)');

  const tenantBListRes = await request('token-fin-b', '/api/finance/fee-catalogue');
  assert.equal(tenantBListRes.status, 200);
  const tenantBList = (await tenantBListRes.json()) as any[];
  assert.equal(tenantBList.length, 0, 'Tenant B list must be empty (cannot see Tenant A catalogue)');

  const tenantBPutRes = await request('token-fin-b', `/api/finance/fee-catalogue/${itemId}`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'http-tenantb-update-k1' },
    body: JSON.stringify({ ...updatePayload, effectiveFrom: new Date(baseDate.getTime() + 3 * 86400000).toISOString(), expectedVersion: 2 }),
  });
  assert.equal(tenantBPutRes.status, 404, 'Tenant B PUT on Tenant A resource must fail closed (404)');

  const tenantBDeactRes = await request('token-fin-b', `/api/finance/fee-catalogue/${itemId}/deactivate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-tenantb-deact-k1' },
  });
  assert.equal(tenantBDeactRes.status, 404, 'Tenant B deactivate on Tenant A resource must fail closed (404)');

  const tenantBActRes = await request('token-fin-b', `/api/finance/fee-catalogue/${itemId}/activate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'http-tenantb-act-k1' },
  });
  assert.equal(tenantBActRes.status, 404, 'Tenant B activate on Tenant A resource must fail closed (404)');

  // 14. Zero Journal / Projection Side Effects
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
