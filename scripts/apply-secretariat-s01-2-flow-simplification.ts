import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/components/EnrollmentOperationsWorkspace.tsx';
const raw = await readFile(path, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
let source = raw.replace(/\r\n/g, '\n');

const done = [
  "const [selectedStageId, setSelectedStageId] = useState<string | null>(null);",
  "const selectedStage = selectedStageId ? PIPELINE_CONTEXT[selectedStageId] : null;",
  "Ainda não disponível",
  "selectedStage?.label",
].every((token) => source.includes(token)) && !source.includes('Abrir etapa <ChevronRight');

if (done) {
  console.log('[S01.2] PASS: flow simplification already applied; no file written.');
  process.exit(0);
}

function replaceOnce(label: string, from: string, to: string) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`[S01.2] ${label}: expected pattern not found; no file written.`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`[S01.2] ${label}: pattern is not unique; no file written.`);
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

replaceOnce(
  'pipeline context model',
  "type Resolution = {\n  status: 'NO_MATCH' | 'LOCAL_MATCH' | 'REUSABLE_MATCH' | 'MULTIPLE_MATCHES' | 'RESTRICTED_POSSIBLE_MATCH' | 'REVIEW_REQUIRED';\n  candidateCount: number;\n};",
  "type Resolution = {\n  status: 'NO_MATCH' | 'LOCAL_MATCH' | 'REUSABLE_MATCH' | 'MULTIPLE_MATCHES' | 'RESTRICTED_POSSIBLE_MATCH' | 'REVIEW_REQUIRED';\n  candidateCount: number;\n};\n\ntype PipelineContext = { label: string; description: string };\n\nconst PIPELINE_CONTEXT: Record<string, PipelineContext> = {\n  entry: { label: 'Entrada', description: 'Processos iniciados que ainda precisam de tratamento pela Secretaria.' },\n  documents: { label: 'Documentos', description: 'Matrículas que aguardam documentação necessária para continuar.' },\n  verification: { label: 'Verificação', description: 'Processos em análise e validação antes da decisão.' },\n  decision: { label: 'Decisão', description: 'Processos validados e preparados para a decisão autorizada.' },\n  activation: { label: 'Ativação', description: 'Alunos cuja matrícula já está ativa no contexto escolar.' },\n};"
);

replaceOnce(
  'selected stage state',
  "  const [selected, setSelected] = useState<EnrollmentOperationalRecord | null>(null);\n  const [newEntryOpen, setNewEntryOpen] = useState(false);",
  "  const [selected, setSelected] = useState<EnrollmentOperationalRecord | null>(null);\n  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);\n  const [newEntryOpen, setNewEntryOpen] = useState(false);"
);

replaceOnce(
  'selected stage derivation',
  "  const attention = useMemo(() => getAttentionQueue(records), [records]);\n  const visible = useMemo(() => {",
  "  const attention = useMemo(() => getAttentionQueue(records), [records]);\n  const selectedStage = selectedStageId ? PIPELINE_CONTEXT[selectedStageId] : null;\n  const visible = useMemo(() => {"
);

replaceOnce(
  'top navigation clears contextual stage',
  "onClick={() => { setView(item.id); setStatusFilter(null); }}",
  "onClick={() => { setView(item.id); setStatusFilter(null); setSelectedStageId(null); }}"
);

replaceOnce(
  'pipeline explanatory copy',
  "A contagem aparece apenas nas etapas que já têm estado persistido no backend atual.",
  "Acompanhe o percurso da matrícula. Selecione uma etapa disponível para abrir a respetiva fila de trabalho."
);

