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

async function seedValidatedEnrollment(label: string) {
  const student = randomUUID(); const guardian = randomUUID(); const enrollment = randomUUID();
  await pool.query(
    `INSERT INTO people (id,name,birth_date,phone,gender,nationality,province,municipality,address_line)
     VALUES ($1,$2,'2011-02-03','900000004','other','Angolana','Luanda','Luanda','Rua D'),
            ($3,$4,'1971-03-04','900000005','other','Angolana','Luanda','Luanda','Rua E')`,
    [student, `Aluno ${label}`, guardian, `Responsável ${label}`],
  );
  await pool.query("INSERT INTO student_profiles (institution_id,person_id,status) VALUES ($1,$2,'inactive')", [ids.institution, student]);
  await pool.query("INSERT INTO guardian_relationships (institution_id,guardian_person_id,student_person_id,relationship,status,is_primary) VALUES ($1,$2,$3,'Mãe','active',true)", [ids.institution, guardian, student]);
  await pool.query(
    `INSERT INTO enrollment_applications (id,institution_id,student_person_id,guardian_person_id,academic_year_id,offer_id,status,document_policy_id,created_by,updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,'validated',$7,$8,$8)`, [enrollment, ids.institution, student, guardian, ids.year, ids.offer, ids.policy, ids.actor],
  );
  await pool.query(
    `INSERT INTO enrollment_documents (institution_id,enrollment_application_id,document_type,required,status,source_requirement_id,verified_by,verified_at)
     VALUES ($1,$2,'Identificação',true,'verified',$3,$4,now())`, [ids.institution, enrollment, ids.requirement, ids.actor],
  );
  return { student, enrollment };
}

