import assert from 'node:assert/strict';
import test from 'node:test';
import { createSyntheticUatFiscalAdapterRegistry, productionFiscalAdapterRegistry, resolveDocumentaryPolicy, runtimeFiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';

test('production adapter registry fails closed without an approved jurisdiction adapter', () => {
  assert.throws(() => productionFiscalAdapterRegistry.select({ primaryJurisdiction: 'NEXUS_TEST' }, { adapterKey: 'core' }), /FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION/);
});

test('synthetic adapter exists only through explicit UAT composition', () => {
  const registry = createSyntheticUatFiscalAdapterRegistry();
  assert.equal(registry.select({ primaryJurisdiction: 'NEXUS_TEST' }, { adapterKey: 'core' }).key, 'core');
});

test('synthetic UAT policy supports invoice-receipt without enabling Angola production', () => {
  const core = createSyntheticUatFiscalAdapterRegistry().select({ primaryJurisdiction: 'NEXUS_TEST' }, { adapterKey: 'core' });
  assert.equal(core.policy.supportedDocumentTypes.includes('invoice_receipt'), true);
  assert.deepEqual(resolveDocumentaryPolicy(core, 'invoice_receipt'), { taxTreatment: 'not_applicable', legalMentions: [] });
  assert.throws(() => productionFiscalAdapterRegistry.select({ primaryJurisdiction: 'AO' }, { adapterKey: 'core' }), /FISCAL_CONFIGURATION_ADAPTER_MISMATCH/);
  const angola = productionFiscalAdapterRegistry.resolveForJurisdiction('AO');
  assert.throws(() => resolveDocumentaryPolicy(angola, 'invoice_receipt'), /DOCUMENT_TYPE_UNSUPPORTED/);
});

test('runtime production registry remains fail-closed when synthetic UAT mode is disabled', () => {
  const prior = process.env.NEXUS_UAT_SYNTHETIC_FISCAL_ADAPTERS;
  delete process.env.NEXUS_UAT_SYNTHETIC_FISCAL_ADAPTERS;
  try {
    const runtime = runtimeFiscalAdapterRegistry();
    assert.equal(runtime.has('core'), false);
    assert.deepEqual(runtime.resolveForJurisdiction('AO').policy.supportedDocumentTypes, []);
  } finally {
    if (prior === undefined) delete process.env.NEXUS_UAT_SYNTHETIC_FISCAL_ADAPTERS;
    else process.env.NEXUS_UAT_SYNTHETIC_FISCAL_ADAPTERS = prior;
  }
});
