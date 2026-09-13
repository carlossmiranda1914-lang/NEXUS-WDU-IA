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
    if (sql.includes('JOIN finance_fee_catalogue_versions')) return { rows: [{ id: 'obligation-a', financial_account_id: 'account-a', source_ref: 'OBR-1', name: 'Propina', amount: '100', currency: 'AOA', due_at: new Date('2026-10-12T00:00:00.000Z'), financial_profile_version: 1, beneficiary_person_id: null }] };
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
    assert.equal(preview.documentType, 'invoice'); assert.equal(preview.officialDocumentCreated, false); assert.equal(preview.definitiveNumberAllocated, false); assert.equal(preview.documentFacts.totals.documentTotal, '100'); assert.deepEqual(preview.documentFacts.totals, { subtotal: '100', discountTotal: '0', taxTotal: '0', documentTotal: '100', currency: 'AOA' });
    assert.ok(calls.every(values => !values.includes('foreign') && !values.includes('forged')), 'browser values cannot select tenant or series authority');
    assert.doesNotMatch(calls.map(values => String(values)).join('|'), /UPDATE finance_financial_document_series|INSERT INTO finance_financial_documents/);
  } finally { server.close(); }
});

test('blocked invoice readiness retains tenant-scoped documentary facts without allocating an official document', async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const pool: any = { query: async (sql: string, values: unknown[] = []) => {
    calls.push({ sql, values });
    if (sql.includes('clock_timestamp')) return { rows: [{ now: new Date('2026-09-12T10:00:00.000Z') }] };
    if (sql.includes("document_type='invoice'")) return { rows: [] };
    if (sql.includes('JOIN finance_fee_catalogue_versions')) return { rows: [{ id: 'obligation-a', financial_account_id: 'account-a', source_ref: 'OBR-2026-001', name: 'Propina Outubro', amount: '100', currency: 'AOA', due_at: new Date('2026-10-08T00:00:00.000Z'), financial_profile_version: 1, beneficiary_person_id: null }] };
    if (sql.includes('finance_obligation_adjustments') || sql.includes('finance_obligation_discounts')) return { rows: [] };
    if (sql.includes('SELECT beneficiary_person_id FROM finance_obligations')) return { rows: [{ beneficiary_person_id: null }] };
    if (sql.includes('institution_legal_profiles')) return { rows: [{ id: 'legal-a', institution_id: 'tenant-a', version: 1, legal_name: 'Escola Nexus', tax_identifier: 'AO500000001', registered_address: { countryCode: 'AO', line1: 'Rua 1' }, effective_from: new Date('2026-01-01'), effective_to: null }] };
    if (sql.includes('finance_financial_account_parties')) return { rows: [{ person_id: 'person-a' }] };
    if (sql.includes('SELECT name FROM people')) return { rows: [{ name: 'Família Silva' }] };
    return { rows: [] };
  } };
  const app = express();
  const auth: any = (req: any, _res: any, next: any) => { if (req.header('Authorization') === 'Bearer admin') req.institutionalContext = { institutionId: 'tenant-a', role: 'financial' }; next(); };
  registerFinancialDocumentRoutes(app, pool, auth, createSyntheticUatFiscalAdapterRegistry());
  const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const response = await fetch(`${base}/api/finance/obligations/obligation-a/invoice-preview`, { headers: { Authorization: 'Bearer admin' } });
    assert.equal(response.status, 200);
    const preview: any = await response.json();
    assert.equal(preview.sourceEligibility, 'ELIGIBLE');
    assert.equal(preview.readiness.status, 'BLOCKED');
    assert.equal(preview.readiness.reasonCode, 'INVOICE_SERIES_NOT_EFFECTIVE');
    assert.deepEqual(preview.documentFacts.obligation, { reference: 'OBR-2026-001', dueAt: '2026-10-08T00:00:00.000Z', description: 'Propina Outubro', currency: 'AOA' });
    assert.equal(preview.documentFacts.totals.documentTotal, '100');
    assert.equal(preview.documentFacts.issuer.legalName, 'Escola Nexus');
    assert.equal(preview.documentFacts.recipient.name, 'Família Silva');
    assert.equal(preview.officialDocumentCreated, false);
    assert.equal(preview.definitiveNumberAllocated, false);
    assert.doesNotMatch(calls.map(call => call.sql).join('\n'), /UPDATE finance_financial_document_series|INSERT INTO finance_financial_documents/);
  } finally { server.close(); }
});

