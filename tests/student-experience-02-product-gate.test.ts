import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const record = readFileSync(resolve('src/components/StudentRecordWorkspace.tsx'), 'utf8');
const workspace = readFileSync(resolve('src/components/EnrollmentOperationsWorkspace.tsx'), 'utf8');
const studentContext = readFileSync(resolve('src/modules/student-context/student-context-api.ts'), 'utf8');
const controller = readFileSync(resolve('src/modules/student-context/student-context.controller.ts'), 'utf8');

// Characterization: Task 6 must not manufacture a RED when the existing read path is bounded.
assert.equal((record.match(/request\(`\/api\/student-context\/\$\{studentRef\}`, controller\.signal\)/g) ?? []).length, 1,
  'one abortable Student Context request must serve every Student Record section');
assert.match(record, /useCallback\(async \(\) => \{[\s\S]*?\}, \[studentRef\]\);[\s\S]*?useEffect\(\(\) => \{[\s\S]*?void load\(\);[\s\S]*?studentRequestController\.current\?\.abort\(\);[\s\S]*?\}, \[load\]\);/,
  'opening or changing a public student reference must load through a stable callback and abort on cleanup');
assert.doesNotMatch(record, /setInterval|setTimeout|requestAnimationFrame|\bpoll(?:ing)?\b/i,
  'Student Record must not poll');
assert.doesNotMatch(record, /localStorage|sessionStorage|indexedDB|CacheStorage/i,
  'Student Record must not materialise authority in browser storage');
assert.doesNotMatch(record, /\[studentRef,\s*section\]|\[section,\s*studentRef\]/,
  'switching a section must not refetch the Student Context');
for (const section of ['summary', 'journey', 'enrollments', 'documents', 'guardians']) {
  assert.match(record, new RegExp(`setSection\\('${section}'\\)`), `the ${section} section must be local presentation state only`);
}

for (const endpoint of ['/api/enrollments/context', '/api/enrollments', '/api/active-students']) {
  assert.ok(workspace.includes(`request('${endpoint}')`), `opening the enrollment workspace has one bounded request for ${endpoint}`);
}
assert.equal((workspace.match(/request\('\/api\/active-students'\)/g) ?? []).length, 1,
  'Active Students must have one request in the workspace load batch');

assert.match(studentContext, /const \[enrollmentHistory, placementHistory, documents, guardians\] = await Promise\.all\(/,
  'history, document metadata and guardians must use one bounded parallel projection batch');
assert.doesNotMatch(studentContext, /\.map\([^\n]*pool\.query|for\s*\([^)]*\)\s*\{[^}]*pool\.query/s,
  'Student Context must not issue a per-item PostgreSQL query');
assert.match(studentContext, /resolveStudentRef\(pool, context\.institutionId, studentRef\)/,
  'the server must resolve the opaque student reference before any projection query');
assert.match(controller, /status\(e\.code==='FORBIDDEN'\?403:e\.code==='NOT_FOUND'\?404:400\)/,
  'the HTTP boundary must preserve forbidden and non-disclosing not-found semantics');

for (const state of [
  'A carregar registo do aluno…',
  'Não foi possível carregar o registo agora.',
  'Tentar novamente',
  'Não existe uma situação académica atual autorizada para apresentar.',
  'Ainda não existem registos académicos anteriores.',
  'Ainda não existem matrículas anteriores.',
  'Ainda não existem documentos registados para este aluno.',
  'Ainda não existem encarregados associados a este aluno.',
  'Inicie sessão para consultar este registo.',
  'Não tem acesso a este registo.',
  'O registo pedido não está disponível nesta instituição.',
]) assert.ok(record.includes(state), `Student Record must render the explicit state: ${state}`);

assert.match(record, /new Intl\.DateTimeFormat\('pt-AO'/,
  'document dates must use the Angola Portuguese locale');
assert.doesNotMatch(record, />Student Context<|>Student 360<|>GuardianRelationship<|>Enrollment<|>placement<|>lifecycle<|>metadata</i,
  'internal architecture terms must not leak into rendered Student Record copy');
assert.doesNotMatch(record, /attention|alert score|warning badge|risk percentage/i,
  'Task 1 froze attention functionality at NONE');
assert.doesNotMatch(record, /personId|institutionId|membershipId|provider_uid|national.?id|address|storage.?path/i,
  'Student Record must not expose internal identifiers or excess PII');

console.log('[STUDENT-EXPERIENCE-02] Task 6 product hardening characterization: PASS.');
