import assert from 'node:assert/strict';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';

const approvedShape = {
  TEST_DATABASE_URL: 'postgresql://nexus_test_runner@localhost:54329/nexus_fnd01_test',
  TEST_DATABASE_CONFIRMATION: 'NEXUS_TEST_DATABASE',
};
assert.throws(() => readApprovedTestTarget(approvedShape), /TEST_DATABASE_LOCAL_AUTHORIZED/);
assert.throws(() => readApprovedTestTarget({ ...approvedShape, TEST_DATABASE_LOCAL_AUTHORIZED: 'true', TEST_DATABASE_URL: 'postgresql://wrong@localhost:54329/not_test' }), /approved local disposable database/);
console.log('CP4-S safety gate pre-connection refusals: PASS.');
