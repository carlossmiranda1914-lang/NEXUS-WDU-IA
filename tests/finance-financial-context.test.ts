import assert from 'node:assert/strict';
import {
  requireFinancialContext,
  type FinancialProfileStore,
  type InstitutionFinancialProfileVersion,
} from '../src/modules/finance/financial-context.ts';

const context = { institutionId: 'school-a', personId: 'person-a', role: 'financial' };
const at = new Date('2026-09-03T12:00:00.000Z');

function profile(overrides: Partial<InstitutionFinancialProfileVersion> = {}): InstitutionFinancialProfileVersion {
  return {
    institutionId: 'school-a',
    version: 1,
    effectiveFrom: '2026-09-01T00:00:00.000Z',
    effectiveTo: null,
    primaryJurisdiction: 'PT',
    functionalCurrency: 'EUR',
    financialTimezone: 'Europe/Lisbon',
    monetaryPolicyVersion: 'money-v1',
    enabledCurrencies: ['EUR', 'AOA'],
    ...overrides,
  };
}

function storeFor(value: InstitutionFinancialProfileVersion | null, calls: string[] = []): FinancialProfileStore {
  return {
    async resolveEffective(institutionId, requestedAt) {
      calls.push(institutionId);
      assert.equal(requestedAt.toISOString(), at.toISOString());
      return value;
    },
  };
}

await assert.rejects(() => requireFinancialContext({ institutionalContext: context, effectiveAt: at, store: storeFor(null) }));
await assert.rejects(() => requireFinancialContext({ institutionalContext: context, effectiveAt: at, store: storeFor(profile({ institutionId: 'school-b' })) }));
await assert.rejects(() => requireFinancialContext({ institutionalContext: context, effectiveAt: at, store: storeFor(profile({ effectiveFrom: '2026-09-03T12:00:00.001Z' })) }));
await assert.rejects(() => requireFinancialContext({ institutionalContext: context, effectiveAt: at, store: storeFor(profile({ effectiveTo: '2026-09-03T12:00:00.000Z' })) }));
await assert.rejects(() => requireFinancialContext({ institutionalContext: context, effectiveAt: at, store: storeFor(profile({ functionalCurrency: 'ZZZ' })) }));
await assert.rejects(() => requireFinancialContext({ institutionalContext: context, effectiveAt: at, store: storeFor(profile({ enabledCurrencies: ['EUR', 'ZZZ'] })) }));
await assert.rejects(() => requireFinancialContext({ institutionalContext: context, effectiveAt: at, requiredCurrency: 'USD', store: storeFor(profile()) }));

const valid = profile({ effectiveTo: '2026-09-03T12:00:00.001Z' });
assert.strictEqual(
  await requireFinancialContext({ institutionalContext: context, effectiveAt: at, requiredCurrency: 'AOA', store: storeFor(valid) }),
  valid,
);

const calls: string[] = [];
const tenantScopedStore: FinancialProfileStore = {
  async resolveEffective(institutionId) {
    calls.push(institutionId);
    return institutionId === 'school-a' ? profile() : profile({ institutionId: 'school-b' });
  },
};
await requireFinancialContext({ institutionalContext: context, effectiveAt: at, store: tenantScopedStore });
assert.deepEqual(calls, ['school-a']);

console.log('Finance financial context: PASS');
