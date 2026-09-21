import assert from 'node:assert/strict';
import test from 'node:test';
import { productionFiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';
import { resolveAngolaDocumentCapability } from '../src/modules/finance/jurisdictions/angola/angola-document-policy.ts';

const effectiveDate = new Date('2026-09-12T00:00:00.000Z');
const allExternalInputs = {
  institutionFacts: true,
  agtOnboarding: true,
  signingMaterial: true,
  productionSeries: true,
} as const;

test('Angola policy resolves every approved document type through the dedicated policy boundary', () => {
  for (const documentType of ['invoice', 'invoice_receipt', 'receipt', 'credit_note', 'debit_note'] as const) {
    const capability = resolveAngolaDocumentCapability(documentType, effectiveDate);
    assert.equal(capability.status, 'BLOCKED');
    assert.equal(capability.reasonCode, 'INSTITUTION_DATA_REQUIRED');
    assert.equal(capability.policyVersion, 'angola-2025-71-683-v1');
  }
});

test('Angola policy fails closed for each missing external prerequisite in authority order', () => {
  assert.equal(resolveAngolaDocumentCapability('invoice', effectiveDate, { institutionFacts: true }).reasonCode, 'AGT_ONBOARDING_REQUIRED');
  assert.equal(resolveAngolaDocumentCapability('invoice', effectiveDate, { institutionFacts: true, agtOnboarding: true }).reasonCode, 'AGT_SIGNING_MATERIAL_REQUIRED');
  assert.equal(resolveAngolaDocumentCapability('invoice', effectiveDate, { institutionFacts: true, agtOnboarding: true, signingMaterial: true }).reasonCode, 'AGT_PRODUCTION_SERIES_REQUIRED');
  assert.equal(resolveAngolaDocumentCapability('invoice', effectiveDate, allExternalInputs).status, 'READY');
});

test('Angola policy does not silently select an unsupported effective date', () => {
  assert.deepEqual(resolveAngolaDocumentCapability('receipt', new Date('2025-01-01T00:00:00.000Z')), {
    documentType: 'receipt', status: 'BLOCKED', reasonCode: 'ANGOLA_POLICY_NOT_EFFECTIVE', policyVersion: 'angola-2025-71-683-v1',
  });
});

test('production registry recognises AO without exposing an issuable document or synthetic fallback', () => {
  assert.equal(productionFiscalAdapterRegistry.supportsJurisdiction('AO'), true);
  const adapter = productionFiscalAdapterRegistry.resolveForJurisdiction('AO');
  assert.equal(adapter.key, 'angola-production');
  assert.deepEqual(adapter.policy.supportedDocumentTypes, []);
  assert.throws(() => productionFiscalAdapterRegistry.select({ primaryJurisdiction: 'AO' }, { adapterKey: 'core' }), /FISCAL_CONFIGURATION_ADAPTER_MISMATCH/);
  assert.throws(() => productionFiscalAdapterRegistry.select({ primaryJurisdiction: 'NEXUS_TEST' }, { adapterKey: 'core' }), /FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION/);
});
