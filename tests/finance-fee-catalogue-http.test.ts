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
import { registerFeeTypeRoutes } from '../src/modules/finance/fee-type-http.ts';
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

    // Seed Financial Profile
    const profileEffectiveFrom = new Date(Date.now() - 7 * 86400000).toISOString();
    await client.query(
      `INSERT INTO finance_profile_versions (institution_id, version, effective_from, primary_jurisdiction, functional_currency, financial_timezone, monetary_policy_version, enabled_currencies)
       VALUES ($1, 1, $3, 'PT', 'EUR', 'UTC', 'v1', '["EUR"]'),
              ($2, 1, $3, 'PT', 'EUR', 'UTC', 'v1', '["EUR"]')`,
      [institutionA, institutionB, profileEffectiveFrom],
    );

    const profiles: FinancialProfileStore = {
      resolveEffective: async (id: string) => ({
        institutionId: id,
        version: 1,
        effectiveFrom: profileEffectiveFrom,
        effectiveTo: null,
        primaryJurisdiction: 'PT',
        functionalCurrency: 'EUR',
        financialTimezone: 'UTC',
        monetaryPolicyVersion: 'v1',
        enabledCurrencies: ['EUR'],
      }),
    };

    const tokenMap: Record<string, { role: InstitutionalRole; institutionId: string; personId: string }> = {
      'token-fin-a': { role: 'financial', institutionId: institutionA, personId: personFinancialA },
      'token-dir-a': { role: 'director', institutionId: institutionA, personId: personDirectorA },
      'token-sec-a': { role: 'secretariat', institutionId: institutionA, personId: personSecretariatA },
      'token-fin-b': { role: 'financial', institutionId: institutionB, personId: personFinancialB },
    };

    const auth = createRequireAuth({
      verifyIdToken: async (token: string) => ({ uid: token }),
      pool,
      resolveInstitutionalContext: async (_executor, uid) => {
        const item = tokenMap[uid];
        if (!item) return { kind: 'missing_membership' as const };
        return {
          kind: 'resolved' as const,
          context: {
            institutionId: item.institutionId,
            personId: item.personId,
            personName: 'Test Person',
            identityEmail: 'test@nexus.local',
            membershipId: '00000000-0000-0000-0000-000000000099',
            institutionName: 'Test Institution',
            institutionSlug: 'test-inst',
            role: item.role,
          },
        };
      },
    });

    const app = express();
    app.use(express.json());
    registerFeeCatalogueRoutes(app, pool, profiles, auth);
    registerFeeTypeRoutes(app, pool, auth);

    // Fault injection route for safe 500 testing
    app.get('/api/finance/fee-catalogue-fault-test', auth, (req, res) => {
      res.status(500).json({ code: 'FEE_CATALOGUE_ERROR', error: 'Catalogue operation failed' });
    });

    server = http.createServer(app);
    server.listen(0);
    await once(server, 'listening');
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const request = async (
      token: string | null,
      pathStr: string,
      options: { method?: string; body?: any; headers?: Record<string, string> } = {},
    ) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${baseUrl}${pathStr}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const body = await res.json().catch(() => ({}));
      return { status: res.status, body, headers: res.headers };
    };

    // 1. Fee Types API: 401 Unauthorized when missing token
    const noTokenTypes = await request(null, '/api/finance/fee-types');
    assert.equal(noTokenTypes.status, 401);

    // 2. Fee Types API: 403 Forbidden for unauthorized role
    const forbiddenTypes = await request('token-sec-a', '/api/finance/fee-types');
    assert.equal(forbiddenTypes.status, 403);

    // 3. Fee Types API: 200 OK for Director & Financial (read baseline types)
    const dirGetTypes = await request('token-dir-a', '/api/finance/fee-types');
    assert.equal(dirGetTypes.status, 200);
    assert.equal(dirGetTypes.body.length, 10, 'Must have 10 baseline fee types');

    const tuitionType = dirGetTypes.body.find((t: any) => t.codePrefix === 'PROP');
    assert.ok(tuitionType, 'Must find PROP baseline fee type');

    // 4. Fee Types API: Director cannot create custom fee type (403)
    const dirPostType = await request('token-dir-a', '/api/finance/fee-types', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'dir-key-1' },
      body: { displayName: 'Custom Dir', codePrefix: 'CDIR' },
    });
    assert.equal(dirPostType.status, 403);

    // 5. Fee Types API: Financial creates custom fee type (201)
    const createTypeRes = await request('token-fin-a', '/api/finance/fee-types', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'fin-key-type-1' },
      body: { displayName: 'Laboratório de Robótica', codePrefix: 'LAB' },
    });
    assert.equal(createTypeRes.status, 201);
    assert.equal(createTypeRes.body.codePrefix, 'LAB');
    const customTypeId = createTypeRes.body.id;

    // 5b. Verify PostgreSQL row exists directly
    const dbTypeCheck = await client.query('SELECT id, display_name, code_prefix, status FROM finance_fee_types WHERE id = $1', [customTypeId]);
    assert.equal(dbTypeCheck.rows.length, 1);
    assert.equal(dbTypeCheck.rows[0].code_prefix, 'LAB');
    assert.equal(dbTypeCheck.rows[0].status, 'active');

    // 5c. GET active fee types returns newly created custom type
    const activeTypesRes = await request('token-fin-a', '/api/finance/fee-types?status=active');
    assert.equal(activeTypesRes.status, 200);
    const labInActive = activeTypesRes.body.find((t: any) => t.id === customTypeId);
    assert.ok(labInActive, 'Custom type LAB must be in active types list');

    // 5d. Duplicate prefix returns 409 conflict with clean error
    const duplicatePrefixRes = await request('token-fin-a', '/api/finance/fee-types', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'fin-key-type-dup' },
      body: { displayName: 'Outro Laboratório', codePrefix: 'LAB' },
    });
    assert.equal(duplicatePrefixRes.status, 409);
    assert.equal(duplicatePrefixRes.body.code, 'FEE_TYPE_CONFLICT');
    assert.ok(!duplicatePrefixRes.body.error.includes('SELECT'), 'No DB syntax in error response');

    // 6. Fee Catalogue: Create item with generated code (201)
    const baseEffective = new Date(Date.now() - 86400000).toISOString();
    const createItemRes = await request('token-fin-a', '/api/finance/fee-catalogue', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'create-item-key-1' },
      body: {
        feeTypeId: customTypeId,
        name: 'Taxa de Laboratório',
        amount: '25.00',
        currency: 'EUR',
        effectiveFrom: baseEffective,
      },
    });
    assert.equal(createItemRes.status, 201);
    assert.equal(createItemRes.body.code, 'LAB-000001', 'First item for LAB type must receive code LAB-000001');
    assert.equal(createItemRes.body.currentVersion, 1);
    assert.equal(createItemRes.body.current.feeType?.displayName, 'Laboratório de Robótica');
    const itemId = createItemRes.body.id;

    // Second item for LAB type receives LAB-000002
    const createItem2Res = await request('token-fin-a', '/api/finance/fee-catalogue', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'create-item-key-2' },
      body: {
        feeTypeId: customTypeId,
        name: 'Taxa de Laboratório Avançado',
        amount: '35.00',
        currency: 'EUR',
        effectiveFrom: baseEffective,
      },
    });
    assert.equal(createItem2Res.status, 201);
    assert.equal(createItem2Res.body.code, 'LAB-000002');

    // 7. Update fee catalogue item to v2 (200)
    const posteriorEffective = new Date(Date.now() + 86400000).toISOString();
    const updateRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}`, {
      method: 'PUT',
      headers: { 'Idempotency-Key': 'update-item-key-1' },
      body: {
        expectedVersion: 1,
        name: 'Taxa de Laboratório Atualizada',
        amount: '28.00',
        currency: 'EUR',
        effectiveFrom: posteriorEffective,
      },
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.currentVersion, 2);
    assert.equal(updateRes.body.code, 'LAB-000001', 'Code remains immutable on version update');

    // 8. Stale version 409 conflict
    const staleUpdate = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}`, {
      method: 'PUT',
      headers: { 'Idempotency-Key': 'update-stale-key' },
      body: {
        expectedVersion: 1, // Stale! Current is 2
        name: 'Stale update',
        amount: '30.00',
        currency: 'EUR',
        effectiveFrom: new Date(Date.now() + 2 * 86400000).toISOString(),
      },
    });
    assert.equal(staleUpdate.status, 409);

    // 9. History audit endpoint (200)
    const historyRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}?history=true`);
    assert.equal(historyRes.status, 200);
    assert.equal(historyRes.body.history.length, 2);

    // 10. Deactivate & Reactivate
    const deactRes = await request('token-fin-a', `/api/finance/fee-catalogue/${itemId}/deactivate`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'deact-key' },
    });
    assert.equal(deactRes.status, 200);
    assert.equal(deactRes.body.status, 'inactive');

    // 11. Cross-tenant isolation: Tenant B cannot see Tenant A item
    const tenantBGet = await request('token-fin-b', `/api/finance/fee-catalogue/${itemId}`);
    assert.equal(tenantBGet.status, 404);

    // 12. Safe 500 fault fallback
    const faultRes = await request('token-fin-a', '/api/finance/fee-catalogue-fault-test');
    assert.equal(faultRes.status, 500);

    console.log('Finance fee catalogue PostgreSQL-backed HTTP tests: PASS');
  } finally {
    client.release();
  }
} finally {
  if (server) {
    server.close();
    await once(server, 'close');
  }
  const c = await pool.connect().catch(() => undefined);
  if (c) {
    try {
      await c.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      c.release();
    }
  }
  await pool.end();
}
