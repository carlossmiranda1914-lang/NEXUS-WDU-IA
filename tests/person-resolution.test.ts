import {
  normalizeIdentifier,
  normalizePersonName,
  normalizePhone,
  resolvePersonCandidates,
  type PersonResolutionCandidate,
} from '../src/modules/people/person-resolution.ts';

const failures: string[] = [];
let assertions = 0;

function expect(condition: unknown, message: string) {
  assertions += 1;
  if (!condition) failures.push(message);
}

function candidate(overrides: Partial<PersonResolutionCandidate> = {}): PersonResolutionCandidate {
  return {
    personId: 'person-1',
    name: 'João Manuel António',
    birthDate: '2014-03-12',
    phone: '+244 923 000 111',
    studentNumber: 'ALU-001',
    legacyStudentId: null,
    nationalIdNumber: 'BI-001',
    relationship: 'local',
    disclosure: 'allowed',
    ...overrides,
  };
}

expect(normalizePersonName('  João   Manuel ANTÓNIO ') === 'joao manuel antonio', 'Name normalization must remove accents, case and repeated spaces.');
expect(normalizePhone('+244 923 000 111') === '244923000111', 'Phone normalization must keep digits only.');
expect(normalizeIdentifier(' alu-001 ') === 'ALU-001', 'Identifier normalization must ignore surrounding spaces and case while preserving punctuation.');
expect(normalizeIdentifier('ALU001') !== normalizeIdentifier('ALU-001'), 'Identifier normalization must not collapse punctuation that can distinguish institutional identifiers.');
expect(normalizeIdentifier(' bi-001 ') === 'BI-001', 'National identifier normalization must reuse canonical identifier normalization.');

const noMatch = resolvePersonCandidates(
  { name: 'Pessoa Nova', birthDate: '2015-01-01' },
  [candidate()],
);
expect(noMatch.status === 'NO_MATCH', 'Unrelated data must return NO_MATCH.');
expect(noMatch.candidateCount === 0, 'NO_MATCH must not expose candidate count from unrelated rows.');

const localStrong = resolvePersonCandidates(
  { name: 'João Manuel António', birthDate: '2014-03-12', studentNumber: 'alu-001' },
  [candidate()],
);
expect(localStrong.status === 'LOCAL_MATCH', 'Strong institutional identifier must resolve a local Person.');
expect(localStrong.candidatePersonId === 'person-1', 'LOCAL_MATCH may return the authorized local Person id.');
expect(localStrong.matchReasons.includes('student_number'), 'LOCAL_MATCH must explain the strong matching reason.');

const nationalIdLocal = resolvePersonCandidates(
  { name: 'João Manuel António', nationalIdNumber: ' bi-001 ' },
  [candidate()],
);
expect(nationalIdLocal.status === 'LOCAL_MATCH', 'A unique local national identifier must resolve deterministically.');
expect(nationalIdLocal.matchReasons.includes('national_id_number'), 'National identifier matches must remain auditable inside the resolver.');

const nationalIdAbsent = resolvePersonCandidates(
  { name: 'Pessoa Nova', nationalIdNumber: 'BI-999' },
  [candidate()],
);
expect(nationalIdAbsent.status === 'NO_MATCH', 'An absent national identifier must not create a false match.');

const nationalIdAmbiguous = resolvePersonCandidates(
  { name: 'João Manuel António', nationalIdNumber: 'BI-001' },
  [candidate(), candidate({ personId: 'person-2' })],
);
expect(nationalIdAmbiguous.status === 'MULTIPLE_MATCHES', 'Multiple national identifier candidates must fail closed as ambiguous.');

const reusable = resolvePersonCandidates(
  { name: 'João Manuel António', birthDate: '2014-03-12', studentNumber: 'ALU-001' },
  [candidate({ relationship: 'external', disclosure: 'allowed' })],
);
expect(reusable.status === 'REUSABLE_MATCH', 'Strong external allowed match must be classified as REUSABLE_MATCH.');
expect(reusable.candidatePersonId === 'person-1', 'REUSABLE_MATCH may expose the Person id only when disclosure is allowed.');

const restricted = resolvePersonCandidates(
  { name: 'João Manuel António', birthDate: '2014-03-12', studentNumber: 'ALU-001' },
  [candidate({ relationship: 'external', disclosure: 'restricted' })],
);
expect(restricted.status === 'RESTRICTED_POSSIBLE_MATCH', 'Restricted candidate must not be returned as reusable directly.');
expect(restricted.candidatePersonId === undefined, 'Restricted result must not expose Person id.');
expect(restricted.matchReasons.length === 0, 'Restricted result must not expose matching reasons.');

const composite = resolvePersonCandidates(
  { name: 'JOAO MANUEL ANTONIO', birthDate: '2014-03-12' },
  [candidate({ studentNumber: null })],
);
expect(composite.status === 'REVIEW_REQUIRED', 'Name + birth date alone must require human review, not automatic reuse.');

const contradiction = resolvePersonCandidates(
  { name: 'Outra Pessoa', birthDate: '2010-01-01', studentNumber: 'ALU-001' },
  [candidate()],
);
expect(contradiction.status === 'REVIEW_REQUIRED', 'Strong identifier with contradictory core data must require review.');

const multiple = resolvePersonCandidates(
  { name: 'João Manuel António', birthDate: '2014-03-12' },
  [candidate(), candidate({ personId: 'person-2', studentNumber: null })],
);
expect(multiple.status === 'MULTIPLE_MATCHES', 'Multiple plausible candidates must never be auto-selected.');
expect(multiple.candidatePersonId === undefined, 'MULTIPLE_MATCHES must not select a Person id.');

const nameOnly = resolvePersonCandidates(
  { name: 'João Manuel António' },
  [candidate({ studentNumber: null })],
);
expect(nameOnly.status === 'NO_MATCH', 'Name alone must not be sufficient for a match.');

const invalidInput = resolvePersonCandidates({ name: '   ' }, []);
expect(invalidInput.status === 'REVIEW_REQUIRED', 'Blank name must not be treated as a new person automatically.');

if (failures.length) {
  throw new Error(failures.join('\n'));
}

console.log(`Person resolution tests passed (${assertions} assertions).`);