replaceOnce(
  'pipeline interaction and visual simplification',
  "onClick={() => { if (!stage.available) return; setStatusFilter(stage.statuses); setView(stage.id === 'entry' ? 'entries' : stage.id === 'activation' ? 'students' : 'enrollments'); }} className={`relative min-w-0 snap-start rounded-xl border p-3 text-left transition ${mutedSurface} ${stage.available ? 'cursor-pointer hover:border-indigo-400/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40' : 'cursor-default opacity-80'}`}>\n                      <div className=\"flex items-center gap-2\"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${light ? 'bg-zinc-200 text-zinc-700' : 'bg-white/10 text-zinc-300'}`}>{index + 1}</span><p className={`text-xs font-semibold ${text}`}>{stage.label}</p></div>\n                      <p className={`mt-3 text-xl font-bold ${stage.available ? text : muted}`}>{stage.available ? stage.count : '—'}</p>\n                      {!stage.available && <p className={`mt-1 text-[10px] ${muted}`}>Domínio ainda não persistido</p>}\n                      {stage.available && <p className={`mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-500`}>Abrir etapa <ChevronRight className=\"h-3 w-3\" /></p>}",
  "onClick={() => { if (!stage.available) return; setSelectedStageId(stage.id); setStatusFilter(stage.statuses); setView(stage.id === 'entry' ? 'entries' : stage.id === 'activation' ? 'students' : 'enrollments'); }} className={`group relative min-w-0 snap-start rounded-xl border p-3 text-left transition ${mutedSurface} ${stage.available ? 'cursor-pointer hover:border-indigo-400/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40' : 'cursor-default opacity-65'}`}>\n                      <div className=\"flex min-w-0 items-center gap-2\">\n                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${light ? 'bg-zinc-200 text-zinc-700' : 'bg-white/10 text-zinc-300'}`}>{index + 1}</span>\n                        <p className={`min-w-0 flex-1 truncate text-sm font-semibold ${text}`}>{stage.label}</p>\n                        <span className={`shrink-0 text-sm font-bold tabular-nums ${stage.available ? text : muted}`}>{stage.available ? stage.count : '—'}</span>\n                        {stage.available && <ChevronRight className=\"h-4 w-4 shrink-0 text-indigo-500 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100\" />}\n                      </div>\n                      {!stage.available && <p className={`mt-2 pl-8 text-[11px] ${muted}`}>Ainda não disponível</p>}"
);

replaceOnce(
  'contextual list header',
  "<div><h2 className={`font-semibold ${text}`}>{VIEW_LABELS.find((item) => item.id === view)?.label}</h2><p className={`mt-1 text-xs ${muted}`}>{visible.length} registo{visible.length === 1 ? '' : 's'} real{visible.length === 1 ? '' : 'is'} nesta vista.</p></div>",
  "<div className=\"min-w-0\"><div className=\"flex flex-wrap items-center gap-2\"><h2 className={`font-semibold ${text}`}>{selectedStage?.label || VIEW_LABELS.find((item) => item.id === view)?.label}</h2>{selectedStage && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${light ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300'}`}>Etapa do fluxo</span>}</div><p className={`mt-1 text-xs leading-5 ${muted}`}>{selectedStage?.description || `${visible.length} registo${visible.length === 1 ? '' : 's'} real${visible.length === 1 ? '' : 'is'} nesta vista.`}</p>{selectedStage && <p className={`mt-1 text-[11px] ${muted}`}>{visible.length} processo{visible.length === 1 ? '' : 's'} nesta etapa.</p>}</div>"
);

for (const forbidden of ['Abrir etapa <ChevronRight', 'Domínio ainda não persistido']) {
  if (source.includes(forbidden)) throw new Error(`[S01.2] forbidden legacy flow copy remains: ${forbidden}`);
}
for (const required of ['setSelectedStageId(stage.id)', 'Ainda não disponível', 'selectedStage?.label', 'Etapa do fluxo']) {
  if (!source.includes(required)) throw new Error(`[S01.2] required postcondition missing: ${required}`);
}

await writeFile(path, source.replace(/\n/g, eol), 'utf8');
console.log('[S01.2] PASS: flow simplification applied through asserted, unique patterns.');
