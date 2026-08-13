import { resolveEnrollmentTemporalContext } from '../src/modules/enrollments/enrollment-temporal-context.ts';

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition {
  assertions += 1;
  if (!condition) throw new Error(message);
}

const calls: Array<{ sql: string; values?: unknown[] }> = [];
const noYearDb = {
  async query<Row = any>(sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    return { rows: [] as Row[] };
  },
};

const noYear = await resolveEnrollmentTemporalContext(noYearDb, 'institution-a');
assert(noYear.academicYear === null, 'No active academic year must be explicit as null.');
assert(noYear.offers.length === 0, 'No active academic year must expose no offers.');
assert(calls.length === 1, 'Offers must not be queried when there is no active academic year.');
assert(calls[0].values?.[0] === 'institution-a', 'Academic-year lookup must be institution scoped.');
assert(calls[0].sql.includes("status = 'active'"), 'Temporal context must resolve only the active academic year.');

let step = 0;
const activeWithoutOffersDb = {
  async query<Row = any>(sql: string, values?: unknown[]) {
    step += 1;
    calls.push({ sql, values });
    if (step === 1) {
      return { rows: [{ id: 'year-a', name: '2026/2027', starts_on: '2026-09-01', ends_on: '2027-07-31', status: 'active' }] as Row[] };
    }
    return { rows: [] as Row[] };
  },
};

const activeWithoutOffers = await resolveEnrollmentTemporalContext(activeWithoutOffersDb, 'institution-a');
assert(activeWithoutOffers.academicYear?.id === 'year-a', 'Active academic year must be returned even with no offers.');
assert(activeWithoutOffers.academicYear?.name === '2026/2027', 'Active academic-year name must come from persisted data.');
assert(activeWithoutOffers.academicYear?.startsOn === '2026-09-01', 'Academic-year dates must use API date-only format.');
assert(activeWithoutOffers.offers.length === 0, 'Active year with no offers must remain distinguishable from no active year.');

step = 0;
const activeWithOffersDb = {
  async query<Row = any>(_sql: string, values?: unknown[]) {
    step += 1;
    if (step === 1) {
      return { rows: [{ id: 'year-a', name: '2026/2027', starts_on: new Date('2026-09-01T00:00:00Z'), ends_on: new Date('2027-07-31T00:00:00Z'), status: 'active' }] as Row[] };
    }
    assert(values?.[0] === 'institution-a', 'Offer lookup must be institution scoped.');
    assert(values?.[1] === 'year-a', 'Offer lookup must be constrained to the resolved active year.');
    return { rows: [{ id: 'offer-a', name: 'Ensino regular', code: 'REG', academic_year_id: 'year-a' }] as Row[] };
  },
};

const activeWithOffers = await resolveEnrollmentTemporalContext(activeWithOffersDb, 'institution-a');
assert(activeWithOffers.offers.length === 1, 'Active offers for the active year must be returned.');
assert(activeWithOffers.offers[0].academicYearId === 'year-a', 'Offer context must retain its academic-year identity.');

console.log(`Enrollment temporal context tests passed (${assertions} assertions).`);
