import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/components/EnrollmentOperationsWorkspace.tsx';
const original = await readFile(path, 'utf8');
const newline = original.includes('\r\n') ? '\r\n' : '\n';
let source = original.replace(/\r\n/g, '\n');

const postconditions = [
  'min-w-0 max-w-full space-y-5 overflow-x-hidden sm:space-y-6',
  'break-words text-[10px]',
  'grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto',
  'min-h-11 w-full items-center justify-center',
  'min-h-11 w-full min-w-0 items-center justify-center',
  'max-w-full gap-1 overflow-x-auto overscroll-x-contain',
  'max-w-full snap-x snap-mandatory grid-flow-col',
  'auto-cols-[minmax(155px,78vw)]',
  'aria-label={stage.available ? `Abrir etapa ${stage.label}`',
  'disabled={!stage.available}',
  'setStatusFilter(stage.statuses)',
  "stage.id === 'entry' ? 'entries'",
  "stage.id === 'activation' ? 'students'",
  'Abrir etapa <ChevronRight',
  'aria-label="Procurar processos"',
  'pl-12 pr-3 text-sm',
];

if (postconditions.every((token) => source.includes(token))) {
  console.log('[S01.1] PASS: responsive and pipeline interaction patch already applied; no file written.');
  process.exit(0);
}

function replaceOnce(label: string, from: string, to: string) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`[S01.1] ${label}: neither approved postcondition nor expected precondition was found; no file written.`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`[S01.1] ${label}: precondition is not unique; no file written.`);
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

replaceOnce(
  'workspace viewport containment',
  '<section className="space-y-5 sm:space-y-6" aria-label="Workspace operacional de Alunos e Matrículas">',
  '<section className="min-w-0 max-w-full space-y-5 overflow-x-hidden sm:space-y-6" aria-label="Workspace operacional de Alunos e Matrículas">',
);
replaceOnce(
  'header copy wrapping',
  '<p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Secretaria escolar · {institutionName}</p>',
  '<p className="break-words text-[10px] font-bold uppercase leading-5 tracking-[0.14em] text-indigo-500 sm:tracking-[0.18em]">Secretaria escolar · {institutionName}</p>',
);
replaceOnce(
  'header actions mobile stack',
  '<div className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:w-auto sm:flex-wrap">',
  '<div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">',
);
replaceOnce(
  'refresh action full width mobile',
  'className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-semibold',
  'className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-semibold sm:w-auto',
);
replaceOnce(
  'primary action full width mobile',
  'className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-xs font-bold text-white hover:bg-indigo-500"',
  'className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-xs font-bold text-white hover:bg-indigo-500 sm:w-auto"',
);
replaceOnce(
  'tabs local scrolling only',
  '<nav className={`flex gap-1 overflow-x-auto border-b pb-3 ${light ? \'border-zinc-200\' : \'border-white/10\'}`}',
  '<nav className={`flex max-w-full gap-1 overflow-x-auto overscroll-x-contain border-b pb-3 ${light ? \'border-zinc-200\' : \'border-white/10\'}`}',
);
replaceOnce(
  'pipeline local scrolling only',
  '<div className="grid snap-x snap-mandatory grid-flow-col auto-cols-[minmax(155px,1fr)] gap-2 overflow-x-auto pb-2 xl:grid-flow-row xl:grid-cols-7 xl:auto-cols-auto xl:overflow-visible xl:pb-0">',
  '<div className="grid max-w-full snap-x snap-mandatory grid-flow-col auto-cols-[minmax(155px,78vw)] gap-2 overflow-x-auto overscroll-x-contain pb-2 sm:auto-cols-[minmax(170px,42vw)] xl:grid-flow-row xl:grid-cols-7 xl:auto-cols-auto xl:overflow-visible xl:pb-0">',
);
replaceOnce(
  'pipeline card interactive opening',
  '<div key={stage.id} className={`relative min-w-0 snap-start rounded-xl border p-3 ${mutedSurface}`}>',
  '<button key={stage.id} type="button" disabled={!stage.available} aria-label={stage.available ? `Abrir etapa ${stage.label}` : `${stage.label}: domínio ainda não disponível`} onClick={() => { if (!stage.available) return; setStatusFilter(stage.statuses); setView(stage.id === \'entry\' ? \'entries\' : stage.id === \'activation\' ? \'students\' : \'enrollments\'); }} className={`relative min-w-0 snap-start rounded-xl border p-3 text-left transition ${mutedSurface} ${stage.available ? \'cursor-pointer hover:border-indigo-400/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40\' : \'cursor-default opacity-80\'}`}>',
);
replaceOnce(
  'pipeline card interactive closing',
  '{!stage.available && <p className={`mt-1 text-[10px] ${muted}`}>Domínio ainda não persistido</p>}\n                    </div>',
  '{!stage.available && <p className={`mt-1 text-[10px] ${muted}`}>Domínio ainda não persistido</p>}\n                      {stage.available && <p className={`mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-500`}>Abrir etapa <ChevronRight className="h-3 w-3" /></p>}\n                    </button>',
);
replaceOnce(
  'search icon separation',
  '<Search aria-hidden="true" className={`pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 ${muted}`} /><input aria-label="Procurar processos" value={query}',
  '<Search aria-hidden="true" className={`pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 ${muted}`} /><input aria-label="Procurar processos" value={query}',
);
replaceOnce(
  'search text separation',
  'className={`min-h-11 w-full rounded-lg border py-2.5 pl-11 pr-3 text-sm outline-none focus:border-indigo-500',
  'className={`min-h-11 w-full rounded-lg border py-2.5 pl-12 pr-3 text-sm outline-none focus:border-indigo-500',
);

for (const token of postconditions) {
  if (!source.includes(token)) throw new Error(`[S01.1] required postcondition missing after transformation: ${token}; no file written.`);
}

if (source === original.replace(/\r\n/g, '\n')) throw new Error('[S01.1] no changes produced and approved postconditions were incomplete.');
await writeFile(path, source.replace(/\n/g, newline), 'utf8');
console.log('[S01.1] PASS: responsive and pipeline interaction patch applied through asserted, unique patterns.');
