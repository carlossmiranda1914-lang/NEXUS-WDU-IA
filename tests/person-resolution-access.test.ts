import {
  PERSON_RESOLUTION_CANDIDATE_LIMIT,
  hasResolutionSupportingSignal,
  loadPersonResolutionCandidates,
  resolvePersonForInstitution,
  type ReadOnlyQueryClient,
} from '../src/modules/people/person-resolution-access.ts';

const failures: string[] = [];
let assertions = 0;

function expect(condition: unknown, message: string) {
  assertions += 1;
  if (!condition) failures.push(message);
}

type Row = {
  person_id: string;
  name: string;
  birth_date: string | null;
  phone: string | null;
  student_number: string | null;
  legacy_student_id: string | null;
  national_id_number: string | null;
  is_local: boolean;
};

function fakeClient(rows: Row[]) {
  const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
  const client: ReadOnlyQueryClient = {
    async query<T = any>(text: string, values?: readonly unknown[]) {
      calls.push({ text, values });
      return { rows: rows as T[] };
    },
  };
  return { client, calls };
}

const baseInput = {
  name: 'João Manuel António',
  birthDate: '2014-03-12',
  studentNumber: 'ALU-001',
};

expect(hasResolutionSupportingSignal({ name: 'Só Nome' }) === false, 'Name alone must not be a supporting signal.');
expect(hasResolutionSupportingSignal({ name: 'Nome', birthDate: '2014-03-12' }) === true, 'Birth date must count as a supporting signal.');

const nameOnlyDb = fakeClient([]);
const nameOnly = await resolvePersonForInstitution(nameOnlyDb.client, 'school-a', { name: 'Só Nome' });
expect(nameOnly.status === 'REVIEW_REQUIRED', 'Name-only resolution must stop before candidate discovery.');
expect(nameOnlyDb.calls.length === 0, 'Name-only resolution must not query global people.');

const localDb = fakeClient([
  {
    person_id: 'person-a',
    name: 'João Manuel António',
    birth_date: '2014-03-12',
    phone: '+244 923 000 111',
    student_number: 'ALU-001',
    legacy_student_id: null,
    national_id_number: 'BI-001',
    is_local: true,
  },
]);
const local = await resolvePersonForInstitution(localDb.client, 'school-a', baseInput);
expect(local.status === 'LOCAL_MATCH', 'A strong local institutional identifier must resolve locally.');
expect(local.candidatePersonId === 'person-a', 'Authorized local match may expose the local Person id.');
expect(local.matchReasons.includes('student_number'), 'Local result must explain its local strong reason.');
expect(localDb.calls.length === 1, 'Local resolution must perform one bounded read query.');
expect(localDb.calls[0].values?.[3] === 'school-a', 'Institution scope must come from the trusted function argument.');
expect(localDb.calls[0].values?.[7] === PERSON_RESOLUTION_CANDIDATE_LIMIT, 'Candidate query must carry the hard result limit.');
expect(!/\b(insert|update|delete|alter|drop|truncate)\b/i.test(localDb.calls[0].text), 'Candidate provider must remain read-only.');

const externalDb = fakeClient([
  {
    person_id: 'person-b',
    name: 'João Manuel António',
    birth_date: '2014-03-12',
    phone: '+244 923 000 111',
    student_number: null,
    legacy_student_id: null,
    national_id_number: 'BI-001',
    is_local: false,
  },
]);
const external = await resolvePersonForInstitution(
  externalDb.client,
  'school-a',
  { name: 'João Manuel António', birthDate: '2014-03-12' },
);
expect(external.status === 'RESTRICTED_POSSIBLE_MATCH', 'External candidate must be opaque to the requesting school.');
expect(external.candidatePersonId === undefined, 'Restricted match must not expose a global Person id.');
expect(external.matchReasons.length === 0, 'Restricted match must not expose reasons.');
expect(external.candidateCount === 1, 'Restricted response must use an opaque count instead of revealing external cardinality.');

const nationalExternal = await resolvePersonForInstitution(
  externalDb.client,
  'school-a',
  { name: 'João Manuel António', nationalIdNumber: ' bi-001 ' },
);
expect(nationalExternal.status === 'RESTRICTED_POSSIBLE_MATCH', 'A national identifier from another institution must remain opaque.');
expect(nationalExternal.candidatePersonId === undefined && nationalExternal.matchReasons.length === 0, 'External national identifier resolution must not expose Person identity or reason.');

const multipleExternalDb = fakeClient([
  {
    person_id: 'person-b',
    name: 'João Manuel António',
    birth_date: '2014-03-12',
    phone: null,
    student_number: null,
    legacy_student_id: null,
    national_id_number: null,
    is_local: false,
  },
  {
    person_id: 'person-c',
    name: 'João Manuel António',
    birth_date: '2014-03-12',
    phone: null,
    student_number: null,
    legacy_student_id: null,
    national_id_number: null,
    is_local: false,
  },
]);
const multipleExternal = await resolvePersonForInstitution(
  multipleExternalDb.client,
  'school-a',
  { name: 'João Manuel António', birthDate: '2014-03-12' },
);
expect(multipleExternal.status === 'RESTRICTED_POSSIBLE_MATCH', 'Multiple external candidates must still collapse to one opaque restricted signal.');
expect(multipleExternal.candidateCount === 1, 'External candidate count must not be enumerable.');
expect(multipleExternal.matchReasons.length === 0, 'Multiple external matches must not leak matching reasons.');

const loaded = await loadPersonResolutionCandidates(
  externalDb.client,
  'school-a',
  { name: 'João Manuel António', phone: '+244 923 000 111' },
);
expect(loaded[0].relationship === 'external', 'Candidate outside the institution must be classified external.');
expect(loaded[0].disclosure === 'restricted', 'External candidate disclosure must default to restricted.');
expect(loaded[0].studentNumber === null, 'External institutional identifiers must never cross the institution boundary.');

if (failures.length) {
  throw new Error(failures.join('\n'));
}

console.log(`Person resolution access tests passed (${assertions} assertions).`);
