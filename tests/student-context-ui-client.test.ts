import assert from 'node:assert/strict';
import { StudentContextClientError, buildStudentContextUrl, getStudentContext } from '../src/modules/student-context/student-context-client.ts';

assert.equal(buildStudentContextUrl('opaque-student-ref'), '/api/student-context/opaque-student-ref');
assert.equal(buildStudentContextUrl('opaque-student-ref', { historyLimit: 1, enrollmentOffset: 2, placementOffset: 3 }), '/api/student-context/opaque-student-ref?historyLimit=1&enrollmentOffset=2&placementOffset=3');
let receivedUrl = ''; let authorization = '';
const response = await getStudentContext('firebase-token', 'opaque-student-ref', {}, async (url, init) => {
  receivedUrl = String(url); authorization = String(new Headers(init?.headers).get('Authorization'));
  return new Response(JSON.stringify({ student: { displayName: 'Aluno seguro', status: 'active' }, current: { enrollment: null, placement: null }, history: { enrollments: { items: [], nextOffset: null }, placements: { items: [], nextOffset: null } }, documents: { metadata: [] }, unavailable: { finance: { status: 'not_yet_authoritative' }, assessment: { status: 'not_yet_authoritative' }, attendance: { status: 'not_yet_authoritative' }, physicalDocuments: { status: 'not_yet_authoritative' } } }), { status: 200 });
});
assert.equal(receivedUrl.includes('institution'), false); assert.equal(authorization, 'Bearer firebase-token'); assert.equal(response.student.displayName, 'Aluno seguro');
await assert.rejects(() => getStudentContext('firebase-token', 'opaque-student-ref', {}, async () => new Response(JSON.stringify({ error: 'Contexto de aluno indisponível.' }), { status: 404 })), (error: unknown) => error instanceof StudentContextClientError && error.status === 404);
console.log('Student Context UI client contract: PASS.');
