import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EnrollmentWorkspace.tsx', import.meta.url), 'utf8');
const failures: string[] = [];
let assertions = 0;
function expect(condition: unknown, message: string) { assertions += 1; if (!condition) failures.push(message); }

expect(source.includes("'/api/enrollments/person-resolution'"), 'T7 UI must resolve identity before intake.');
expect(source.includes("'/api/enrollments/intake'"), 'T7 UI must use the secure T6 intake endpoint.');
expect(source.includes("'/api/enrollments/identity-decisions'"), 'T7 UI must use the T5 decision path for review cases.');
expect(source.includes("'Idempotency-Key'"), 'T7 UI must send an idempotency key for intake retry safety.');
expect(!source.includes("'/api/enrollments/drafts'"), 'T7 UI must never reintroduce the legacy draft write endpoint.');
expect(!source.includes("request('/api/enrollments', { method: 'POST'"), 'T7 UI must never reintroduce the legacy enrollment POST.');
expect(!source.includes('institutionId:'), 'T7 UI must not send institutionId as client authority.');
expect(!source.includes('studentPersonId:'), 'T7 UI must not send studentPersonId as client authority.');
expect(source.includes('Identificar aluno'), 'T7 UI must expose the Identificar step in non-technical language.');
expect(source.includes('Iniciar matrícula'), 'T7 UI must expose the final Iniciar action.');
expect(source.includes('possível registo que não pode ser apresentado aqui') || source.includes('possible'), 'Restricted-match UI must avoid exposing protected candidate details.');

if (failures.length) throw new Error(failures.join('\n'));
console.log(`Enrollment UI contract tests passed (${assertions} assertions).`);
