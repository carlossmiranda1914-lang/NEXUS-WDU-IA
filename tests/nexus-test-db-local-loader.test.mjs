import assert from 'node:assert/strict';
import { shouldLoadLocalTestEnvironment } from '../scripts/nexus-test-db-safety.mjs';

assert.equal(shouldLoadLocalTestEnvironment({ CI: 'true', TEST_DATABASE_LOCAL_AUTHORIZED: 'true' }), false);
assert.equal(shouldLoadLocalTestEnvironment({ CI: 'true' }), false);
assert.equal(shouldLoadLocalTestEnvironment({ TEST_DATABASE_LOCAL_AUTHORIZED: 'true' }), true);
assert.equal(shouldLoadLocalTestEnvironment({}), false);
console.log('CP4-A local configuration loader boundary: PASS.');
