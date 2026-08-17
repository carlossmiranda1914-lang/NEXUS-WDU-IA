import { readFile } from 'node:fs/promises';

const source = (await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8')).replace(/\r\n/g, '\n');
const failures: string[] = [];

function expectContains(label: string, token: string) {
  if (!source.includes(token)) failures.push(label);
}

function expectNotContains(label: string, token: string) {
  if (source.includes(token)) failures.push(label);
}

expectContains('Workspace must contain horizontal overflow locally.', 'min-w-0 max-w-full space-y-5 overflow-x-hidden');
expectContains('Institution header must wrap safely.', 'break-words text-[10px]');
expectContains('Header actions must stack on mobile.', 'grid w-full grid-cols-1 gap-2 sm:flex');
expectContains('Refresh action must be full-width on mobile.', 'min-h-11 w-full items-center justify-center');
expectContains('Primary action must be full-width on mobile.', 'min-h-11 w-full min-w-0 items-center justify-center');
expectContains('Tabs must use contained horizontal scrolling.', 'max-w-full gap-1 overflow-x-auto overscroll-x-contain');
expectContains('Pipeline must use contained horizontal scrolling.', 'max-w-full snap-x snap-mandatory');
expectContains('Pipeline mobile cards must have adaptive viewport width.', 'auto-cols-[minmax(168px,78vw)]');
expectContains('Pipeline intermediate cards must avoid tablet-sized columns at 1024px.', 'lg:auto-cols-[minmax(176px,24vw)]');
expectContains('Pipeline stages must preserve a coherent minimum width on wide layouts.', 'xl:auto-cols-[minmax(168px,1fr)]');
expectContains('Pipeline labels must wrap only at normal word boundaries.', 'whitespace-normal break-normal text-sm font-semibold leading-5 [overflow-wrap:normal]');
expectNotContains('Pipeline labels must never hide their meaning with truncation.', 'flex-1 truncate text-sm font-semibold');
expectContains('Pipeline available stages must be interactive buttons.', 'aria-label={stage.available ? `Abrir etapa ${stage.label}`');
expectContains('Unavailable pipeline stages must remain disabled.', 'disabled={!stage.available}');
expectContains('Pipeline click must filter by real persisted statuses.', 'setStatusFilter(stage.statuses)');
expectContains('Entry pipeline stage must route to Entradas.', "stage.id === 'entry' ? 'entries'");
expectContains('Activation pipeline stage must route to Alunos.', "stage.id === 'activation' ? 'students'");
expectContains('Available pipeline stages must communicate affordance through the whole actionable card.', 'cursor-pointer');
expectContains('Search input must have accessible label.', 'aria-label="Procurar processos"');
expectContains('Search text must have sufficient icon separation.', 'pl-12 pr-3 text-sm');
expectContains('Process rows must bypass the global button display, centered text, and fixed-height rule.', 'className={`!grid h-auto w-full min-w-0 grid-cols-1');
expectContains('Process rows must remain vertical cards on mobile.', 'grid-cols-1 gap-x-5 gap-y-4');
expectContains('Process rows must use a hybrid two-column tablet layout.', 'md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]');
expectContains('Process rows must delay the dense desktop grid until 1024px.', 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_7.5rem_1rem]');
expectContains('Desktop process rows must keep date and chevron in separate grid columns.', 'lg:contents');
expectContains('Critical student names must wrap instead of truncate.', 'line-clamp-2 break-words text-sm font-semibold leading-5');
expectContains('Critical next actions must wrap inside their own region.', '<p className="break-words leading-5 [overflow-wrap:anywhere]">{nextAction(record)}</p>');
expectNotContains('Old two-column mobile action grid must be gone.', 'grid-cols-[auto_minmax(0,1fr)]');
expectNotContains('Pipeline stage must no longer be a passive div.', '<div key={stage.id} className={`relative min-w-0 snap-start rounded-xl');

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S01.1 responsive/interaction contract tests passed (18 assertions).');
