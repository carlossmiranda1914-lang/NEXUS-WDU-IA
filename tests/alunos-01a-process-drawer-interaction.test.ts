import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');
const failures: string[] = [];
let assertions = 0;
const expect = (condition: unknown, message: string) => { assertions += 1; if (!condition) failures.push(message); };

expect(source.includes('process.currentStage'), 'Process drawer must consume the server-owned current stage.');
expect(source.includes('process.progress.percent') && source.includes('process.progress.completed') && source.includes('process.progress.applicable'), 'Process drawer must consume server-owned progress.');
expect(source.includes('currentStage?.evidence.summary') && source.includes('stage.evidence.summary'), 'Process drawer must retain stage evidence.');
expect(source.includes('process.blockers.length') && source.includes('process.blockers[0].message'), 'Process drawer must retain server-provided blockers.');
expect(source.includes('process?.nextAction?.available') && source.includes('process.nextAction.label'), 'Process drawer must retain the next available action.');
expect(source.includes('<EnrollmentLifecycleActions status={process.enrollmentStatus} light={light}'), 'Process drawer must retain the existing version-aware lifecycle action component.');
expect(source.includes('Versão') && source.includes('process.version'), 'Process drawer must surface the confirmed process version.');
expect(!source.includes('ID do processo'), 'Process drawer must not display an internal process identifier.');
expect(source.includes('aria-label="Fechar processo"'), 'Process drawer must retain its close action.');
expect(source.includes('motion-reduce:'), 'Animated process-drawer elements must provide reduced-motion treatment.');
expect(source.includes('const [drawerVisible, setDrawerVisible] = useState(false);'), 'Process drawer must maintain an enter/exit visibility state.');
expect(source.includes('requestAnimationFrame(() => setDrawerVisible(true))'), 'Process drawer must enter after mount instead of mounting at its final visual state.');
expect(source.includes("drawerVisible ? 'opacity-100' : 'opacity-0'"), 'Process drawer overlay must transition between actual opacity states.');
expect(source.includes("drawerVisible ? 'translate-x-0' : 'translate-x-full'"), 'Process drawer panel must transition between actual transform states.');
expect(source.includes("globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches"), 'Process drawer close must bypass delayed animation when reduced motion is requested.');

if (failures.length) throw new Error(failures.join('\n'));
console.log(`ALUNOS-01A process drawer interaction contract passed (${assertions} assertions).`);
