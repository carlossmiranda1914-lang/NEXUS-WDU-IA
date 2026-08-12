import {
  assertNoClientAuthority,
  buildEnrollmentIdentityCaseKey,
  EnrollmentIntakeApiError,
  parseEnrollmentStudentInput,
  resolveStudentForEnrollment,
  type EnrollmentApiPool,
} from '../src/modules/enrollments/enrollment-intake-api.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

const failures: string[] = [];
let assertions = 0;
function expect(condition: unknown, message: string) {
  assertions += 1;
  if (!condition) failures.push(message);
}

const context: InstitutionalContext = {
  personId: '11111111-1111-4111-8111-111111111111',
  personName: 'Secretaria A',
  identityEmail: 'secretaria@example.test',
  membershipId: '22222222-2222-4222-8222-222222222222',
  institutionId: '33333333-3333-4333-8333-333333333333',
  institutionName: 'Escola A',
  institutionSlug: 'escola-a',
  role: 'secretariat',
};

for (const forbidden of [
  { institutionId: 'other', student: { name: 'Aluno Exemplo' } },
  { role: 'institution_admin', student: { name: 'Aluno Exemplo' } },
  { approved: true, student: { name: 'Aluno Exemplo' } },
  { academicYearId: '44444444-4444-4444-8444-444444444444', student: { name: 'Aluno Exemplo' } },
  { studentPersonId: '55555555-5555-4555-8555-555555555555', student: { name: 'Aluno Exemplo' } },
  { student: { name: 'Aluno Exemplo', personId: '55555555-5555-4555-8555-555555555555' } },
]) {
  let error: unknown;
  try { assertNoClientAuthority(forbidden); } catch (caught) { error = caught; }
  expect(error instanceof EnrollmentIntakeApiError, `Forbidden authority payload must be rejected: ${JSON.stringify(forbidden)}`);
  expect((error as EnrollmentIntakeApiError)?.code === 'CLIENT_AUTHORITY_FORBIDDEN', 'Forbidden authority payload must use explicit error code.');
}

const student = parseEnrollmentStudentInput({
  name: '  João Manuel  ',
  birthDate: '2014-03-12',
  phone: '+244 923 000 111',
  studentNumber: ' ALU-001 ',
});
expect(student.name === 'João Manuel', 'Student name must be trimmed.');
expect(student.birthDate === '2014-03-12', 'Valid birth date must be preserved.');
expect(student.studentNumber === 'ALU-001', 'Institutional identifier presentation whitespace must be trimmed.');

let invalidBirthDate: unknown;
try { parseEnrollmentStudentInput({ name: 'João Manuel', birthDate: '12/03/2014' }); } catch (error) { invalidBirthDate = error; }
expect(invalidBirthDate instanceof EnrollmentIntakeApiError, 'Non-ISO birth date must be rejected.');

const caseKeyA = buildEnrollmentIdentityCaseKey(context.institutionId, '66666666-6666-4666-8666-666666666666', student);
const caseKeyB = buildEnrollmentIdentityCaseKey(context.institutionId, '66666666-6666-4666-8666-666666666666', {
  ...student,
  name: 'JOAO   MANUEL',
  phone: '244923000111',
  studentNumber: 'alu-001',
});
expect(caseKeyA === caseKeyB, 'Equivalent normalized identity input must produce the same server case key.');
expect(caseKeyA.startsWith('enrollment:'), 'Case key must be server-namespaced.');

class ResolutionPool implements EnrollmentApiPool {
  constructor(private readonly rows: any[]) {}
  async query<T = any>(_text: string, _values?: readonly unknown[]) {
    return { rows: this.rows as T[], rowCount: this.rows.length };
  }
  async connect(): Promise<any> { throw new Error('connect must not be used by read-only resolution test'); }
}

const restrictedPool = new ResolutionPool([{
  person_id: '77777777-7777-4777-8777-777777777777',
  name: 'João Manuel',
  birth_date: '2014-03-12',
  phone: '+244923000111',
  student_number: null,
  legacy_student_id: null,
  is_local: false,
}]);
const restricted = await resolveStudentForEnrollment(restrictedPool, context, {
  name: 'João Manuel',
  birthDate: '2014-03-12',
});
expect(restricted.status === 'RESTRICTED_POSSIBLE_MATCH', 'Cross-institution candidate must remain restricted.');
expect(restricted.candidatePersonId === undefined, 'Restricted resolution must never expose Person UUID.');
expect(restricted.matchReasons.length === 0, 'Restricted resolution must not expose matching reasons.');
expect(restricted.candidateCount === 1, 'Restricted response must expose only opaque possible-match cardinality.');
expect(!('localCandidates' in restricted), 'Restricted response must not expose candidate details.');

if (failures.length) throw new Error(failures.join('\n'));
console.log(`Enrollment intake API contract tests passed (${assertions} assertions).`);
