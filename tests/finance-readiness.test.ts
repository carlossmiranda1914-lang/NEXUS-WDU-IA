import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveFinanceReadiness } from '../src/modules/finance/finance-readiness.ts';

const input = (overrides: Partial<Parameters<typeof resolveFinanceReadiness>[0]> = {}) => ({
  institutionId: 'institution-a',
  at: new Date('2026-09-10T00:00:00.000Z'),
  canManageConfiguration: true,
  resolveFinancialProfile: async () => ({ id: 'profile' }),
  resolveFiscalConfiguration: async () => ({ id: 'fiscal' }),
  resolveReceiptSeries: async () => ({ id: 'series' }),
  ...overrides,
});

test('Finance readiness is incomplete when an effective financial profile is absent', async () => {
  const result = await resolveFinanceReadiness(input({ resolveFinancialProfile: async () => null }));
  assert.equal(result.status, 'INCOMPLETE');
  assert.deepEqual(result.requirements.map(item => [item.code, item.state]), [['FINANCIAL_PROFILE', 'MISSING'], ['FISCAL_CONFIGURATION', 'COMPLETE'], ['RECEIPT_SERIES', 'COMPLETE']]);
});

test('Finance readiness identifies each missing canonical authority without granting authorization', async () => {
  const fiscalMissing = await resolveFinanceReadiness(input({ resolveFiscalConfiguration: async () => { throw new Error('FISCAL_CONFIGURATION_NOT_EFFECTIVE'); }, canManageConfiguration: false }));
  assert.equal(fiscalMissing.status, 'INCOMPLETE');
  assert.equal(fiscalMissing.canManageConfiguration, false);
  assert.deepEqual(fiscalMissing.requirements.find(item => item.code === 'FISCAL_CONFIGURATION'), { code: 'FISCAL_CONFIGURATION', state: 'MISSING' });

  const seriesMissing = await resolveFinanceReadiness(input({ resolveReceiptSeries: async () => { throw new Error('FINANCIAL_DOCUMENT_SERIES_NOT_EFFECTIVE'); } }));
  assert.equal(seriesMissing.status, 'INCOMPLETE');
  assert.deepEqual(seriesMissing.requirements.find(item => item.code === 'RECEIPT_SERIES'), { code: 'RECEIPT_SERIES', state: 'MISSING' });
});

test('Finance readiness is ready only when every effective authority exists', async () => {
  const result = await resolveFinanceReadiness(input());
  assert.equal(result.status, 'READY');
  assert.ok(result.requirements.every(item => item.state === 'COMPLETE'));
});

test('Finance readiness separates configured module state from blocked official receipt issuance', async () => {
  const result = await resolveFinanceReadiness(input({
    resolveReceiptIssuance: async () => { throw new Error('FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION'); },
  }));
  assert.equal(result.status, 'READY');
  assert.equal(result.receiptIssuance.status, 'BLOCKED');
  assert.equal(result.receiptIssuance.documentType, 'receipt');
  assert.equal(result.receiptIssuance.reasonCode, 'FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION');
});

test('Finance module readiness does not authorize receipt issuance without an effective legal profile', async () => {
  const result = await resolveFinanceReadiness(input({ resolveInstitutionLegalProfile: async () => null }));
  assert.equal(result.status, 'INCOMPLETE');
  assert.equal(result.receiptIssuance.status, 'BLOCKED');
  assert.equal(result.receiptIssuance.documentType, 'receipt');
  assert.equal(result.receiptIssuance.reasonCode, 'INSTITUTION_LEGAL_PROFILE_REQUIRED');
  assert.deepEqual(result.receiptIssuance.requirements.find(item => item.code === 'INSTITUTION_LEGAL_PROFILE'), { code: 'INSTITUTION_LEGAL_PROFILE', state: 'MISSING' });
});

test('Finance readiness makes an unsupported jurisdiction explicitly unavailable after local prerequisites are complete', async () => {
  const result = await resolveFinanceReadiness(input({
    resolveInstitutionLegalProfile: async () => ({ id: 'legal' }),
    isJurisdictionPolicyAvailable: () => false,
  }));
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.localPrerequisitesComplete, true);
  assert.equal(result.jurisdictionPolicyAvailable, false);
  assert.equal(result.fiscalConfigurationAvailable, false);
  assert.equal(result.seriesConfigurationAvailable, false);
  assert.equal(result.receiptIssuance.status, 'BLOCKED');
  assert.equal(result.receiptIssuance.reasonCode, 'JURISDICTION_POLICY_UNAVAILABLE');
  assert.deepEqual(result.requirements.find(item => item.code === 'FISCAL_CONFIGURATION'), { code: 'FISCAL_CONFIGURATION', state: 'BLOCKED' });
});

test('Finance readiness blocks unexpected authority integrity failures', async () => {
  const result = await resolveFinanceReadiness(input({ resolveReceiptSeries: async () => { throw new Error('database integrity violation'); } }));
  assert.equal(result.status, 'BLOCKED');
  assert.deepEqual(result.requirements.find(item => item.code === 'RECEIPT_SERIES'), { code: 'RECEIPT_SERIES', state: 'BLOCKED' });
});
