import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [mission, studentContextController, enrollmentProcessController, documentController] = await Promise.all([
  readFile(new URL('../docs/roadmap/missions/STUDENT-EXPERIENCE-02.md', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/student-context/student-context.controller.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/enrollments/enrollment-process.controller.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/enrollments/enrollment-document.controller.ts', import.meta.url), 'utf8'),
]);

assert.match(mission, /## Task 3 — Contextual Owner-Routing Readiness Audit/, 'Task 3 must record the audited owner-routing decision.');
assert.match(mission, /\| SECTION \| OWNER \| REAL OWNER USE CASE \| SAFE PUBLIC REF \| SAFE ROUTE \| AUTHORISATION \| CURRENTLY ROUTABLE\? \| PREREQUISITE \|/, 'Task 3 must contain the exact owner-routing matrix header.');
assert.match(mission, /INTERNAL_ID_ROUTING=NO/, 'Task 3 must explicitly forbid browser routing with internal identifiers.');
assert.match(mission, /FAKE_ACTIONS_ADDED=NO/, 'Task 3 must explicitly prohibit fake owner actions.');
assert.match(mission, /ROUTABLE_SECTIONS=NONE/, 'an existing owner must not be claimed routable without a safe public bridge.');

for (const section of ['Resumo', 'Percurso académico', 'Matrículas', 'Documentos', 'Encarregados']) {
  assert.match(mission, new RegExp(`\\| ${section} \\|`), `Task 3 must audit ${section}.`);
}
assert.match(mission, /\| Resumo \|[\s\S]*?\| READ_ONLY_NO_ACTION \|/);
assert.match(mission, /\| Percurso académico \|[\s\S]*?\| READ_ONLY_NO_ACTION \|/);
assert.match(mission, /\| Matrículas \|[\s\S]*?\| PREREQUISITE_REQUIRED \|/);
assert.match(mission, /\| Documentos \|[\s\S]*?\| PREREQUISITE_REQUIRED \|/);
assert.match(mission, /\| Encarregados \|[\s\S]*?\| READ_ONLY_NO_ACTION \|/);

assert.match(studentContextController, /\/api\/student-context\/:studentRef/, 'the safe Student Record read boundary must use only studentRef.');
assert.match(enrollmentProcessController, /\/api\/enrollments\/:id\/process/, 'Enrollment Process has an owner route, but it consumes :id.');
assert.match(documentController, /\/api\/enrollments\/:id\/documents/, 'Enrollment Documents has an owner route, but it consumes :id.');
assert.doesNotMatch(mission, /\| (?:Matrículas|Documentos) \|[\s\S]*?\| ROUTABLE \|/, 'Enrollment and Documents must not be called routable without an opaque owner bridge.');

console.log('[STUDENT-EXPERIENCE-02] Task 3 owner-routing governance: PASS.');
