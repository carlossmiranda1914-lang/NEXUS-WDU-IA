import { readFile } from 'node:fs/promises';

const source = (await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8')).replace(/\r\n/g, '\n');
const intakeApi = (await readFile('src/modules/enrollments/enrollment-intake-api.ts', 'utf8')).replace(/\r\n/g, '\n');
const failures: string[] = [];

function expect(label: string, token: string, haystack = source) {
  if (!haystack.includes(token)) failures.push(`${label}: missing ${token}`);
}
function reject(label: string, token: string, haystack = source) {
  if (haystack.includes(token)) failures.push(`${label}: forbidden ${token}`);
}

expect('explicit intake intent type', "type EntryIntent = 'new' | 'existing';");
expect('intent state is explicit', "const [intent, setIntent] = useState<EntryIntent | null>(null);");
expect('new student choice is visible', 'Aluno novo');
expect('existing student choice is visible', 'Aluno existente');
expect('new path starts intake directly', "intent === 'new'");
expect('new path uses protected intake endpoint', "request('/api/enrollments/intake'");
expect('existing path still resolves identity', "request('/api/enrollments/person-resolution'");
expect('existing local match can proceed', "resolution?.status === 'LOCAL_MATCH'");
expect('ambiguous identity remains blocked', 'Confirmação adicional necessária');
expect('idempotency remains present', "'Idempotency-Key': idempotencyKey");
expect('server intake re-resolves identity', 'const resolution = await resolvePersonForInstitution', intakeApi);
expect('server creates only on no match', "if (resolution.status === 'NO_MATCH')", intakeApi);
expect('server reuses local match', "if (resolution.status === 'LOCAL_MATCH' && resolution.candidatePersonId)", intakeApi);
expect('server blocks ambiguous cases', "throw new EnrollmentIntakeApiError('IDENTITY_REVIEW_REQUIRED'", intakeApi);

reject('new student must not be forced through visible identity confirmation', "intent === 'new' && <button", source);
reject('browser must not authorize person id', 'studentPersonId:', source);
reject('legacy enrollment write path remains forbidden', "request('/api/enrollments/drafts'", source);

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S02.1 intake intent contract passed (17 assertions).');
