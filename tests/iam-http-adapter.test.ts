import assert from 'node:assert/strict';
import { IamCommandError } from '../src/modules/iam/iam-command-types.ts';
import { parseChangeRoleBody, parseGrantBody, parseRequestMetadata, publicError } from '../src/modules/iam/iam-http-adapter.ts';

const personId = '33333333-3333-4333-8333-333333333333';
assert.deepEqual(parseGrantBody({ target: { personId }, role: 'teacher', idempotencyKey: 'grant-http-001' }), {
  mode: 'target', target: { personId, identityId: undefined }, role: 'teacher', idempotencyKey: 'grant-http-001', accessIntentId: undefined, membershipId: undefined, expectedVersion: undefined,
});
const pendingMembershipId = '44444444-4444-4444-8444-444444444444';
assert.deepEqual(parseGrantBody({ pendingMembershipId, role: 'teacher', expectedVersion: 1, idempotencyKey: 'pending-http-001' }), { mode: 'pending', pendingMembershipId, role: 'teacher', expectedVersion: 1, idempotencyKey: 'pending-http-001' });
assert.throws(() => parseGrantBody({ pendingMembershipId, target: { personId }, role: 'teacher', expectedVersion: 1, idempotencyKey: 'pending-http-002' }));
assert.throws(() => parseGrantBody({ role: 'teacher', expectedVersion: 1, idempotencyKey: 'pending-http-003' }));
assert.throws(() => parseGrantBody({ pendingMembershipId, accessIntentId: personId, role: 'teacher', expectedVersion: 1, idempotencyKey: 'pending-http-004' }));
assert.throws(() => parseGrantBody({ pendingMembershipId: 'not-a-uuid', role: 'teacher', expectedVersion: 1, idempotencyKey: 'pending-http-005' }));
assert.throws(() => parseGrantBody({ target: { personId }, role: 'teacher', idempotencyKey: 'grant-http-001', institutionId: '44444444-4444-4444-8444-444444444444' }));
assert.throws(() => parseGrantBody({ target: { personId }, role: 'teacher', idempotencyKey: 'grant-http-001', unknown: true }));
assert.throws(() => parseChangeRoleBody({ role: 'teacher', expectedVersion: 0, idempotencyKey: 'change-http-001' }));
assert.throws(() => parseRequestMetadata({ 'x-request-id': 'bad space' }));
const metadata = parseRequestMetadata({}); assert.match(metadata.requestId, /^[0-9a-f-]{36}$/i); assert.equal(metadata.correlationId, undefined);
assert.deepEqual(publicError(new IamCommandError('UNAUTHORIZED')), { status: 403, error: 'Operação institucional não autorizada.', code: 'UNAUTHORIZED' });
assert.deepEqual(publicError(new IamCommandError('LAST_ADMIN_PROTECTED')), { status: 409, error: 'Conflito de estado do acesso institucional.', code: 'LAST_ADMIN_PROTECTED' });
assert.deepEqual(publicError(new IamCommandError('VERSION_CONFLICT')), { status: 409, error: 'Conflito de estado do acesso institucional.', code: 'VERSION_CONFLICT' });
assert.deepEqual(publicError(new IamCommandError('INTENT_INVALID')), { status: 409, error: 'Conflito de estado do acesso institucional.', code: 'INTENT_INVALID' });
assert.deepEqual(publicError(new Error('SELECT private FROM secret')), { status: 500, error: 'Não foi possível concluir a operação IAM.' });
console.log('IAM HTTP adapter tests passed.');
