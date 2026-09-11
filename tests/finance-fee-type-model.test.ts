import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFeeTypeCreate,
  normalizeFeeTypeUpdate,
  FeeTypeValidationError,
  NEXUS_BASELINE_FEE_TYPES,
} from '../src/modules/finance/fee-type-model.ts';

// 1. Baseline classifications structure
assert.equal(NEXUS_BASELINE_FEE_TYPES.length, 10, 'Must define 10 Nexus baseline classifications');
assert.ok(NEXUS_BASELINE_FEE_TYPES.some((b) => b.canonicalKey === 'tuition' && b.codePrefix === 'PROP'));
assert.ok(NEXUS_BASELINE_FEE_TYPES.some((b) => b.canonicalKey === 'enrollment' && b.codePrefix === 'MATR'));
assert.ok(NEXUS_BASELINE_FEE_TYPES.some((b) => b.canonicalKey === 'document' && b.codePrefix === 'DOC'));

// 2. normalizeFeeTypeCreate valid
const valid = normalizeFeeTypeCreate({
  displayName: '  Laboratório de Robótica  ',
  codePrefix: 'lab',
});
assert.equal(valid.displayName, 'Laboratório de Robótica');
assert.equal(valid.codePrefix, 'LAB', 'Prefix must be normalized to uppercase');

// 3. normalizeFeeTypeCreate invalid
assert.throws(
  () => normalizeFeeTypeCreate({ displayName: '', codePrefix: 'LAB' }),
  FeeTypeValidationError,
  'Empty displayName must throw FeeTypeValidationError',
);

assert.throws(
  () => normalizeFeeTypeCreate({ displayName: 'Robotics', codePrefix: 'L' }),
  FeeTypeValidationError,
  'Short prefix (< 2 chars) must throw FeeTypeValidationError',
);

assert.throws(
  () => normalizeFeeTypeCreate({ displayName: 'Robotics', codePrefix: 'TOOLONGPREFIX' }),
  FeeTypeValidationError,
  'Long prefix (> 8 chars) must throw FeeTypeValidationError',
);

assert.throws(
  () => normalizeFeeTypeCreate({ displayName: 'Robotics', codePrefix: 'LA_B' }),
  FeeTypeValidationError,
  'Invalid characters in prefix must throw FeeTypeValidationError',
);

// 4. normalizeFeeTypeUpdate
const validUpdate = normalizeFeeTypeUpdate({
  displayName: '  Robótica Avançada ',
  codePrefix: 'ROB',
});
assert.equal(validUpdate.displayName, 'Robótica Avançada');
assert.equal(validUpdate.codePrefix, 'ROB');

console.log('Finance fee type model tests: PASS');
