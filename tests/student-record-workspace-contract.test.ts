import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const activeStudents = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/components/StudentRecordWorkspace.tsx', import.meta.url), 'utf8');

assert.ok(app.includes('StudentRecordWorkspace'), 'The application shell must mount a dedicated Student Record workspace.');
assert.ok(activeStudents.includes('onOpenStudentRecord'), 'Active Students must navigate to the dedicated workspace, not own the record presentation.');
assert.equal(activeStudents.includes('{selectedStudentRef && <StudentRecordDrawer'), false, 'The primary Active Students action must not open the transitional preview drawer.');
assert.ok(workspace.includes('request(`/api/student-context/${studentRef}`)'), 'The workspace must consume the canonical Student Context by opaque ref only.');
assert.ok(workspace.includes('Alunos & Matrículas'), 'The workspace must retain a human breadcrumb back to Active Students.');
assert.ok(workspace.includes('Registo do Aluno'), 'The workspace must identify the human record surface.');
assert.ok(workspace.includes('Resumo'), 'The only operational section in Objective 2.1 is the Summary.');
assert.ok(workspace.includes('Percurso académico'), 'Objective 2.2 must expose the human academic journey section.');
assert.ok(workspace.includes('context.history.placements.items'), 'Academic journey must consume canonical, already ordered placement history.');
assert.ok(workspace.includes('Situação atual'), 'Current academic context must be visibly distinct from history.');
assert.ok(workspace.includes('Percurso anterior'), 'Historical placements must be visibly distinct from current context.');
assert.equal(workspace.includes('institutionId:'), false, 'The browser must not provide Institution authority.');
assert.equal(workspace.includes('personId:'), false, 'The browser must not provide Person authority.');
assert.equal(workspace.includes('Finance'), false, 'Objective 2.1 must not present Finance capability.');
assert.equal(workspace.includes('Avaliações'), false, 'Objective 2.1 must not present Assessment capability.');
assert.equal(workspace.includes('Assiduidade'), false, 'Objective 2.1 must not present Attendance capability.');
console.log('[STUDENT-EXPERIENCE-01] Dedicated Student Record Workspace contract: RED/GREEN boundary verified.');
