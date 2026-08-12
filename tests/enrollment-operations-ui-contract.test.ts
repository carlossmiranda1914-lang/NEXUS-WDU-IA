import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');
const failures: string[] = [];
let assertions = 0;
const expect = (condition: unknown, message: string) => { assertions += 1; if (!condition) failures.push(message); };

expect(source.includes('Alunos & Matrículas'), 'Workspace must present the unified Alunos & Matrículas title.');
expect(source.includes('Visão Operacional'), 'Workspace must expose the approved operational view.');
expect(source.includes('Entradas'), 'Workspace must expose Entradas.');
expect(source.includes('Matrículas'), 'Workspace must expose Matrículas.');
expect(source.includes('Alunos'), 'Workspace must expose Alunos.');
expect(source.includes('O que precisa da minha atenção'), 'Secretaria must receive an exception-first work queue.');
expect(source.includes('Nova entrada / matrícula'), 'Workspace must expose the approved primary action.');
expect(source.includes("request('/api/enrollments/context')"), 'Workspace must use real institutional context.');
expect(source.includes("request('/api/enrollments')"), 'Workspace metrics and queues must use persisted enrollments.');
expect(source.includes("'/api/enrollments/person-resolution'"), 'New entry must use secure identity resolution.');
expect(source.includes("'/api/enrollments/intake'"), 'New entry must use secure transactional intake.');
expect(source.includes("'Idempotency-Key'"), 'Intake must preserve idempotent retry safety.');
expect(!source.includes("'/api/enrollments/drafts'"), 'Legacy draft endpoint must not return.');
expect(!source.includes("request('/api/enrollments', { method: 'POST'"), 'Legacy enrollment POST must not return.');
expect(!source.includes('institutionId:'), 'Browser must not supply institution authority.');
expect(!source.includes('studentPersonId:'), 'Browser must not supply global Person authority.');
expect(source.includes('Domínio ainda não persistido'), 'Unavailable pipeline domains must be explicit, never simulated.');
expect(source.includes('Não são usados registos demonstrativos'), 'Empty student view must explicitly reject demo records.');

if (failures.length) throw new Error(failures.join('\n'));
console.log(`Enrollment operations UI contract tests passed (${assertions} assertions).`);
