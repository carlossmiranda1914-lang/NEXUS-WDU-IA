import { readFile } from 'node:fs/promises';

const source = (await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8')).replace(/\r\n/g, '\n');
const failures: string[] = [];

function expect(label: string, token: string) {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
}
function reject(label: string, token: string) {
  if (source.includes(token)) failures.push(`${label}: forbidden ${token}`);
}

// S01 baseline requirements, expressed against the current approved S01.1 implementation.
// These checks intentionally validate outcomes rather than obsolete intermediate Tailwind literals.
expect('workspace bounded to viewport', 'min-w-0 max-w-full space-y-5 overflow-x-hidden sm:space-y-6');
expect('responsive header breakpoint', 'xl:flex-row xl:items-end xl:justify-between');
expect('institution header wraps safely', 'break-words text-[10px]');
expect('mobile actions stack safely', 'grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto');
expect('refresh action touch target', 'min-h-11 w-full items-center justify-center');
expect('primary action touch target', 'min-h-11 w-full min-w-0 items-center justify-center');
expect('touch target tabs', 'min-h-11 whitespace-nowrap');
expect('metrics 1/2/4 responsive grid', 'grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4');
expect('metric stable height', 'flex min-h-40 min-w-0 flex-col');
expect('metric numeric stability', 'tabular-nums');
expect('metric description anchored', 'mt-auto pt-4');
expect('pipeline mobile horizontal track', 'max-w-full snap-x snap-mandatory grid-flow-col');
expect('pipeline desktop full grid', 'xl:grid-flow-row xl:grid-cols-7');
expect('search icon noninteractive', 'pointer-events-none absolute left-4');
expect('search accessible label', 'aria-label="Procurar processos"');
expect('search text clearance', 'pl-12 pr-3 text-sm');
expect('compact empty state', 'min-h-36');
expect('real institution context retained', 'setInstitutionName(context.institution?.name');
expect('real metrics retained', 'const metrics = useMemo(() => buildOperationalMetrics(records)');
expect('real pipeline retained', 'const pipeline = useMemo(() => pipelineCounts(records)');
expect('real attention retained', 'const attention = useMemo(() => getAttentionQueue(records)');

reject('old cramped metrics grid removed', 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4');
reject('old oversized empty state removed', 'min-h-48 flex-col');
reject('old search padding removed', 'pl-9 pr-3 text-sm');
reject('obsolete S01 search padding removed', 'pl-11 pr-3 text-sm');
reject('legacy student list remains absent', '<StudentsList');
reject('legacy enrollment workspace remains absent', '<EnrollmentWorkspace');

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S01 visual contract tests passed (27 assertions).');
