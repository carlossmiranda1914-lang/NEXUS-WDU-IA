import { readFile } from 'node:fs/promises';

const source = (await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8')).replace(/\r\n/g, '\n');
const failures: string[] = [];

function expect(label: string, token: string) {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
}
function reject(label: string, token: string) {
  if (source.includes(token)) failures.push(`${label}: forbidden ${token}`);
}

expect('single lifecycle helper', "buildEnrollmentLifecyclePresentation(records, activeStudents.length)");
expect('single lifecycle rail', 'Percurso de alunos e matrículas');
expect('lifecycle click stores contextual heading', 'setSelectedLifecycleLabel(stage.label)');
expect('top navigation clears lifecycle context', 'setSelectedLifecycleLabel(null)');
expect('lifecycle click uses canonical status filters', 'setStatusFilter(stage.statuses.length > 0 ? stage.statuses : null)');
expect('lifecycle click uses the helper-selected safe view', 'setView(stage.selectedView)');
expect('active students remain a distinct view', "{view === 'students' && <ActiveStudentsView");
expect('pipeline typography remains legible without truncation', 'whitespace-normal break-normal text-sm font-semibold leading-5 [overflow-wrap:normal]');
reject('pipeline labels must not be truncated', 'flex-1 truncate text-sm font-semibold');
expect('whole card indicates navigation', 'group-hover:translate-x-0.5');

reject('superseded pipeline helper', 'pipelineCounts(');
reject('superseded pipeline context model', 'PIPELINE_CONTEXT');
reject('superseded pipeline map', 'pipeline.map(');
reject('parallel identity card', 'Identificação');
reject('parallel finance card', 'Financeiro');
reject('technical backend language removed', 'Domínio ainda não persistido');
reject('pipeline must not become separate top-level navigation', "{ id: 'documents', label: 'Documentos' }");
reject('no fake document UI introduced', 'Documentos obrigatórios');
reject('no fake finance UI introduced', 'Plano financeiro');

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S01.2 flow simplification contract tests passed (18 assertions).');
