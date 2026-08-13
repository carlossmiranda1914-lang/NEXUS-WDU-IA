import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/components/EnrollmentOperationsWorkspace.tsx';
const original = await readFile(path, 'utf8');
const newline = original.includes('\r\n') ? '\r\n' : '\n';
let source = original.replace(/\r\n/g, '\n');

function replaceOnce(label: string, from: string, to: string) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`[S01] ${label}: expected pattern not found; no file written.`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`[S01] ${label}: pattern is not unique; no file written.`);
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

replaceOnce('workspace rhythm', '<section className="space-y-6" aria-label="Workspace operacional de Alunos e Matrículas">', '<section className="space-y-5 sm:space-y-6" aria-label="Workspace operacional de Alunos e Matrículas">');
replaceOnce('header responsiveness', '<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">', '<header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">');
replaceOnce('header copy width', '<div className="space-y-1.5">', '<div className="min-w-0 space-y-1.5">');
replaceOnce('header actions', '<div className="flex flex-wrap gap-2">', '<div className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:w-auto sm:flex-wrap">');
replaceOnce('refresh action sizing', 'className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-semibold', 'className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-semibold');
replaceOnce('primary action sizing', 'className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500"', 'className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-xs font-bold text-white hover:bg-indigo-500"');
replaceOnce('tab touch targets', 'className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition', 'className={`min-h-11 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition');
replaceOnce('metrics breakpoints', '<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">', '<div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">');
replaceOnce('metric card structure', 'className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${surface}`}', 'className={`flex min-h-40 min-w-0 flex-col rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${surface}`}');
replaceOnce('metric content min width', '<div className="flex items-start justify-between gap-3">\n                      <div><p className={`text-xs font-semibold ${muted}`}>{metric.label}</p><p className={`mt-2 text-3xl font-bold ${text}`}>{metric.value}</p></div>', '<div className="flex min-w-0 items-start justify-between gap-3">\n                      <div className="min-w-0"><p className={`text-xs font-semibold leading-5 ${muted}`}>{metric.label}</p><p className={`mt-2 text-3xl font-bold tabular-nums ${text}`}>{metric.value}</p></div>');
replaceOnce('metric description anchoring', '<p className={`mt-3 text-xs leading-5 ${muted}`}>{metric.description}</p>', '<p className={`mt-auto pt-4 text-xs leading-5 ${muted}`}>{metric.description}</p>');
replaceOnce('pipeline adaptive track', '<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">', '<div className="grid snap-x snap-mandatory grid-flow-col auto-cols-[minmax(155px,1fr)] gap-2 overflow-x-auto pb-2 xl:grid-flow-row xl:grid-cols-7 xl:auto-cols-auto xl:overflow-visible xl:pb-0">');
replaceOnce('pipeline card snap', 'className={`relative rounded-xl border p-3 ${mutedSurface}`}', 'className={`relative min-w-0 snap-start rounded-xl border p-3 ${mutedSurface}`}');
replaceOnce('overview columns breakpoint', '<div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">', '<div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] 2xl:gap-6">');
replaceOnce('list search wrapper', '<div className="relative w-full sm:w-72"><Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${muted}`} /><input value={query}', '<div className="relative w-full sm:w-80"><Search aria-hidden="true" className={`pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 ${muted}`} /><input aria-label="Procurar processos" value={query}');
replaceOnce('list search input spacing', 'className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500', 'className={`min-h-11 w-full rounded-lg border py-2.5 pl-11 pr-3 text-sm outline-none focus:border-indigo-500');
replaceOnce('empty state density', 'return <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">', 'return <div className="flex min-h-36 flex-col items-center justify-center px-6 py-8 text-center sm:min-h-40">');

const forbidden = [
  'grid gap-3 sm:grid-cols-2 xl:grid-cols-4',
  'min-h-48 flex-col',
  'pl-9 pr-3 text-sm',
];
for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`[S01] forbidden pre-fix token remains: ${token}`);
}

if (source === original.replace(/\r\n/g, '\n')) throw new Error('[S01] no changes produced.');
await writeFile(path, source.replace(/\n/g, newline), 'utf8');
console.log('[S01] PASS: visual integrity patch applied through asserted, unique patterns.');
