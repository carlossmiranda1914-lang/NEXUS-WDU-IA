import assert from 'node:assert/strict';
import test from 'node:test';
import { FiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';

test('production adapter registry fails closed without an approved jurisdiction adapter', () => {
  const registry = new FiscalAdapterRegistry([]);
  assert.throws(() => registry.select({ primaryJurisdiction: 'NEXUS_TEST' }, { adapterKey: 'core' }), /FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION/);
});

