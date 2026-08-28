import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import { activateEnrollment, EnrollmentActivationError, type EnrollmentActivationPool } from '../src/modules/enrollments/enrollment-activation-api.ts';

const { Pool } = pg;
const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error('TEST_DATABASE_URL is required for enrollment activation PostgreSQL test.');
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const schemaName = `nexus_activation_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const schemaIdentifier = `"${schemaName}"`;
const bootstrap = new Pool({ connectionString });
const pool = new Pool({ connectionString, options: `-c search_path=${schemaName},public`, max: 6 }) as pg.Pool & EnrollmentActivationPool;
let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(message); }

const ids = {
  institution: randomUUID(), actor: randomUUID(), student: randomUUID(), guardian: randomUUID(), year: randomUUID(), offer: randomUUID(),
  policy: randomUUID(), requirement: randomUUID(), enrollment: randomUUID(),
};
const context: InstitutionalContext = {
  personId: ids.actor, personName: 'Direção UAT', identityEmail: null, membershipId: randomUUID(),
  institutionId: ids.institution, institutionName: 'Escola Activation', institutionSlug: 'activation', role: 'director',
};

try {
  await bootstrap.query(`CREATE SCHEMA ${schemaIdentifier}`);
  const migrations = (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const filename of migrations) await pool.query(await readFile(path.join(migrationsDirectory, filename), 'utf8'));

  await pool.query("INSERT INTO institutions (id,name,slug,status) VALUES ($1,'Escola Activation','activation','active')", [ids.institution]);
  await pool.query(
    `INSERT INTO people (id,name,birth_date,phone,gender,nationality,province,municipality,address_line)
     VALUES ($1,'Direção UAT','1980-01-01','900000001','other','Angolana','Luanda','Luanda','Rua A'),
            ($2,'Aluno Activation','2012-02-03','900000002','other','Angolana','Luanda','Luanda','Rua B'),
            ($3,'Responsável Activation','1970-03-04','900000003','other','Angolana','Luanda','Luanda','Rua C')`,
    [ids.actor, ids.student, ids.guardian],
  );
  await pool.query("INSERT INTO memberships (id,person_id,institution_id,role,status,approved_at) VALUES ($1,$2,$3,'director','active',now())", [context.membershipId, ids.actor, ids.institution]);
  await pool.query("INSERT INTO academic_years (id,institution_id,name,starts_on,ends_on,status) VALUES ($1,$2,'2026/2027','2026-01-01','2026-12-31','active')", [ids.year, ids.institution]);
  await pool.query("INSERT INTO enrollment_offers (id,institution_id,academic_year_id,name,code,status) VALUES ($1,$2,$3,'Regular','ACT-01','active')", [ids.offer, ids.institution, ids.year]);
  await pool.query("INSERT INTO enrollment_document_policies (id,institution_id,offer_id,version,status,created_by,activated_at) VALUES ($1,$2,$3,1,'active',$4,now())", [ids.policy, ids.institution, ids.offer, ids.actor]);
  await pool.query("INSERT INTO enrollment_document_requirements (id,institution_id,policy_id,document_type,required,sort_order) VALUES ($1,$2,$3,'Identificação',true,1)", [ids.requirement, ids.institution, ids.policy]);
  await pool.query("INSERT INTO student_profiles (institution_id,person_id,status) VALUES ($1,$2,'inactive')", [ids.institution, ids.student]);
  await pool.query(
    `INSERT INTO guardian_relationships (institution_id,guardian_person_id,student_person_id,relationship,status,is_primary)
     VALUES ($1,$2,$3,'Mãe','active',true)`, [ids.institution, ids.guardian, ids.student],
  );
  await pool.query(
    `INSERT INTO enrollment_applications (id,institution_id,student_person_id,guardian_person_id,academic_year_id,offer_id,status,document_policy_id,created_by,updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,'validated',$7,$8,$8)`, [ids.enrollment, ids.institution, ids.student, ids.guardian, ids.year, ids.offer, ids.policy, ids.actor],
  );
  await pool.query(
    `INSERT INTO enrollment_documents (institution_id,enrollment_application_id,document_type,required,status,source_requirement_id,verified_by,verified_at)
     VALUES ($1,$2,'Identificação',true,'verified',$3,$4,now())`, [ids.institution, ids.enrollment, ids.requirement, ids.actor],
  );

  const activated = await activateEnrollment(pool, context, ids.enrollment, {
    expectedLifecycleVersion: '1', expectedRegistrationVersion: '1', idempotencyKey: 'activation-happy-path-001', correlationId: 'activation-test-001',
  });
  assert(activated.status === 'active' && activated.lifecycleVersion === '2' && !activated.replayed, 'Validated Enrollment must activate exactly once.');
  const readback = await pool.query<{ enrollment_status: string; profile_status: string; lifecycle_version: string }>(
    `SELECT e.status AS enrollment_status, e.lifecycle_version, sp.status AS profile_status
       FROM enrollment_applications e JOIN student_profiles sp ON sp.institution_id=e.institution_id AND sp.person_id=e.student_person_id
      WHERE e.id=$1`, [ids.enrollment],
  );
  assert(readback.rows[0].enrollment_status === 'active' && readback.rows[0].profile_status === 'active' && readback.rows[0].lifecycle_version === '2', 'Enrollment and StudentProfile must become active atomically.');
  const event = await pool.query<{ actor_kind: string; actor_person_id: string; correlation_id: string; event_type: string }>("SELECT actor_kind,actor_person_id,correlation_id,event_type FROM enrollment_events WHERE enrollment_application_id=$1 AND event_type='enrollment_activated'", [ids.enrollment]);
  assert(event.rowCount === 1 && event.rows[0].actor_kind === 'human' && event.rows[0].actor_person_id === ids.actor && event.rows[0].correlation_id === 'activation-test-001', 'Activation must persist factual human audit evidence.');
  const ledger = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM enrollment_activation_commands WHERE institution_id=$1 AND enrollment_application_id=$2', [ids.institution, ids.enrollment]);
  assert(ledger.rows[0].count === '1', 'Activation must persist exactly one institution-scoped idempotency ledger record.');

  const replay = await activateEnrollment(pool, context, ids.enrollment, {
    expectedLifecycleVersion: '1', expectedRegistrationVersion: '1', idempotencyKey: 'activation-happy-path-001', correlationId: 'activation-test-001',
  });
  assert(replay.replayed === true && replay.status === 'active', 'Same activation command must replay safely.');
  const eventCount = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM enrollment_events WHERE enrollment_application_id=$1 AND event_type='enrollment_activated'", [ids.enrollment]);
  assert(eventCount.rows[0].count === '1', 'Replay must not duplicate activation audit event.');

  let keyConflict = false;
  try { await activateEnrollment(pool, context, ids.enrollment, { expectedLifecycleVersion: '2', expectedRegistrationVersion: '1', idempotencyKey: 'activation-happy-path-001' }); }
  catch (error) { keyConflict = error instanceof EnrollmentActivationError && error.code === 'IDEMPOTENCY_CONFLICT'; }
  assert(keyConflict, 'Same idempotency key with a different request fingerprint must fail closed.');

  console.log(`[ENROLLMENT-ACTIVATION-POSTGRES] passed (${assertions} assertions).`);
} finally {
  await pool.end();
  await bootstrap.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`);
  await bootstrap.end();
}
