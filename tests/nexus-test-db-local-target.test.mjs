import assert from 'node:assert/strict';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';

const target = readApprovedTestTarget({
  TEST_DATABASE_LOCAL_AUTHORIZED: 'true',
  TEST_DATABASE_CONFIRMATION: 'NEXUS_TEST_DATABASE',
  TEST_DATABASE_URL: 'postgresql://local_test_user@127.0.0.1:5432/local_disposable_test',
});
assert.equal(target.target.host, '127.0.0.1');
assert.equal(target.target.port, '5432');
console.log('CP4-A local loopback target policy: PASS.');
