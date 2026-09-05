import { strict as assert } from 'node:assert';
import {
  normalizeCreateFinancialAccount,
  normalizeUpdateFinancialAccount,
  FinancialAccountValidationError,
} from '../src/modules/finance/financial-account-model.ts';

// 1. Valid Create Financial Account input
const valid = normalizeCreateFinancialAccount({
  name: 'Conta Familiar Silva',
  primaryPersonId: '00000000-0000-0000-0000-000000000001',
});
assert.equal(valid.name, 'Conta Familiar Silva');
assert.equal(valid.primaryPersonId, '00000000-0000-0000-0000-000000000001');

// 2. Reject empty or invalid name
assert.throws(() => {
  normalizeCreateFinancialAccount({ name: '', primaryPersonId: '00000000-0000-0000-0000-000000000001' });
}, (err: any) => err instanceof FinancialAccountValidationError);

// 3. Reject invalid primaryPersonId
assert.throws(() => {
  normalizeCreateFinancialAccount({ name: 'Conta', primaryPersonId: 'invalid-uuid' });
}, (err: any) => err instanceof FinancialAccountValidationError);

// 4. Normalize Update Financial Account input
const validUpdate = normalizeUpdateFinancialAccount({
  name: 'Conta Silva Atualizada',
});
assert.equal(validUpdate.name, 'Conta Silva Atualizada');

console.log('Finance financial account model tests: PASS');
