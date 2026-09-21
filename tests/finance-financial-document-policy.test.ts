import assert from 'node:assert/strict';
import test from 'node:test';
import { canConfigureFiscalSettings, canIssueFinancialDocument } from '../src/modules/finance/financial-document-policy.ts';

test('F7-02 separates fiscal configuration from document issuance roles', () => {
  assert.equal(canConfigureFiscalSettings('financial'), false);
  assert.equal(canIssueFinancialDocument('financial'), true);
  assert.equal(canConfigureFiscalSettings('institution_admin'), true);
  assert.equal(canIssueFinancialDocument('institution_admin'), true);
  assert.equal(canConfigureFiscalSettings('director'), false);
  assert.equal(canIssueFinancialDocument('director'), false);
});
