import { readFile } from 'node:fs/promises';

const source = (await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8')).replace(/\r\n/g, '\n');
const failures: string[] = [];

function expect(label: string, token: string) {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
}
function reject(label: string, token: string) {
  if (source.includes(token)) failures.push(`${label}: forbidden ${token}`);
}

expect('clean secretariat eyebrow', '>Secretaria escolar</p>');
expect('human pipeline guidance', 'Acompanhe o percurso da matrícula.');
expect('unavailable stage product language', 'Ainda não disponível');
expect('operational guidance title', 'Como trabalhar nesta área');
expect('operational current-data language', 'Dados atuais');
expect('operational priority language', 'Prioridades primeiro');
expect('operational active-students language', 'Alunos ativos');
expect('drawer explicitly states first step', 'Este é o primeiro passo da matrícula.');
expect('drawer explains continuation', 'responsáveis, documentos e restantes condições exigidas pela instituição');
expect('process drawer end-user copy', 'Este painel reúne o estado atual da matrícula e a próxima ação necessária.');
expect('pipeline cards keep click context', 'setSelectedStageId(stage.id)');
expect('pipeline keeps persisted filters', 'setStatusFilter(stage.statuses)');
expect('pipeline unavailable state remains disabled', 'disabled={!stage.available}');
expect('top navigation clears pipeline context', 'setSelectedStageId(null)');

reject('no technical context badge', 'Etapa do fluxo');
reject('no backend language', 'backend atual');
reject('no domain persistence jargon', 'Domínio ainda não persistido');
reject('no API implementation jargon', 'API institucional de matrículas');
reject('no future Student 360 promise in operational UI', 'Student 360 será ligado');
reject('no implementation-layer language', 'Nesta primeira camada');
reject('no malformed institution separator source', 'Secretaria escolar · {institutionName}');
reject('no repeated open-stage microcopy', 'Abrir etapa <ChevronRight');

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S01 final closure tests passed (22 assertions).');
