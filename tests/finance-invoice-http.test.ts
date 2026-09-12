import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { registerFinancialDocumentRoutes } from '../src/modules/finance/financial-document-http.ts';
import { createSyntheticUatFiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';

test('invoice preview derives all facts from the authenticated institution and never allocates a document number', async () => {
  const calls: unknown[][] = [];
  const pool: any = { query: async (sql: string, values: unknown[] = []) => {
    calls.push(values);
    if (sql.includes('clock_timestamp')) return { rows: [{ now: new Date('2026-09-12T10:00:00.000Z') }] };
    if (sql.includes("document_type='invoice'")) return { rows: [{ id: 'series-a', code: 'FT', next_sequence_number: '1' }] };
    if (sql.includes('FROM finance_obligations o')) return { rows: [{ id: 'obligation-a', financial_account_id: 'account-a', source_ref: 'OBR-1', name: 'Propina', amount: '100', currency: 'AOA', due_at: new Date('2026-10-12T00:00:00.000Z'), financial_profile_version: 1, beneficiary_person_id: null }] };
    if (sql.includes('SELECT beneficiary_person_id FROM finance_obligations')) return { rows: [{ beneficiary_person_id: null }] };
    if (sql.includes('finance_obligation_adjustments') || sql.includes('finance_obligation_discounts')) return { rows: [] };
    if (sql.includes('finance_fiscal_configuration_versions')) return { rows: [{ id: 'fiscal-a', version: 1, adapter_key: 'core' }] };
    if (sql.includes('finance_profile_versions')) return { rows: [{ primary_jurisdiction: 'NEXUS_TEST' }] };
    if (sql.includes('institution_legal_profiles')) return { rows: [{ id: 'legal-a', institution_id: 'tenant-a', version: 1, legal_name: 'Nexus Test', tax_identifier: 'AO500000001', registered_address: { countryCode: 'NEXUS_TEST', line1: 'Rua 1' }, effective_from: new Date('2026-01-01'), effective_to: null }] };
    if (sql.includes('finance_financial_account_parties')) return { rows: [{ person_id: 'person-a' }] };
    if (sql.includes('SELECT name FROM people')) return { rows: [{ name: 'Cliente' }] };
    return { rows: [] };
  } };
  const app = express();
  const auth: any = (req: any, _res: any, next: any) => { if (req.header('Authorization') === 'Bearer admin') req.institutionalContext = { institutionId: 'tenant-a', role: 'financial' }; next(); };
  registerFinancialDocumentRoutes(app, pool, auth, createSyntheticUatFiscalAdapterRegistry());
  const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    assert.equal((await fetch(`${base}/api/finance/obligations/obligation-a/invoice-preview`)).status, 401);
    const response = await fetch(`${base}/api/finance/obligations/obligation-a/invoice-preview?institutionId=foreign&seriesId=forged`, { headers: { Authorization: 'Bearer admin' } });
    assert.equal(response.status, 200); const preview: any = await response.json();
    assert.equal(preview.readiness.status, 'READY', JSON.stringify(preview));
    assert.equal(preview.documentType, 'invoice'); assert.equal(preview.officialDocumentCreated, false); assert.equal(preview.definitiveNumberAllocated, false); assert.equal(preview.obligation.amount, '100'); assert.deepEqual(preview.totals, { subtotal: '100', discountTotal: '0', taxTotal: '0', documentTotal: '100', currency: 'AOA' });
    assert.ok(calls.every(values => !values.includes('foreign') && !values.includes('forged')), 'browser values cannot select tenant or series authority');
    assert.doesNotMatch(calls.map(values => String(values)).join('|'), /UPDATE finance_financial_document_series|INSERT INTO finance_financial_documents/);
  } finally { server.close(); }
});
