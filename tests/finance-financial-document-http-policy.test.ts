import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessFinancialDocuments } from '../src/modules/finance/financial-document-policy.ts';

test('F7-04 separates Financial Document HTTP capabilities by institutional role', () => {
  assert.equal(canAccessFinancialDocuments('financial', 'read'), true);
  assert.equal(canAccessFinancialDocuments('financial', 'issue'), true);
  assert.equal(canAccessFinancialDocuments('financial', 'correct'), true);
  assert.equal(canAccessFinancialDocuments('financial', 'fiscal_config_read'), true);
  assert.equal(canAccessFinancialDocuments('financial', 'fiscal_config_manage'), false);
  assert.equal(canAccessFinancialDocuments('financial', 'series_read'), true);
  assert.equal(canAccessFinancialDocuments('financial', 'series_manage'), false);
  assert.equal(canAccessFinancialDocuments('director', 'read'), true);
  assert.equal(canAccessFinancialDocuments('director', 'issue'), false);
  assert.equal(canAccessFinancialDocuments('teacher', 'read'), false);
});
