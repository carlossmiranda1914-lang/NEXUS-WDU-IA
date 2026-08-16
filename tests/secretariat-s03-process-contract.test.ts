import { readFile } from 'node:fs/promises';

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(message); }

const controller = await readFile('src/modules/enrollments/enrollment-process.controller.ts', 'utf8');
const api = await readFile('src/modules/enrollments/enrollment-process-api.ts', 'utf8');
const intake = await readFile('src/modules/enrollments/enrollment-intake.ts', 'utf8');
const workspace = await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8');
const migration = await readFile('src/db/migrations/0016_s03_enrollment_process_persistence.sql', 'utf8');

assert(controller.includes("app.get('/api/enrollments/:id/process'"), 'S03 must expose the institution-scoped process read contract.');
assert(controller.includes("app.patch('/api/enrollments/:id/process/assignment'"), 'S03 assignment must use the bounded process endpoint.');
assert(!controller.includes('/process/reconcile'), 'Browser must not receive a manual reconciliation endpoint.');
assert(!controller.includes('currentStage: req.body') && !controller.includes('completed: req.body'), 'Browser payload must not control stage completion.');
assert(api.includes('WHERE e.id = $1 AND e.institution_id = $2'), 'Process lookup must scope enrollment by institution.');
assert(api.includes("status = 'active'"), 'Assignment must require an active institutional membership.');
assert(api.includes("'STALE_VERSION'"), 'Assignment must reject stale optimistic versions.');
assert(migration.includes('enrollment_application_id UUID PRIMARY KEY'), 'Persistence must enforce one process per enrollment application.');
assert(migration.includes('projection_fingerprint TEXT NOT NULL'), 'Persistence must support deterministic retry reconciliation.');
assert(intake.includes('INSERT INTO enrollment_processes'), 'Intake must create the 1:1 process before the first browser read.');
assert(workspace.includes('/process`'), 'Existing ProcessDrawer must load the server projection.');
assert(workspace.includes('process.progress.percent'), 'Frontend must render server progress rather than calculate it.');
assert(workspace.includes('grid-cols-1') && workspace.includes('sm:grid-cols-2'), 'Process stages must adapt from mobile list to wider grids.');
assert(!workspace.includes('Financeiro pendente') && !workspace.includes('Ativar aluno'), 'S03 UI must not expose future Finance/Activation operations.');

console.log(`[S03-PROCESS-CONTRACT] passed (${assertions} assertions).`);
