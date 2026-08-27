import assert from 'node:assert/strict';
import {
  IamMembershipReadError,
  buildMembershipsUrl,
  listInstitutionMemberships,
  type IamMembershipListResponse,
} from '../src/modules/iam/iam-read-client.ts';

assert.equal(buildMembershipsUrl({}), '/api/iam/memberships');
assert.equal(
  buildMembershipsUrl({ status: 'active', role: 'teacher', cursor: 'next_cursor', limit: 25 }),
  '/api/iam/memberships?status=active&role=teacher&cursor=next_cursor&limit=25',
);
assert.equal(buildMembershipsUrl({ status: undefined, role: undefined, cursor: '', limit: undefined }), '/api/iam/memberships');
assert.equal(buildMembershipsUrl({ limit: 0 }), '/api/iam/memberships');

const payload: IamMembershipListResponse = {
  memberships: [{ id: 'membership-1', person: { displayName: 'Ana Martins' }, role: 'teacher', status: 'active', version: 3 }],
  page: { nextCursor: 'cursor-2' },
  summary: { activeInstitutionAdminCount: 1 },
};
let receivedUrl = '';
let receivedAuthorization = '';
const result = await listInstitutionMemberships('firebase-token', { status: 'active' }, async (url, init) => {
  receivedUrl = String(url);
  receivedAuthorization = String(init?.headers && new Headers(init.headers).get('Authorization'));
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
assert.deepEqual(result, payload);
assert.equal(receivedUrl, '/api/iam/memberships?status=active');
assert.equal(receivedAuthorization, 'Bearer firebase-token');
assert.equal(receivedUrl.includes('institutionId'), false);

await assert.rejects(
  () => listInstitutionMemberships('firebase-token', {}, async () => new Response(JSON.stringify({ error: 'Operação institucional não autorizada.' }), { status: 403 })),
  (error: unknown) => error instanceof IamMembershipReadError && error.status === 403,
);

console.log('IAM institutional access client tests passed.');
