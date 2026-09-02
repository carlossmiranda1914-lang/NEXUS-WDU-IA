import { readFile } from 'node:fs/promises';

const source = (await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8')).replace(/\r\n/g, '\n');
const failures: string[] = [];

function expect(label: string, token: string) {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
}
function reject(label: string, token: string) {
  if (source.includes(token)) failures.push(`${label}: forbidden ${token}`);
}

expect('server-backed lifecycle presentation helper', 'buildEnrollmentLifecyclePresentation(processes, activeStudents.length)');
expect('single journey rail header exists', 'Percurso de alunos e matr');
expect('lifecycle click stores contextual heading', 'setSelectedLifecycleLabel(stage.label)');
expect('top navigation clears lifecycle context', 'setSelectedLifecycleLabel(null)');
expect('lifecycle click filters by stage enrollment IDs', 'setJourneyEnrollmentIds(stage.enrollmentIds)');
expect('top navigation clears journey filter IDs', 'setJourneyEnrollmentIds(null)');
expect('lifecycle click uses the helper-selected safe view', 'setView(stage.selectedView)');
expect('active students remain a distinct view', "{view === 'students' && <ActiveStudentsView");
expect('journey rail typography remains legible without truncation', 'whitespace-normal break-normal text-sm font-semibold leading-5 [overflow-wrap:normal]');
reject('journey labels must not be truncated', 'flex-1 truncate text-sm font-semibold');

reject('superseded pipeline helper', 'pipelineCounts(');
reject('superseded pipeline context model', 'PIPELINE_CONTEXT');
reject('superseded pipeline map', 'pipeline.map(');

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S01.2 flow simplification contract tests passed (13 assertions).');
