import { readFile } from 'node:fs/promises';

const workspace = await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8');
const drawer = await readFile('src/components/EnrollmentNewEntryDrawer.tsx', 'utf8');
const selector = await readFile('src/components/EnrollmentEntryIntentSelector.tsx', 'utf8');
const client = await readFile('src/modules/enrollments/enrollment-intake-client.ts', 'utf8');
const intakeApi = await readFile('src/modules/enrollments/enrollment-intake-api.ts', 'utf8');
const failures: string[] = [];

function expect(label: string, token: string, source: string) {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
}
function reject(label: string, token: string, source: string) {
  if (source.includes(token)) failures.push(`${label}: forbidden ${token}`);
}

expect('workspace imports new drawer', "import EnrollmentNewEntryDrawer from './EnrollmentNewEntryDrawer.tsx';", workspace);
expect('workspace renders new drawer', '<EnrollmentNewEntryDrawer offers={offers}', workspace);
expect('explicit intake intent type', "type EntryIntent = 'new' | 'existing';", drawer);
expect('intent state is explicit', "const [intent, setIntent] = useState<EntryIntent | null>(null);", drawer);
expect('new student choice is visible', 'Aluno novo', selector);
expect('existing student choice is visible', 'Aluno existente', selector);
expect('new path submits directly', "intent === 'existing' ? identify", drawer);
expect('existing path resolves first', 'resolveExistingStudent(student)', drawer);
expect('existing local match can proceed', "resolution?.status === 'LOCAL_MATCH'", drawer);
expect('ambiguous identity remains blocked', 'Confirmação adicional necessária', drawer);
expect('protected intake endpoint', "request('/api/enrollments/intake'", client);
expect('existing resolution endpoint', "request('/api/enrollments/person-resolution'", client);
expect('idempotency remains present', "'Idempotency-Key': idempotencyKey", client);
expect('server intake re-resolves identity', 'const resolution = await resolvePersonForInstitution', intakeApi);
expect('server creates only on no match', "if (resolution.status === 'NO_MATCH')", intakeApi);
expect('server reuses local match', "if (resolution.status === 'LOCAL_MATCH' && resolution.candidatePersonId)", intakeApi);
expect('server blocks ambiguous cases', "throw new EnrollmentIntakeApiError('IDENTITY_REVIEW_REQUIRED'", intakeApi);
reject('new student must not be forced through visible identity confirmation', "intent === 'new' && <button", drawer);
reject('browser must not authorize person id', 'studentPersonId:', drawer + client);
reject('legacy enrollment write path remains forbidden', "'/api/enrollments/drafts'", drawer + client);
reject('new path must not call resolution helper', "intent === 'new' && resolveExistingStudent", drawer);

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S02.1 intake intent contract passed (21 assertions).');
