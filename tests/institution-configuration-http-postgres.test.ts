import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import pg from 'pg';
import test from 'node:test';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { registerInstitutionConfigurationRoutes } from '../src/modules/institution/institution-configuration-http.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

test('institution configuration APIs derive tenant authority and append effective profile versions', async () => {
  await verifyApprovedTestConnection();
  const schema = `institution_configuration_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
  let server: http.Server | undefined;
  try {
    const institutionA = randomUUID(), institutionB = randomUUID();
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(path.resolve(process.cwd(), 'src/db/migrations')));
      await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','configuration-a','active'),($2,'B','configuration-b','active')", [institutionA, institutionB]);
    } finally { client.release(); }
    const app = express(); app.use(express.json());
    const auth: any = (req: any, _res: any, next: any) => { const token = req.header('Authorization'); if (token === 'Bearer admin-a') req.institutionalContext = { institutionId: institutionA, role: 'institution_admin' }; if (token === 'Bearer director-a') req.institutionalContext = { institutionId: institutionA, role: 'director' }; if (token === 'Bearer admin-b') req.institutionalContext = { institutionId: institutionB, role: 'institution_admin' }; next(); };
    registerInstitutionConfigurationRoutes(app, pool, auth); server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const request = (path: string, token: string, body?: unknown) => fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const legal = { legalName: 'Nexus A', taxIdentifier: 'A-1', registeredAddress: { countryCode: 'AO', line1: 'Rua A' }, effectiveFrom: '2026-09-01T00:00:00.000Z', institutionId: institutionB };
    assert.equal((await request('/api/institution/legal-profile', 'admin-a', legal)).status, 201);
    assert.equal((await request('/api/institution/legal-profile', 'director-a', legal)).status, 403);
    assert.equal((await request('/api/institution/legal-profile', 'admin-b')).status, 200);
    assert.equal((await pool.query('SELECT count(*)::int count FROM institution_legal_profiles WHERE institution_id=$1', [institutionA])).rows[0]?.count, 1, 'browser foreign institution input must be ignored');
    const financial = { primaryJurisdiction: 'AO', functionalCurrency: 'AOA', financialTimezone: 'Africa/Luanda', monetaryPolicyVersion: 'v1', enabledCurrencies: ['AOA'], effectiveFrom: '2026-09-01T00:00:00.000Z', institutionId: institutionB };
    assert.equal((await request('/api/finance/profile', 'admin-a', financial)).status, 201);
    assert.equal((await request('/api/finance/profile', 'director-a', financial)).status, 403);
    const later = { ...financial, monetaryPolicyVersion: 'v2', effectiveFrom: '2026-10-01T00:00:00.000Z' };
    assert.equal((await request('/api/finance/profile', 'admin-a', later)).status, 201);
    const versions = await pool.query<{ version: number; effective_to: Date | null }>('SELECT version,effective_to FROM finance_profile_versions WHERE institution_id=$1 ORDER BY version', [institutionA]);
    assert.equal(versions.rows.length, 2);
    assert.equal(versions.rows[0]?.version, 1); assert.notEqual(versions.rows[0]?.effective_to, null);
    assert.equal((await request('/api/finance/profile', 'admin-a', { ...financial, effectiveFrom: '2026-09-15T00:00:00.000Z' })).status, 422, 'backdated overlap must be rejected before it can create a competing effective profile');
    assert.equal((await pool.query('SELECT count(*)::int count FROM finance_profile_versions WHERE institution_id=$1', [institutionB])).rows[0]?.count, 0);
  } finally { if (server) await new Promise<void>(resolve => server!.close(() => resolve())); await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});