test('partial invoice preview fails closed across tenants and localizes missing issuer or recipient facts', async () => {
  const previewFor = async (mode: 'foreign' | 'issuer-missing' | 'recipient-missing') => {
    const pool: any = { query: async (sql: string) => {
      if (sql.includes('clock_timestamp')) return { rows: [{ now: new Date('2026-09-12T10:00:00.000Z') }] };
      if (sql.includes("document_type='invoice'")) return { rows: mode === 'foreign' ? [] : [{ id: 'series-a', code: 'FT', next_sequence_number: '1' }] };
      if (sql.includes('JOIN finance_fee_catalogue_versions')) return { rows: mode === 'foreign' ? [] : [{ id: 'obligation-a', financial_account_id: 'account-a', source_ref: 'OBR-2026-001', name: 'Propina Outubro', amount: '100', currency: 'AOA', due_at: new Date('2026-10-08T00:00:00.000Z'), financial_profile_version: 1, beneficiary_person_id: null }] };
      if (sql.includes('finance_obligation_adjustments') || sql.includes('finance_obligation_discounts')) return { rows: [] };
      if (sql.includes('SELECT beneficiary_person_id FROM finance_obligations')) return { rows: [{ beneficiary_person_id: null }] };
      if (sql.includes('institution_legal_profiles')) return { rows: mode === 'issuer-missing' ? [] : [{ id: 'legal-a', institution_id: 'tenant-a', version: 1, legal_name: 'Escola Nexus', tax_identifier: 'AO500000001', registered_address: { countryCode: 'AO', line1: 'Rua 1' }, effective_from: new Date('2026-01-01'), effective_to: null }] };
      if (sql.includes('finance_fiscal_configuration_versions')) return { rows: [{ id: 'fiscal-a', version: 1, adapter_key: 'core' }] };
      if (sql.includes('finance_profile_versions')) return { rows: [{ primary_jurisdiction: 'NEXUS_TEST' }] };
      if (sql.includes('finance_financial_account_parties')) return { rows: mode === 'recipient-missing' ? [] : [{ person_id: 'person-a' }] };
      if (sql.includes('SELECT name FROM people')) return { rows: [{ name: 'Família Silva' }] };
      return { rows: [] };
    } };
    const app = express(); const auth: any = (req: any, _res: any, next: any) => { if (req.header('Authorization') === 'Bearer admin') req.institutionalContext = { institutionId: 'tenant-a', role: 'financial' }; next(); };
    registerFinancialDocumentRoutes(app, pool, auth, createSyntheticUatFiscalAdapterRegistry());
    const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    try { return await (await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/finance/obligations/${mode === 'foreign' ? 'foreign-obligation' : 'obligation-a'}/invoice-preview`, { headers: { Authorization: 'Bearer admin' } })).json() as any; } finally { server.close(); }
  };
  const foreign = await previewFor('foreign');
  assert.equal(foreign.sourceEligibility, 'BLOCKED');
  assert.equal(foreign.documentFacts, null);
  const issuerMissing = await previewFor('issuer-missing');
  assert.equal(issuerMissing.documentFacts.obligation.reference, 'OBR-2026-001');
  assert.equal(issuerMissing.documentFacts.issuer, null);
  assert.equal(issuerMissing.readiness.reasonCode, 'INSTITUTION_LEGAL_PROFILE_REQUIRED');
  const recipientMissing = await previewFor('recipient-missing');
  assert.equal(recipientMissing.documentFacts.obligation.reference, 'OBR-2026-001');
  assert.equal(recipientMissing.documentFacts.issuer.legalName, 'Escola Nexus');
  assert.equal(recipientMissing.documentFacts.recipient, null);
  assert.equal(recipientMissing.readiness.reasonCode, 'DOCUMENT_RECIPIENT_REQUIRED');
});
