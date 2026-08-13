import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createTestDatabasePool, reportSkippedDatabaseTest } from '../src/db/test-database.ts';
import {
  canEditAcademicYearDefinition,
  canTransitionAcademicYear,
} from '../src/modules/enrollments/academic-year-policy.ts';

const TEST_NAME = 'ACADEMIC-YEAR-POSTGRES-LIFECYCLE';
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
    `INSERT INTO institutions (id, name, slug, status)
     VALUES ($1, $2, $3, 'active'), ($4, $5, $6, 'active')`,
    [institutionA, `AY Gate A ${suffix}`, `ay-gate-a-${suffix}`, institutionB, `AY Gate B ${suffix}`, `ay-gate-b-${suffix}`],
  );

  const first = await client.query<{ id: string; status: string; name: string }>(
    `INSERT INTO academic_years (institution_id, name, starts_on, ends_on, status)
     VALUES ($1, $2, '2026-09-01', '2027-07-31', 'draft')
     RETURNING id, status, name`,
    [institutionA, `2026/2027 ${suffix}`],
  );
  assert(first.rows[0].status === 'draft', 'A new academic year must persist as draft.');

  assert(canEditAcademicYearDefinition('draft'), 'Draft must be editable by policy.');
  const edited = await client.query<{ name: string; status: string }>(
    `UPDATE academic_years
        SET name = $1, starts_on = '2026-09-02', ends_on = '2027-07-30', updated_at = now()
      WHERE id = $2 AND institution_id = $3 AND status = 'draft'
      RETURNING name, status`,
    [`2026/2027 Planeado ${suffix}`, first.rows[0].id, institutionA],
  );
  assert(edited.rowCount === 1 && edited.rows[0].status === 'draft', 'Draft definition must be editable inside its institution.');

  const crossInstitutionEdit = await client.query(
    `UPDATE academic_years SET name = 'SHOULD-NOT-CHANGE'
      WHERE id = $1 AND institution_id = $2 RETURNING id`,
    [first.rows[0].id, institutionB],
  );
  assert(crossInstitutionEdit.rowCount === 0, 'A different institution must not update the academic year.');

  assert(canTransitionAcademicYear('institution_admin', 'draft', 'active'), 'Policy must allow explicit draft activation.');
  const activated = await client.query<{ status: string }>(
    `UPDATE academic_years SET status = 'active', updated_at = now()
      WHERE id = $1 AND institution_id = $2 AND status = 'draft'
      RETURNING status`,
    [first.rows[0].id, institutionA],
  );
  assert(activated.rows[0].status === 'active', 'Draft must persist as active after explicit activation.');

  const second = await client.query<{ id: string }>(
    `INSERT INTO academic_years (institution_id, name, starts_on, ends_on, status)
     VALUES ($1, $2, '2027-09-01', '2028-07-31', 'draft') RETURNING id`,
    [institutionA, `2027/2028 ${suffix}`],
  );

  let secondActiveError: any = null;
  await client.query('SAVEPOINT second_active');
  try {
    await client.query(`UPDATE academic_years SET status = 'active' WHERE id = $1 AND institution_id = $2`, [second.rows[0].id, institutionA]);
  } catch (error) {
    secondActiveError = error;
    await client.query('ROLLBACK TO SAVEPOINT second_active');
  }
  assert(secondActiveError?.code === '23505', 'PostgreSQL must reject a second active academic year for the same institution.');

  const otherInstitutionActive = await client.query<{ status: string }>(
    `INSERT INTO academic_years (institution_id, name, starts_on, ends_on, status)
     VALUES ($1, $2, '2026-09-01', '2027-07-31', 'active') RETURNING status`,
    [institutionB, `2026/2027 ${suffix}`],
  );
  assert(otherInstitutionActive.rows[0].status === 'active', 'A different institution may have its own active academic year.');

  assert(!canEditAcademicYearDefinition('active'), 'Active definition must be immutable by policy.');
  assert(canTransitionAcademicYear('director', 'active', 'closed'), 'Policy must allow explicit closure.');
  const closed = await client.query<{ status: string }>(
    `UPDATE academic_years SET status = 'closed', updated_at = now()
      WHERE id = $1 AND institution_id = $2 AND status = 'active'
      RETURNING status`,
    [first.rows[0].id, institutionA],
  );
  assert(closed.rows[0].status === 'closed', 'Active academic year must persist as closed.');

  const historical = await client.query<{ status: string; name: string }>(
    `SELECT status, name FROM academic_years WHERE id = $1 AND institution_id = $2`,
    [first.rows[0].id, institutionA],
  );
  assert(historical.rowCount === 1 && historical.rows[0].status === 'closed', 'Closing must preserve the historical academic-year row.');
  assert(!canTransitionAcademicYear('institution_admin', 'closed', 'active'), 'Closed academic year must not reopen by policy.');
  assert(!canTransitionAcademicYear('institution_admin', 'draft', 'closed'), 'Draft academic year must not skip activation.');

  const scopedListA = await client.query<{ institution_id: string }>(
    `SELECT institution_id FROM academic_years WHERE institution_id = $1`,
    [institutionA],
  );
  assert(scopedListA.rows.every((row) => row.institution_id === institutionA), 'Institution-scoped listing must not leak another institution.');

  await client.query('ROLLBACK');
  console.log(`[${TEST_NAME}] passed (${assertions} assertions).`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
