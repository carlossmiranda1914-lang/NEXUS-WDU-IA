import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInstitutionalContext } from '../src/auth/institutional-context.ts';

const singleMembershipRow = {
  person_id: 'person-1', person_name: 'Carlos', identity_email: 'carlos@example.edu',
  membership_id: 'membership-1', institution_id: 'institution-1',
  institution_name: 'Escola Alfa', institution_slug: 'escola-alfa', role: 'institution_admin',
};

function executorWithRows(rows: unknown[]) {
  return { query: async () => ({ rows }) };
}

test('does not create access when the Firebase identity has no active membership', async () => {
  const result = await resolveInstitutionalContext(executorWithRows([]), 'firebase-uid');
  assert.deepEqual(result, { kind: 'missing_membership' });
});

test('resolves the only active institutional membership', async () => {
  const result = await resolveInstitutionalContext(executorWithRows([singleMembershipRow]), 'firebase-uid');
  assert.equal(result.kind, 'resolved');
  if (result.kind === 'resolved') {
    assert.equal(result.context.institutionId, 'institution-1');
    assert.equal(result.context.role, 'institution_admin');
  }
});

test('requires explicit selection for memberships in multiple institutions', async () => {
  const secondRow = { ...singleMembershipRow, membership_id: 'membership-2', institution_id: 'institution-2', institution_name: 'Escola Beta', institution_slug: 'escola-beta' };
  const result = await resolveInstitutionalContext(executorWithRows([singleMembershipRow, secondRow]), 'firebase-uid');
  assert.equal(result.kind, 'institution_selection_required');
  if (result.kind === 'institution_selection_required') assert.equal(result.institutions.length, 2);
});

test('rejects a requested institution that is not an active membership', async () => {
  const result = await resolveInstitutionalContext(executorWithRows([singleMembershipRow]), 'firebase-uid', 'institution-other');
  assert.deepEqual(result, { kind: 'institution_not_authorized' });
});
