import assert from 'node:assert/strict';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';

const target = readApprovedTestTarget({
  TEST_DATABASE_LOCAL_AUTHORIZED: 'true',
  TEST_DATABASE_CONFIRMATION: 'NEXUS_TEST_DATABASE',
  TEST_DATABASE_URL: 'postgresql://local_test_user@127.0.0.1:54329/local_disposable_test',
});
assert.equal(target.target.host, '127.0.0.1');
assert.equal(target.target.port, '54329');
for (const url of [
  'postgresql://local_test_user@0.0.0.0:54329/local_disposable_test',
  'postgresql://local_test_user@[::1]:54329/local_disposable_test',
  'postgresql://local_test_user@localhost:54329/local_disposable_test',
  'postgresql://local_test_user@192.168.1.10:54329/local_disposable_test',
  'postgresql://local_test_user@127.0.0.1:5432/local_disposable_test',
]) assert.throws(() => readApprovedTestTarget({ TEST_DATABASE_LOCAL_AUTHORIZED: 'true', TEST_DATABASE_CONFIRMATION: 'NEXUS_TEST_DATABASE', TEST_DATABASE_URL: url }), /approved local disposable database/);
assert.throws(() => readApprovedTestTarget({ CI: 'true', TEST_DATABASE_CONFIRMATION: 'NEXUS_TEST_DATABASE', TEST_DATABASE_URL: 'postgresql://local_test_user@127.0.0.1:54329/local_disposable_test' }), /approved CI disposable database/);
console.log('CP4-A local loopback target policy: PASS.');
