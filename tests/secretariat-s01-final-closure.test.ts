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
expect('human journey guidance', 'Acompanhe o percurso institucional. Cada etapa abre apenas uma vista existente');
expect('operational guidance title', 'Como trabalhar nesta');
expect('operational current-data language', 'Dados atuais');
expect('operational priority language', 'Prioridades primeiro');
expect('operational active-students language', 'Alunos ativos');
expect('drawer explicitly states entry step', 'Nova entrada / matr');
expect('journey cards keep click context', 'setSelectedLifecycleLabel(stage.label)');
expect('journey keeps stage enrollment filter', 'setJourneyEnrollmentIds(stage.enrollmentIds)');
expect('top navigation clears lifecycle context', 'setSelectedLifecycleLabel(null)');
expect('top navigation clears journey enrollment filter', 'setJourneyEnrollmentIds(null)');

reject('no technical context badge', 'Etapa do fluxo');
reject('no backend language', 'backend atual');
reject('no domain persistence jargon', 'Dom�nio ainda n�o persistido');
reject('no API implementation jargon', 'API institucional de matr�culas');
reject('no future Student 360 promise in operational UI', 'Student 360 ser� ligado');

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S01 final closure tests passed (16 assertions).');
