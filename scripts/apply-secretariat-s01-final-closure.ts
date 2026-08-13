import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/components/EnrollmentOperationsWorkspace.tsx';
const raw = await readFile(path, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
let source = raw.replace(/\r\n/g, '\n');

const requiredS012 = [
  "const [selectedStageId, setSelectedStageId] = useState<string | null>(null);",
  "const selectedStage = selectedStageId ? PIPELINE_CONTEXT[selectedStageId] : null;",
  'Ainda não disponível',
  'selectedStage?.label',
];

for (const token of requiredS012) {
  if (!source.includes(token)) {
    throw new Error(`[S01-FINAL] prerequisite missing: ${token}. Apply and validate S01.2 first; no file written.`);
  }
}

const finalTokens = [
  '>Secretaria escolar</p>',
  'Este é o primeiro passo da matrícula.',
  'Como trabalhar nesta área',
  'A vista Alunos apresenta apenas matrículas já ativadas.',
  'Este painel reúne o estado atual da matrícula e a próxima ação necessária.',
].every((token) => source.includes(token));

const forbiddenFinal = [
  'Etapa do fluxo',
  'Todos os totais vêm da API institucional de matrículas.',
  'Student 360 será ligado nessa continuidade.',
  'Nesta primeira camada o painel apresenta apenas dados já persistidos.',
  'Secretaria escolar · {institutionName}',
].every((token) => !source.includes(token));

if (finalTokens && forbiddenFinal) {
  console.log('[S01-FINAL] PASS: final language and interaction closure already applied; no file written.');
  process.exit(0);
}

function replaceOnce(label: string, from: string, to: string) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`[S01-FINAL] ${label}: expected pattern not found; no file written.`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`[S01-FINAL] ${label}: pattern is not unique; no file written.`);
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

replaceOnce(
  'institution eyebrow',
  'Secretaria escolar · {institutionName}',
  'Secretaria escolar'
);

replaceOnce(
  'context badge removal',
  "{selectedStage && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${light ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300'}`}>Etapa do fluxo</span>}",
  ''
);

replaceOnce(
  'operational note title',
  'Leitura operacional',
  'Como trabalhar nesta área'
);
replaceOnce(
  'operational note data title',
  'Sem números demonstrativos',
  'Dados atuais'
);
replaceOnce(
  'operational note data body',
  'Todos os totais vêm da API institucional de matrículas.',
  'Os indicadores refletem os processos desta instituição.'
);
replaceOnce(
  'operational note priority title',
  'Trabalho por exceção',
  'Prioridades primeiro'
);
replaceOnce(
  'operational note priority body',
  'Casos bloqueados e pendentes aparecem antes de processos normais.',
  'Pendências e bloqueios aparecem antes dos processos regulares.'
);
replaceOnce(
  'operational note active title',
  'Aluno ativo é outra fase',
  'Alunos ativos'
);
replaceOnce(
  'operational note active body',
  'A vista Alunos contém apenas matrículas ativas; Student 360 será ligado nessa continuidade.',
  'A vista Alunos apresenta apenas matrículas já ativadas.'
);

replaceOnce(
  'process drawer implementation language',
  'Nesta primeira camada o painel apresenta apenas dados já persistidos. Requisitos, documentos, financeiro e timeline serão acrescentados quando os respetivos domínios reais entrarem na vertical.',
  'Este painel reúne o estado atual da matrícula e a próxima ação necessária.'
);

replaceOnce(
  'new entry continuity copy',
  'Começamos pelos dados mínimos para identificar corretamente a pessoa. Os dados completos, encarregado, documentos e condições serão recolhidos nas etapas seguintes do processo.',
  'Este é o primeiro passo da matrícula. Confirme os dados mínimos para identificar corretamente a pessoa; depois, o processo continua com os dados pessoais, responsáveis, documentos e restantes condições exigidas pela instituição.'
);

const forbidden = [
  'Etapa do fluxo',
  'Domínio ainda não persistido',
  'Abrir etapa <ChevronRight',
  'Todos os totais vêm da API institucional de matrículas.',
  'backend atual',
  'Student 360 será ligado',
  'Nesta primeira camada',
  'Secretaria escolar · {institutionName}',
];
for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`[S01-FINAL] forbidden end-user/development copy remains: ${token}`);
}

const required = [
  '>Secretaria escolar</p>',
  'Acompanhe o percurso da matrícula.',
  'Ainda não disponível',
  'Como trabalhar nesta área',
  'Dados atuais',
  'Prioridades primeiro',
  'Alunos ativos',
  'Este é o primeiro passo da matrícula.',
  'Este painel reúne o estado atual da matrícula e a próxima ação necessária.',
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`[S01-FINAL] required postcondition missing: ${token}`);
}

await writeFile(path, source.replace(/\n/g, eol), 'utf8');
console.log('[S01-FINAL] PASS: final language and interaction closure applied through asserted, unique patterns.');
