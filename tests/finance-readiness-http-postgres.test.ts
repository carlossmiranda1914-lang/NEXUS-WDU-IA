import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { registerFinanceReadinessRoutes } from '../src/modules/finance/finance-readiness-http.ts';
import { createSyntheticUatFiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';

test('Finance readiness HTTP derives only the resolved tenant and existing capabilities', async () => {
  const calls: unknown[][] = [];
  const pool: any = { query: async (sql: string, values: unknown[]) => {
    calls.push(values);
    const tenant = values[0];
    if (tenant === 'foreign') return { rows: [] };
    if (sql.includes('institution_legal_profiles')) return { rows: [{ id: 'legal-a', institution_id: 'tenant-a', version: 1, legal_name: 'Tenant A', tax_identifier: null, registered_address: { countryCode: 'NEXUS_TEST', line1: 'Rua' }, legal_email: null, legal_phone: null, logo_asset_reference: null, effective_from: new Date('2026-01-01'), effective_to: null }] };
    if (sql.includes('finance_profile_versions')) return { rows: [{ institution_id: 'tenant-a', version: 1, effective_from: new Date('2026-01-01'), effective_to: null, primary_jurisdiction: 'NEXUS_TEST', functional_currency: 'EUR', financial_timezone: 'Europe/Lisbon', monetary_policy_version: 'v1', enabled_currencies: ['EUR'] }] };
    if (sql.includes('finance_fiscal_configuration_versions')) return { rows: [{ id: 'fiscal-a', institution_id: 'tenant-a', version: 1, adapter_key: 'core', operational_configuration: {}, effective_from: new Date('2026-01-01'), effective_to: null }] };
    if (sql.includes('finance_financial_document_series')) return { rows: [] };
    return { rows: [] };
  } };
  const app = express();
  const auth: any = (req: any, _res: any, next: any) => { if (req.header('Authorization') === 'Bearer admin') req.institutionalContext = { institutionId: 'tenant-a', role: 'institution_admin' }; if (req.header('Authorization') === 'Bearer reader') req.institutionalContext = { institutionId: 'tenant-a', role: 'director' }; if (req.header('Authorization') === 'Bearer denied') req.institutionalContext = { institutionId: 'tenant-a', role: 'teacher' }; next(); };
  registerFinanceReadinessRoutes(app, pool, auth, createSyntheticUatFiscalAdapterRegistry());
  const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as any).port}/api/finance/readiness`;
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { headers: { Authorization: 'Bearer denied' } })).status, 403);
    const admin = await fetch(`${base}?institutionId=foreign`, { headers: { Authorization: 'Bearer admin' } });
    assert.equal(admin.status, 200);
    const readiness: any = await admin.json();
    assert.equal(readiness.status, 'INCOMPLETE');
    assert.equal(readiness.localPrerequisitesComplete, true);
    assert.equal(readiness.jurisdictionPolicyAvailable, true);
    assert.equal(readiness.receiptIssuance.reasonCode, 'FINANCE_MODULE_NOT_READY');
    assert.deepEqual(readiness.requirements.map((item: any) => [item.code, item.state]), [['INSTITUTION_LEGAL_PROFILE', 'COMPLETE'], ['FINANCIAL_PROFILE', 'COMPLETE'], ['FISCAL_CONFIGURATION', 'COMPLETE'], ['RECEIPT_SERIES', 'MISSING']]);
    const reader = await fetch(base, { headers: { Authorization: 'Bearer reader' } });
    assert.equal((await reader.json()).canManageConfiguration, false);
    assert.ok(calls.every(values => values.includes('tenant-a')), 'readiness must use only the server-derived institution');
  } finally { server.close(); }
});

test('per-document Angola readiness derives tenant facts and ignores browser readiness claims', async () => {
  const calls: unknown[][] = [];
  const pool: any = { query: async (sql: string, values: unknown[]) => {
    calls.push(values);
    if (values[0] !== 'tenant-a') return { rows: [] };
    if (sql.includes('institution_legal_profiles')) return { rows: [{ id: 'legal-a', institution_id: 'tenant-a', version: 1, legal_name: 'Tenant A', tax_identifier: 'AO-123', registered_address: { countryCode: 'AO', line1: 'Rua' }, legal_email: null, legal_phone: null, logo_asset_reference: null, effective_from: new Date('2026-01-01'), effective_to: null }] };
    if (sql.includes('finance_profile_versions')) return { rows: [{ institution_id: 'tenant-a', version: 1, effective_from: new Date('2026-01-01'), effective_to: null, primary_jurisdiction: 'AO', functional_currency: 'AOA', financial_timezone: 'Africa/Luanda', monetary_policy_version: 'v1', enabled_currencies: ['AOA'] }] };
    if (sql.includes('finance_fiscal_configuration_versions')) return { rows: [{ id: 'fiscal-a', institution_id: 'tenant-a', version: 1, adapter_key: 'angola-production', operational_configuration: { agtOnboarding: true }, effective_from: new Date('2026-01-01'), effective_to: null }] };
    if (sql.includes('finance_financial_document_series')) return { rows: [{ id: 'series-a', institution_id: 'tenant-a', code: 'FT', document_type: 'invoice', fiscal_configuration_id: 'fiscal-a' }] };
    return { rows: [] };
  } };
  const app = express();
  const auth: any = (req: any, _res: any, next: any) => { if (req.header('Authorization') === 'Bearer admin') req.institutionalContext = { institutionId: 'tenant-a', role: 'institution_admin' }; next(); };
  registerFinanceReadinessRoutes(app, pool, auth);
  const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as any).port}/api/finance/readiness/documents/invoice`;
    const response = await fetch(`${base}?institutionId=foreign&agtOnboarding=true&signingMaterial=true`, { headers: { Authorization: 'Bearer admin' } });
    assert.equal(response.status, 200);
    const readiness: any = await response.json();
    assert.deepEqual([readiness.status, readiness.reasonCode], ['BLOCKED', 'AGT_ONBOARDING_REQUIRED']);
    assert.equal(readiness.prerequisites.agtOnboarding, false, 'client parameters and browser-writable config cannot grant AGT authority');
    assert.ok(calls.every(values => values.includes('tenant-a')), 'per-document readiness must query only the server-derived tenant');
  } finally { server.close(); }
});
