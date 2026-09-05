import { strict as assert } from 'node:assert';
import {
  normalizeIssueObligationInput,
  FinancialObligationValidationError,
} from '../src/modules/finance/financial-obligation-model.ts';

// 1. Valid Issue Obligation input
const valid = normalizeIssueObligationInput({
  financialAccountId: '00000000-0000-0000-0000-000000000001',
  feeCatalogueItemId: '00000000-0000-0000-0000-000000000002',
  beneficiaryPersonId: '00000000-0000-0000-0000-000000000003',
  dueAt: '2026-10-31T23:59:59.000Z',
  notes: 'Propinas Outubro 2026',
});
assert.equal(valid.financialAccountId, '00000000-0000-0000-0000-000000000001');
assert.equal(valid.feeCatalogueItemId, '00000000-0000-0000-0000-000000000002');
assert.equal(valid.beneficiaryPersonId, '00000000-0000-0000-0000-000000000003');
assert.equal(valid.notes, 'Propinas Outubro 2026');

// 2. Reject missing financialAccountId
assert.throws(() => {
  normalizeIssueObligationInput({
    financialAccountId: '',
    feeCatalogueItemId: '00000000-0000-0000-0000-000000000002',
  });
}, (err: any) => err instanceof FinancialObligationValidationError);

// 3. Reject missing feeCatalogueItemId
assert.throws(() => {
  normalizeIssueObligationInput({
    financialAccountId: '00000000-0000-0000-0000-000000000001',
    feeCatalogueItemId: '',
  });
}, (err: any) => err instanceof FinancialObligationValidationError);

// 4. Reject client supplying arbitrary amount (amount must come strictly from Fee Catalogue authority)
assert.throws(() => {
  normalizeIssueObligationInput({
    financialAccountId: '00000000-0000-0000-0000-000000000001',
    feeCatalogueItemId: '00000000-0000-0000-0000-000000000002',
    amount: '1000.00', // Client is forbidden from authoring the amount
  } as any);
}, (err: any) => err instanceof FinancialObligationValidationError);

console.log('Finance financial obligation model tests: PASS');
