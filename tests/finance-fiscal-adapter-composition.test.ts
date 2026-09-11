import assert from 'node:assert/strict';
import test from 'node:test';
import { createSyntheticUatFiscalAdapterRegistry, productionFiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';

test('production adapter registry fails closed without an approved jurisdiction adapter', () => {
  assert.throws(() => productionFiscalAdapterRegistry.select({ primaryJurisdiction: 'NEXUS_TEST' }, { adapterKey: 'core' }), /FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION/);
});

test('synthetic adapter exists only through explicit UAT composition', () => {
  const registry = createSyntheticUatFiscalAdapterRegistry();
  assert.equal(registry.select({ primaryJurisdiction: 'NEXUS_TEST' }, { adapterKey: 'core' }).key, 'core');
});
