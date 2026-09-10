import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { registerFinanceReadinessRoutes } from '../src/modules/finance/finance-readiness-http.ts';

test('Finance readiness HTTP derives only the resolved tenant and existing capabilities', async () => {
  const calls: unknown[][] = [];
  const pool: any = { query: async (sql: string, values: unknown[]) => {
    calls.push(values);
    const tenant = values[0];
    if (tenant === 'foreign') return { rows: [] };
    if (sql.includes('finance_profile_versions')) return { rows: [{ institution_id: 'tenant-a', version: 1, effective_from: new Date('2026-01-01'), effective_to: null, primary_jurisdiction: 'NEXUS_TEST', functional_currency: 'EUR', financial_timezone: 'Europe/Lisbon', monetary_policy_version: 'v1', enabled_currencies: ['EUR'] }] };
    if (sql.includes('finance_fiscal_configuration_versions')) return { rows: [{ id: 'fiscal-a', institution_id: 'tenant-a', version: 1, adapter_key: 'core', operational_configuration: {}, effective_from: new Date('2026-01-01'), effective_to: null }] };
    if (sql.includes('finance_financial_document_series')) return { rows: [] };
    return { rows: [] };
  } };
  const app = express();
  const auth: any = (req: any, _res: any, next: any) => { if (req.header('Authorization') === 'Bearer admin') req.institutionalContext = { institutionId: 'tenant-a', role: 'institution_admin' }; if (req.header('Authorization') === 'Bearer reader') req.institutionalContext = { institutionId: 'tenant-a', role: 'director' }; if (req.header('Authorization') === 'Bearer denied') req.institutionalContext = { institutionId: 'tenant-a', role: 'teacher' }; next(); };
  registerFinanceReadinessRoutes(app, pool, auth);
  const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as any).port}/api/finance/readiness`;
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { headers: { Authorization: 'Bearer denied' } })).status, 403);
    const admin = await fetch(`${base}?institutionId=foreign`, { headers: { Authorization: 'Bearer admin' } });
    assert.equal(admin.status, 200);
    assert.deepEqual(await admin.json(), { module: 'FINANCE', status: 'INCOMPLETE', requirements: [{ code: 'FINANCIAL_PROFILE', state: 'COMPLETE' }, { code: 'FISCAL_CONFIGURATION', state: 'COMPLETE' }, { code: 'RECEIPT_SERIES', state: 'MISSING' }], canManageConfiguration: true });
    const reader = await fetch(base, { headers: { Authorization: 'Bearer reader' } });
    assert.equal((await reader.json()).canManageConfiguration, false);
    assert.ok(calls.every(values => values.includes('tenant-a')), 'readiness must use only the server-derived institution');
  } finally { server.close(); }
});
