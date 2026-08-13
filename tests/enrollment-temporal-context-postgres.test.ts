import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createTestDatabasePool, reportSkippedDatabaseTest } from '../src/db/test-database.ts';
import { resolveEnrollmentTemporalContext } from '../src/modules/enrollments/enrollment-temporal-context.ts';

const TEST_NAME = 'ENROLLMENT-TEMPORAL-CONTEXT-POSTGRES';
const pool = createTestDatabasePool();
if (!pool) {
  reportSkippedDatabaseTest(TEST_NAME);
  process.exit(0);
}

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition {
  assertions += 1;
  if (!condition) throw new Error(message);
}

const suffix = randomUUID().slice(0, 8);
const institutionA = randomUUID();
const institutionB = randomUUID();
const client = await pool.connect();

try {
  await client.query('BEGIN');
  await client.query(
    "INSERT INTO institutions (id, name, slug, status) VALUES ($1, $2, $3, 'active'), ($4, $5, $6, 'active')",
    [institutionA, `AY22 A ${suffix}`, `ay22-a-${suffix}`, institutionB, `AY22 B ${suffix}`, `ay22-b-${suffix}`],
  );

  const noActive = await resolveEnrollmentTemporalContext(client, institutionB);
  assert(noActive.academicYear === null, 'Institution with no active academic year must expose null.');
  assert(noActive.offers.length === 0, 'Institution with no active academic year must expose no offers.');

  const year = await client.query<{ id: string }>(
    "INSERT INTO academic_years (institution_id, name, starts_on, ends_on, status) VALUES ($1, $2, '2026-09-01', '2027-07-31', 'active') RETURNING id",
    [institutionA, `2026/2027 ${suffix}`],
  );

  const withoutOffers = await resolveEnrollmentTemporalContext(client, institutionA);
  assert(withoutOffers.academicYear?.id === year.rows[0].id, 'Active academic year must resolve independently of offers.');
  assert(withoutOffers.offers.length === 0, 'Active year without offers must not collapse to no-year state.');

  await client.query(
    "INSERT INTO enrollment_offers (institution_id, academic_year_id, name, code, status) VALUES ($1, $2, 'Regular ativo', $3, 'active'), ($1, $2, 'Regular encerrado', $4, 'closed')",
    [institutionA, year.rows[0].id, `REG-A-${suffix}`, `REG-C-${suffix}`],
  );

  const withOffers = await resolveEnrollmentTemporalContext(client, institutionA);
  assert(withOffers.academicYear?.status === 'active', 'Temporal context must expose only active academic year.');
  assert(withOffers.offers.length === 1, 'Only active offers from the active academic year must be exposed.');
  assert(withOffers.offers[0].name === 'Regular ativo', 'Closed offers must not leak into operational context.');

  const isolated = await resolveEnrollmentTemporalContext(client, institutionB);
  assert(isolated.academicYear === null, 'Another institution must not see the active academic year.');
  assert(isolated.offers.length === 0, 'Another institution must not see enrollment offers.');

  await client.query('ROLLBACK');
  console.log(`[${TEST_NAME}] passed (${assertions} assertions).`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
