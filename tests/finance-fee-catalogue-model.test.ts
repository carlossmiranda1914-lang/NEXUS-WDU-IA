import assert from 'node:assert/strict';
import {
  normalizeFeeCatalogueCreate,
  normalizeFeeCatalogueUpdate,
  FeeCatalogueValidationError,
} from '../src/modules/finance/fee-catalogue-model.ts';

const valid = {
  feeTypeId: '00000000-0000-0000-0000-000000000001',
  name: ' Fee ',
  amount: '10.1200',
  currency: 'EUR',
  effectiveFrom: '2026-09-04T10:00:00Z',
};

// 1. Create normalization
const x = normalizeFeeCatalogueCreate(valid);
assert.equal(x.feeTypeId, '00000000-0000-0000-0000-000000000001');
assert.equal(x.name, 'Fee');
assert.equal(x.amount, '10.12');
assert.throws(() => normalizeFeeCatalogueCreate({ ...valid, amount: '0' }), FeeCatalogueValidationError);
assert.throws(() => normalizeFeeCatalogueCreate({ ...valid, amount: '-1' }), FeeCatalogueValidationError);
assert.throws(() => normalizeFeeCatalogueCreate({ ...valid, amount: '1.0000000000001' }), /Decimal scale/);
assert.throws(() => normalizeFeeCatalogueCreate({ ...valid, name: ' ' }), FeeCatalogueValidationError);
assert.throws(() => normalizeFeeCatalogueCreate({ ...valid, feeTypeId: '' }), FeeCatalogueValidationError);
assert.throws(() => normalizeFeeCatalogueCreate({ ...valid, effectiveFrom: 'invalid-date' }), FeeCatalogueValidationError);

// 2. Update normalization
const updateValid = {
  feeTypeId: '00000000-0000-0000-0000-000000000001',
  name: 'Updated Fee',
  amount: '20.00',
  currency: 'EUR',
  effectiveFrom: '2026-10-01T00:00:00Z',
  expectedVersion: 1,
};
const u = normalizeFeeCatalogueUpdate(updateValid);
assert.equal(u.expectedVersion, 1);
assert.equal(u.amount, '20');
assert.equal(u.feeTypeId, '00000000-0000-0000-0000-000000000001');

assert.throws(() => normalizeFeeCatalogueUpdate({ ...updateValid, expectedVersion: 0 }), FeeCatalogueValidationError);
assert.throws(() => normalizeFeeCatalogueUpdate({ ...updateValid, expectedVersion: -1 }), FeeCatalogueValidationError);
assert.throws(() => normalizeFeeCatalogueUpdate({ ...updateValid, expectedVersion: 1.5 as any }), FeeCatalogueValidationError);

console.log('Finance fee catalogue model: PASS');
