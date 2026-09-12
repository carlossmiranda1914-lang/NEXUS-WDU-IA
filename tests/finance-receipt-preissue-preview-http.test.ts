import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { registerFinancialDocumentRoutes } from '../src/modules/finance/financial-document-http.ts';

test('receipt preview is tenant-derived, blocked, and has no issuance side effects', async () => {
  const writes: string[] = [];
  const pool: any = { query: async (sql: string, values: unknown[]) => {
    if (/insert|update|delete/i.test(sql)) writes.push(sql);
    if (values[0] !== 'tenant-a') return { rows: [] };
    if (sql.includes('FROM finance_payments')) return { rows: [{ payment_reference: 'PAY-100', effective_at: new Date('2026-09-12'), amount: '40.00', currency: 'AOA', status: 'confirmed' }] };
    if (sql.includes('finance_financial_document_series')) return { rows: [] };
    if (sql.includes('finance_profile_versions')) return { rows: [{ institution_id: 'tenant-a', version: 1, effective_from: new Date('2026-01-01'), effective_to: null, primary_jurisdiction: 'AO', functional_currency: 'AOA', financial_timezone: 'Africa/Luanda', monetary_policy_version: 'v1', enabled_currencies: ['AOA'] }] };
    if (sql.includes('institution_legal_profiles')) return { rows: [{ id: 'legal-a', institution_id: 'tenant-a', version: 1, legal_name: 'Escola A', tax_identifier: 'AO-1', registered_address: { countryCode: 'AO', line1: 'Rua A' }, legal_email: null, legal_phone: null, logo_asset_reference: null, effective_from: new Date('2026-01-01'), effective_to: null }] };
    return { rows: [] };
  } };
  const app = express(); const auth: any = (req: any, _res: any, next: any) => { if (req.header('Authorization') === 'Bearer admin') req.institutionalContext = { institutionId: 'tenant-a', role: 'institution_admin' }; next(); };
  registerFinancialDocumentRoutes(app, pool, auth); const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const response = await fetch(`${base}/api/finance/payments/payment-a/receipt-preview?institutionId=foreign&seriesId=forged`, { headers: { Authorization: 'Bearer admin' } });
    assert.equal(response.status, 200); const preview: any = await response.json();
    assert.equal(preview.documentType, 'receipt'); assert.equal(preview.sourceEligibility, 'BLOCKED');
    assert.equal(preview.readiness.status, 'BLOCKED'); assert.equal(preview.officialDocumentCreated, false); assert.equal(preview.definitiveNumberAllocated, false);
    assert.equal(preview.officialNumber, 'NOT_ALLOCATED'); assert.equal(preview.officialQrAvailable, false);
    assert.equal('documentId' in preview, false); assert.equal('snapshot' in preview, false); assert.equal('artifact' in preview, false);
    assert.deepEqual(writes, []);
  } finally { server.close(); }
});