try {
  await bootstrap.query(`CREATE SCHEMA ${schemaIdentifier}`);
  const migrations = (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  const migrationPool = new Pool({ connectionString, options: `-c search_path=${schemaName}` });
  try {
    for (const filename of migrations) await migrationPool.query(await readFile(path.join(migrationsDirectory, filename), 'utf8'));
  } finally {
    await migrationPool.end();
  }

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
  assert(typeof (activated as any).studentRef === 'string' && /^stu_[A-Za-z0-9_-]{22}$/.test((activated as any).studentRef), 'Activation must return the StudentProfile opaque public ref.');
  const activatedRef = await pool.query<{ public_ref: string }>('SELECT public_ref FROM student_profiles WHERE institution_id=$1 AND person_id=$2', [ids.institution, ids.student]);
  assert(activated.studentRef === activatedRef.rows[0].public_ref, 'The returned reference must be the activated StudentProfile public ref from the same institution.');
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
  assert(replay.studentRef === activated.studentRef, 'A replay must preserve exactly the originally persisted opaque StudentProfile reference.');
  const eventCount = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM enrollment_events WHERE enrollment_application_id=$1 AND event_type='enrollment_activated'", [ids.enrollment]);
  assert(eventCount.rows[0].count === '1', 'Replay must not duplicate activation audit event.');

  await pool.query(
    `UPDATE enrollment_activation_commands SET result=$4::jsonb WHERE institution_id=$1 AND enrollment_application_id=$2 AND idempotency_key=$3`,
    [ids.institution, ids.enrollment, 'activation-happy-path-001', JSON.stringify({ enrollmentId: ids.enrollment, lifecycleVersion: '2', status: 'active' })],
  );
  const legacyReplay = await activateEnrollment(pool, context, ids.enrollment, {
    expectedLifecycleVersion: '1', expectedRegistrationVersion: '1', idempotencyKey: 'activation-happy-path-001', correlationId: 'activation-test-001',
  });
  assert(legacyReplay.replayed === true && legacyReplay.studentRef === activated.studentRef && !('enrollmentId' in legacyReplay), 'Legacy idempotency payloads must be normalized through the locked canonical profile without leaking enrollment ids.');
  const legacyReplayState = await pool.query<{ events: string; ledger: string; profiles: string }>(
    `SELECT (SELECT count(*)::text FROM enrollment_events WHERE enrollment_application_id=$1 AND event_type='enrollment_activated') AS events,
            (SELECT count(*)::text FROM enrollment_activation_commands WHERE enrollment_application_id=$1) AS ledger,
            (SELECT count(*)::text FROM student_profiles WHERE institution_id=$2 AND person_id=$3) AS profiles`,
    [ids.enrollment, ids.institution, ids.student],
  );
  assert(legacyReplayState.rows[0].events === '1' && legacyReplayState.rows[0].ledger === '1' && legacyReplayState.rows[0].profiles === '1', 'Legacy replay must not create another event, ledger row, profile, or reference.');

  let staleRejected = false;
  try { await activateEnrollment(pool, context, ids.enrollment, { expectedLifecycleVersion: '1', expectedRegistrationVersion: '1', idempotencyKey: 'activation-stale-v1-001' }); }
  catch (error) { staleRejected = error instanceof EnrollmentActivationError && error.code === 'STALE_VERSION'; }
  assert(staleRejected, 'A second operator holding lifecycle v1 must receive STALE_VERSION after activation A.');

  await pool.query('UPDATE enrollment_applications SET registration_version = 2 WHERE id = $1', [ids.enrollment]);
  let staleRegistrationRejected = false;
  try { await activateEnrollment(pool, context, ids.enrollment, { expectedLifecycleVersion: '2', expectedRegistrationVersion: '1', idempotencyKey: 'activation-stale-registration-001' }); }
  catch (error) { staleRegistrationRejected = error instanceof EnrollmentActivationError && error.code === 'STALE_VERSION'; }
  assert(staleRegistrationRejected, 'Current lifecycle with stale registration version must reject activation without side effect.');
  const staleLedger = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM enrollment_activation_commands WHERE enrollment_application_id=$1', [ids.enrollment]);
  assert(staleLedger.rows[0].count === '1', 'Stale registration must not create an activation ledger entry.');

  let keyConflict = false;
  try { await activateEnrollment(pool, context, ids.enrollment, { expectedLifecycleVersion: '2', expectedRegistrationVersion: '1', idempotencyKey: 'activation-happy-path-001' }); }
  catch (error) { keyConflict = error instanceof EnrollmentActivationError && error.code === 'IDEMPOTENCY_CONFLICT'; }
  assert(keyConflict, 'Same idempotency key with a different request fingerprint must fail closed.');

  const rollback = await seedValidatedEnrollment('Rollback');
  await pool.query(`CREATE FUNCTION activation_event_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type = 'enrollment_activated' THEN RAISE EXCEPTION 'injected activation event failure'; END IF; RETURN NEW; END $$`);
  await pool.query('CREATE TRIGGER activation_event_failure_trigger BEFORE INSERT ON enrollment_events FOR EACH ROW EXECUTE FUNCTION activation_event_failure()');
  let rollbackRejected = false;
  try { await activateEnrollment(pool, context, rollback.enrollment, { expectedLifecycleVersion: '1', expectedRegistrationVersion: '1', idempotencyKey: 'activation-rollback-001' }); }
  catch { rollbackRejected = true; }
  assert(rollbackRejected, 'Injected post-profile failure must reject activation.');
  await pool.query('DROP TRIGGER activation_event_failure_trigger ON enrollment_events');
  const rollbackState = await pool.query<{ enrollment_status: string; profile_status: string; events: string; ledger: string }>(
    `SELECT e.status AS enrollment_status, sp.status AS profile_status,
            (SELECT count(*)::text FROM enrollment_events ev WHERE ev.enrollment_application_id=e.id AND ev.event_type='enrollment_activated') AS events,
            (SELECT count(*)::text FROM enrollment_activation_commands ac WHERE ac.enrollment_application_id=e.id) AS ledger
       FROM enrollment_applications e JOIN student_profiles sp ON sp.institution_id=e.institution_id AND sp.person_id=e.student_person_id WHERE e.id=$1`, [rollback.enrollment],
  );
  assert(rollbackState.rows[0].enrollment_status === 'validated' && rollbackState.rows[0].profile_status === 'inactive' && rollbackState.rows[0].events === '0' && rollbackState.rows[0].ledger === '0', 'Activation failure must rollback Enrollment, StudentProfile, event and ledger completely.');

  const concurrent = await seedValidatedEnrollment('Concurrent');
  const results = await Promise.allSettled([
    activateEnrollment(pool, context, concurrent.enrollment, { expectedLifecycleVersion: '1', expectedRegistrationVersion: '1', idempotencyKey: 'activation-concurrent-a-001' }),
    activateEnrollment(pool, context, concurrent.enrollment, { expectedLifecycleVersion: '1', expectedRegistrationVersion: '1', idempotencyKey: 'activation-concurrent-b-001' }),
  ]);
  assert(results.filter((result) => result.status === 'fulfilled').length === 1, 'Exactly one concurrent activation must win.');
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  assert(rejected?.reason instanceof EnrollmentActivationError && rejected.reason.code === 'STALE_VERSION', 'Concurrent losing activation must receive STALE_VERSION.');
  const concurrentState = await pool.query<{ enrollment_status: string; profile_status: string; events: string; ledger: string }>(
    `SELECT e.status AS enrollment_status, sp.status AS profile_status,
            (SELECT count(*)::text FROM enrollment_events ev WHERE ev.enrollment_application_id=e.id AND ev.event_type='enrollment_activated') AS events,
            (SELECT count(*)::text FROM enrollment_activation_commands ac WHERE ac.enrollment_application_id=e.id) AS ledger
       FROM enrollment_applications e JOIN student_profiles sp ON sp.institution_id=e.institution_id AND sp.person_id=e.student_person_id WHERE e.id=$1`, [concurrent.enrollment],
  );
  assert(concurrentState.rows[0].enrollment_status === 'active' && concurrentState.rows[0].profile_status === 'active' && concurrentState.rows[0].events === '1' && concurrentState.rows[0].ledger === '1', 'Concurrent activation must leave exactly one authoritative active state and side effect.');
  const concurrentProfile = await pool.query<{ count: string; public_ref: string }>(
    `SELECT count(*) OVER ()::text AS count, public_ref FROM student_profiles WHERE institution_id=$1 AND person_id=$2`,
    [ids.institution, concurrent.student],
  );
  assert(concurrentProfile.rows[0].count === '1' && /^stu_[A-Za-z0-9_-]{22}$/.test(concurrentProfile.rows[0].public_ref), 'Concurrent activation must retain one pre-existing StudentProfile with one stable opaque reference.');

  console.log(`[ENROLLMENT-ACTIVATION-POSTGRES] passed (${assertions} assertions).`);
} finally {
  await pool.end();
  await bootstrap.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`);
  await bootstrap.end();
}
