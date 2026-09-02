import { readFile } from 'node:fs/promises';

const source = (await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8')).replace(/\r\n/g, '\n');
const failures: string[] = [];

function expect(label: string, token: string) {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
}
function reject(label: string, token: string) {
  if (source.includes(token)) failures.push(`${label}: forbidden ${token}`);
}

// Current accepted visual and layout invariants for EnrollmentOperationsWorkspace
expect('workspace bounded to viewport', 'min-w-0 max-w-full space-y-5 overflow-x-hidden sm:space-y-6');
expect('responsive header breakpoint', 'xl:flex-row xl:items-end xl:justify-between');
expect('institution header wraps safely', 'break-words text-[10px]');
expect('mobile actions stack safely', 'grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto');
expect('refresh action touch target', 'min-h-11 w-full items-center justify-center');
expect('primary action touch target', 'min-h-11 w-full min-w-0 items-center justify-center');
expect('touch target tabs', 'min-h-11 whitespace-nowrap');
expect('journey rail horizontal track', 'max-w-full snap-x snap-mandatory grid-flow-col');
expect('journey rail contained horizontally', 'overflow-x-auto overscroll-x-contain');
expect('journey rail desktop column sizing', 'xl:auto-cols-[minmax(168px,1fr)]');
expect('search icon noninteractive', 'pointer-events-none absolute left-4');
expect('search accessible label', 'aria-label="Procurar processos"');
expect('search text clearance', 'pl-12 pr-3 text-sm');
expect('real institution context retained', 'setInstitutionName(context.value.institution?.name');
expect('real attention queue retained', 'const attention = useMemo(() => getAttentionQueue(records)');
expect('server-backed lifecycle retained', 'const lifecycle = useMemo(() => buildEnrollmentLifecyclePresentation(processes, activeStudents.length)');
expect('active students view present', 'ActiveStudentsView');

reject('legacy student list remains absent', '<StudentsList');
reject('legacy enrollment workspace remains absent', '<EnrollmentWorkspace');

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S01 visual contract tests passed (18 assertions).');
