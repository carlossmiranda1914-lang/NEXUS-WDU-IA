import test from 'node:test';
import assert from 'node:assert/strict';
import { isInstitutionOwned, resolveInstitutionOwnedResourceIds } from '../src/auth/institution-resource-ownership.ts';

const context = {
  personId: 'person-1', personName: 'Carlos', identityEmail: 'carlos@example.edu',
  membershipId: 'membership-1', institutionId: 'institution-a',
  institutionName: 'Escola A', institutionSlug: 'escola-a', role: 'institution_admin' as const,
};

test('resolves only identifiers mapped to the active institution', async () => {
  let params: unknown[] = [];
  const ids = await resolveInstitutionOwnedResourceIds({
    query: async (_query, received) => {
      params = received;
      return { rows: [{ resource_id: 'doc-a' }] };
    },
  }, context, 'document');

  assert.deepEqual(params, ['institution-a', 'document']);
  assert.deepEqual(ids, ['doc-a']);
});

test('does not accept a resource identifier owned by another institution', () => {
  assert.equal(isInstitutionOwned('doc-b', ['doc-a']), false);
  assert.equal(isInstitutionOwned('doc-a', ['doc-a']), true);
});
