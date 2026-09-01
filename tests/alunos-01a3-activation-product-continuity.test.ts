import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workspace = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');
const actions = await readFile(new URL('../src/components/EnrollmentLifecycleActions.tsx', import.meta.url), 'utf8');
const contextController = await readFile(new URL('../src/modules/enrollments/academic-year.controller.ts', import.meta.url), 'utf8');
const enrollmentController = await readFile(new URL('../src/modules/enrollments/enrollment.controller.ts', import.meta.url), 'utf8');
const activationApi = await readFile(new URL('../src/modules/enrollments/enrollment-activation-api.ts', import.meta.url), 'utf8');

assert.match(contextController, /canActivateEnrollment/, 'The server-owned Enrollment context must explicitly declare activation capability.');
assert.match(actions, /canActivate/, 'Lifecycle actions must consume the server-provided capability, not calculate a role locally.');
assert.match(actions, /Ativar aluno/, 'An authorized validated Enrollment must expose the reachable activation action.');
assert.match(actions, /Abrir Registo do Aluno/, 'A confirmed activation must expose the student-record handoff.');
assert.match(workspace, /\/activate/, 'The workspace must invoke the canonical activation endpoint.');
assert.match(workspace, /expectedLifecycleVersion/, 'Activation must send the current server-issued lifecycle version.');
assert.match(workspace, /expectedRegistrationVersion/, 'Activation must send the current server-issued registration version.');
assert.match(workspace, /Idempotency-Key/, 'Activation retries must use the canonical idempotency header.');
assert.match(workspace, /await load\(\)/, 'Confirmed activation must refresh Enrollment and Active Students projections.');
assert.match(workspace, /activation\?\.studentRef/, 'Only the returned opaque studentRef may drive the handoff.');
const activationPath = workspace.slice(workspace.indexOf('async function activate()'), workspace.indexOf('const currentStage = process?.stages'));
assert.doesNotMatch(activationPath, /studentPersonId|studentProfileId|personId:|institutionId:/, 'The product activation path must not expose or supply internal authority identifiers.');
assert.match(enrollmentController, /lifecycle_version[\s\S]*registration_version/, 'The UI may consume only server-issued activation versions from the Enrollment read model.');
assert.match(activationApi, /role === 'institution_admin' \|\| role === 'director'/, 'Canonical activation authority must remain server-side for Administration/Direção only.');

console.log('[ALUNOS-01A.3] activation product continuity contract: PASS.');
