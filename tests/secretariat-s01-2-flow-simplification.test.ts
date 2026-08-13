import { readFile } from 'node:fs/promises';

const source = (await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8')).replace(/\r\n/g, '\n');
const failures: string[] = [];

function expect(label: string, token: string) {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
}
function reject(label: string, token: string) {
  if (source.includes(token)) failures.push(`${label}: forbidden ${token}`);
}

expect('pipeline context state', "const [selectedStageId, setSelectedStageId] = useState<string | null>(null);");
expect('pipeline context model', 'const PIPELINE_CONTEXT: Record<string, PipelineContext>');
expect('pipeline click stores selected stage', 'setSelectedStageId(stage.id)');
expect('top navigation clears selected stage', 'setSelectedStageId(null)');
expect('available stage remains full-card action', 'disabled={!stage.available}');
expect('pipeline keeps real persisted filters', 'setStatusFilter(stage.statuses)');
expect('entry stage remains mapped to entries', "stage.id === 'entry' ? 'entries'");
expect('activation stage remains mapped to students', "stage.id === 'activation' ? 'students'");
expect('pipeline count remains real', "stage.available ? stage.count : '—'");
expect('unavailable product language', 'Ainda não disponível');
expect('selected stage contextual heading', 'selectedStage?.label');
expect('selected stage contextual description', 'selectedStage?.description');
expect('selected stage process count', 'processo{visible.length === 1');
expect('selected stage badge', 'Etapa do fluxo');
expect('simplified pipeline typography', 'truncate text-sm font-semibold');
expect('whole card indicates navigation', 'group-hover:translate-x-0.5');

reject('repeated open-stage label removed', 'Abrir etapa <ChevronRight');
reject('technical backend language removed', 'Domínio ainda não persistido');
reject('pipeline must not become separate top-level navigation', "{ id: 'documents', label: 'Documentos' }");
reject('no fake document UI introduced', 'Documentos obrigatórios');
reject('no fake finance UI introduced', 'Plano financeiro');

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S01.2 flow simplification contract tests passed (21 assertions).');
