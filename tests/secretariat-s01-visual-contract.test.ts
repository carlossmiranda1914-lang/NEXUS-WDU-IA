import { readFile } from 'node:fs/promises';

const source = await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8');
const failures: string[] = [];

function expect(label: string, token: string) {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
}
function reject(label: string, token: string) {
  if (source.includes(token)) failures.push(`${label}: forbidden ${token}`);
}

expect('mobile workspace rhythm', 'space-y-5 sm:space-y-6');
expect('responsive header breakpoint', 'xl:flex-row xl:items-end xl:justify-between');
expect('mobile action layout', 'grid w-full grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:w-auto');
expect('touch target actions', 'min-h-11 items-center justify-center');
expect('touch target tabs', 'min-h-11 whitespace-nowrap');
expect('metrics 1/2/4 responsive grid', 'grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4');
expect('metric stable height', 'flex min-h-40 min-w-0 flex-col');
expect('metric numeric stability', 'tabular-nums');
expect('metric description anchored', 'mt-auto pt-4');
expect('pipeline mobile horizontal track', 'snap-x snap-mandatory grid-flow-col');
expect('pipeline desktop full grid', 'xl:grid-flow-row xl:grid-cols-7');
expect('search icon noninteractive', 'pointer-events-none absolute left-3.5');
expect('search accessible label', 'aria-label="Procurar processos"');
expect('search text clearance', 'pl-11 pr-3');
expect('compact empty state', 'min-h-36');
expect('real institution context retained', 'setInstitutionName(context.institution?.name');
expect('real metrics retained', 'const metrics = useMemo(() => buildOperationalMetrics(records)');
expect('real pipeline retained', 'const pipeline = useMemo(() => pipelineCounts(records)');
expect('real attention retained', 'const attention = useMemo(() => getAttentionQueue(records)');

reject('old cramped metrics grid removed', 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4');
reject('old oversized empty state removed', 'min-h-48 flex-col');
reject('old search padding removed', 'pl-9 pr-3 text-sm');
reject('legacy student list remains absent', '<StudentsList');
reject('legacy enrollment workspace remains absent', '<EnrollmentWorkspace');

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S01 visual contract tests passed (23 assertions).');
