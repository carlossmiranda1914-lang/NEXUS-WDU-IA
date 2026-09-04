import assert from 'node:assert/strict';
import { readApprovedTestTarget, shouldLoadLocalTestEnvironment } from '../scripts/nexus-test-db-safety.mjs';

// 1. Characterization: Absent local authorization fails closed before DB execution
const localUnauthorizedEnv = {
  CI: 'false',
  TEST_DATABASE_LOCAL_AUTHORIZED: 'false',
  TEST_DATABASE_URL: 'postgresql://nexus_test_runner@127.0.0.1:54329/nexus_fnd01_test',
  TEST_DATABASE_CONFIRMATION: 'NEXUS_TEST_DATABASE',
};

assert.equal(shouldLoadLocalTestEnvironment(localUnauthorizedEnv), false);
assert.throws(
  () => readApprovedTestTarget(localUnauthorizedEnv),
  /Local PostgreSQL tests require TEST_DATABASE_LOCAL_AUTHORIZED=true/,
  'Must refuse execution when TEST_DATABASE_LOCAL_AUTHORIZED is absent or false',
);

const missingAuthEnv = {
  CI: 'false',
  TEST_DATABASE_URL: 'postgresql://nexus_test_runner@127.0.0.1:54329/nexus_fnd01_test',
  TEST_DATABASE_CONFIRMATION: 'NEXUS_TEST_DATABASE',
};
assert.throws(
  () => readApprovedTestTarget(missingAuthEnv),
  /Local PostgreSQL tests require TEST_DATABASE_LOCAL_AUTHORIZED=true/,
  'Must refuse execution when TEST_DATABASE_LOCAL_AUTHORIZED is missing',
);

// 2. Characterization: Wrong local target refused even with authorization
const wrongTargetEnv = {
  CI: 'false',
  TEST_DATABASE_LOCAL_AUTHORIZED: 'true',
  TEST_DATABASE_URL: 'postgresql://production_user@127.0.0.1:5432/production_db',
  TEST_DATABASE_CONFIRMATION: 'NEXUS_TEST_DATABASE',
};
assert.throws(
  () => readApprovedTestTarget(wrongTargetEnv),
  /TEST_DATABASE_URL does not target an approved local disposable database/,
  'Must refuse non-canonical local database targets',
);

// 3. Characterization: Explicitly authorized canonical target succeeds
const canonicalLocalEnv = {
  CI: 'false',
  TEST_DATABASE_LOCAL_AUTHORIZED: 'true',
  TEST_DATABASE_URL: 'postgresql://nexus_test_runner@127.0.0.1:54329/nexus_fnd01_test',
  TEST_DATABASE_CONFIRMATION: 'NEXUS_TEST_DATABASE',
};
assert.equal(shouldLoadLocalTestEnvironment(canonicalLocalEnv), true);
const target = readApprovedTestTarget(canonicalLocalEnv);
assert.deepEqual(target.target, {
  user: 'nexus_test_runner',
  host: '127.0.0.1',
  port: '54329',
  database: 'nexus_fnd01_test',
});

// 4. Characterization: CI semantics remain unchanged
const canonicalCiEnv = {
  CI: 'true',
  TEST_DATABASE_URL: 'postgresql://nexus_ci_runner@127.0.0.1:5432/nexus_ci_fnd06',
  TEST_DATABASE_CONFIRMATION: 'NEXUS_TEST_DATABASE',
};
assert.equal(shouldLoadLocalTestEnvironment(canonicalCiEnv), false);
const ciTarget = readApprovedTestTarget(canonicalCiEnv);
assert.deepEqual(ciTarget.target, {
  user: 'nexus_ci_runner',
  host: '127.0.0.1',
  port: '5432',
  database: 'nexus_ci_fnd06',
});

console.log('Finance fee catalogue DB safety characterization: PASS');
