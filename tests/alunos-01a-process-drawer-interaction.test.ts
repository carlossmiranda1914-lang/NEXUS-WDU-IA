import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');
const failures: string[] = [];
let assertions = 0;
const expect = (condition: unknown, message: string) => { assertions += 1; if (!condition) failures.push(message); };

expect(source.includes('currentStage: string'), 'Process drawer must consume the server-owned current stage.');
expect(source.includes('progress: { completed: number; applicable: number; percent: number }'), 'Process drawer must consume server-owned progress.');
expect(source.includes('evidence: { summary: string; source: string }'), 'Process drawer must retain stage evidence.');
expect(source.includes('blockers: Array<'), 'Process drawer must retain server-provided blockers.');
expect(source.includes('nextAction: ProcessAction | null'), 'Process drawer must retain the next available action.');
expect(source.includes('<EnrollmentLifecycleActions status={process.enrollmentStatus} light={light}'), 'Process drawer must retain the existing version-aware lifecycle action component.');
expect(source.includes('Versão') && source.includes('process.version'), 'Process drawer must surface the confirmed process version.');
expect(!source.includes('ID do processo'), 'Process drawer must not display an internal process identifier.');
expect(source.includes('aria-label="Fechar processo"'), 'Process drawer must retain its close action.');
expect(source.includes('motion-reduce:'), 'Animated process-drawer elements must provide reduced-motion treatment.');

if (failures.length) throw new Error(failures.join('\n'));
console.log(`ALUNOS-01A process drawer interaction contract passed (${assertions} assertions).`);
