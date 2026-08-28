import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import { executeEnrollmentIntake } from '../src/modules/enrollments/enrollment-intake.ts';
import { loadEnrollmentRegistration, saveEnrollmentRegistration } from '../src/modules/enrollments/enrollment-registration-api.ts';
import { transitionEnrollmentDocument } from '../src/modules/enrollments/enrollment-document-api.ts';
import { assignEnrollmentProcess, EnrollmentProcessApiError, loadEnrollmentProcess, reconcileEnrollmentProcess } from '../src/modules/enrollments/enrollment-process-api.ts';

const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error('TEST_DATABASE_URL is required for S03 PostgreSQL process test.');
const { Pool } = pg;
const schema = `nexus_s03_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const schemaId = `"${schema}"`;
const bootstrap = new Pool({ connectionString });
await bootstrap.query(`CREATE SCHEMA ${schemaId}`);
let pool = new Pool({ connectionString, options: `-c search_path=${schema}`, max: 6 });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(message); }

const ids = {
  institutionA: randomUUID(), institutionB: randomUUID(), actorA: randomUUID(), actorB: randomUUID(), assigneeA: randomUUID(), outsiderB: randomUUID(), forbiddenActorA: randomUUID(), forbiddenAssigneeA: randomUUID(), inactiveAssigneeA: randomUUID(),
  membershipA: randomUUID(), membershipB: randomUUID(), assigneeMembershipA: randomUUID(), outsiderMembershipB: randomUUID(), forbiddenActorMembershipA: randomUUID(), forbiddenAssigneeMembershipA: randomUUID(), inactiveAssigneeMembershipA: randomUUID(),
  yearA: randomUUID(), offerA: randomUUID(), policyA: randomUUID(), requirementA: randomUUID(),
};
const contextA: InstitutionalContext = { personId: ids.actorA, personName: 'Secretaria A', identityEmail: null, membershipId: ids.membershipA, institutionId: ids.institutionA, institutionName: 'Escola A', institutionSlug: 'escola-a', role: 'secretariat' };
const contextB: InstitutionalContext = { personId: ids.actorB, personName: 'Secretaria B', identityEmail: null, membershipId: ids.membershipB, institutionId: ids.institutionB, institutionName: 'Escola B', institutionSlug: 'escola-b', role: 'secretariat' };
const forbiddenContextA: InstitutionalContext = { personId: ids.forbiddenActorA, personName: 'Financeiro A', identityEmail: null, membershipId: ids.forbiddenActorMembershipA, institutionId: ids.institutionA, institutionName: 'Escola A', institutionSlug: 'escola-a', role: 'financial' };

try {
  const migrations = (await readdir(migrationsDir)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const filename of migrations) await pool.query(await readFile(path.join(migrationsDir, filename), 'utf8'));
  assert(migrations.length === 21, 'S03 clean schema must contain exactly 21 ordered migrations.');

  await pool.query("INSERT INTO institutions (id,name,slug,status) VALUES ($1,'Escola A','escola-a','active'),($2,'Escola B','escola-b','active')", [ids.institutionA, ids.institutionB]);
  await pool.query("INSERT INTO people (id,name) VALUES ($1,'Secretaria A'),($2,'Secretaria B'),($3,'Responsável A'),($4,'Pessoa B'),($5,'Financeiro A'),($6,'Financeiro Assignee'),($7,'Secretaria Inativa')", [ids.actorA, ids.actorB, ids.assigneeA, ids.outsiderB, ids.forbiddenActorA, ids.forbiddenAssigneeA, ids.inactiveAssigneeA]);
  await pool.query("INSERT INTO memberships (id,person_id,institution_id,role,status) VALUES ($1,$2,$3,'secretariat','active'),($4,$5,$6,'secretariat','active'),($7,$8,$3,'secretariat','active'),($9,$10,$6,'secretariat','active'),($11,$12,$3,'financial','active'),($13,$14,$3,'financial','active'),($15,$16,$3,'secretariat','suspended')", [ids.membershipA, ids.actorA, ids.institutionA, ids.membershipB, ids.actorB, ids.institutionB, ids.assigneeMembershipA, ids.assigneeA, ids.outsiderMembershipB, ids.outsiderB, ids.forbiddenActorMembershipA, ids.forbiddenActorA, ids.forbiddenAssigneeMembershipA, ids.forbiddenAssigneeA, ids.inactiveAssigneeMembershipA, ids.inactiveAssigneeA]);
  await pool.query("INSERT INTO academic_years (id,institution_id,name,starts_on,ends_on,status) VALUES ($1,$2,'2026/2027','2026-09-01','2027-07-31','active')", [ids.yearA, ids.institutionA]);
  await pool.query("INSERT INTO enrollment_offers (id,institution_id,academic_year_id,name,code,status) VALUES ($1,$2,$3,'Ensino Geral','S03-GERAL','active')", [ids.offerA, ids.institutionA, ids.yearA]);
  await pool.query("INSERT INTO enrollment_document_policies (id,institution_id,offer_id,version,status,created_by) VALUES ($1,$2,$3,1,'active',$4)", [ids.policyA, ids.institutionA, ids.offerA, ids.actorA]);
  await pool.query("INSERT INTO enrollment_document_requirements (id,institution_id,policy_id,document_type,required,sort_order) VALUES ($1,$2,$3,'Identificação',true,1)", [ids.requirementA, ids.institutionA, ids.policyA]);

  const intake = await executeEnrollmentIntake(pool as any, {
    institutionId: ids.institutionA, actorPersonId: ids.actorA, offerId: ids.offerA,
    idempotencyKey: `s03-intake-${randomUUID()}`, person: { kind: 'new_person', name: 'Aluno S03', birthDate: '2012-04-03', phone: '923000001' },
  });
  const processBeforeRead = await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM enrollment_processes WHERE enrollment_application_id=$1', [intake.enrollmentApplicationId]);
  assert(processBeforeRead.rows[0].count === 1, 'Intake transaction must create the 1:1 process before any browser read.');

  const concurrent = await Promise.all(Array.from({ length: 4 }, () => loadEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId)));
  assert(concurrent.every((item) => item.currentStage === 'P02'), 'Concurrent reads must deterministically project incomplete registration at P02.');
  const processCount = await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM enrollment_processes WHERE enrollment_application_id=$1', [intake.enrollmentApplicationId]);
  assert(processCount.rows[0].count === 1, 'Concurrent reads must preserve one process per application.');
  const startEvents = await pool.query<{ count: number }>("SELECT count(*)::int AS count FROM enrollment_events WHERE enrollment_application_id=$1 AND event_type='process_started'", [intake.enrollmentApplicationId]);
  assert(startEvents.rows[0].count === 1, 'Concurrent/retry reads must emit process_started exactly once.');

  const initialVersion = concurrent.at(-1)!.version;
  await loadEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId);
  const retryVersion = (await loadEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId)).version;
  assert(retryVersion === initialVersion, 'Retry without changed truth must not create a new version or event.');

  const registrationBeforeSave = await loadEnrollmentRegistration(pool as any, contextA, intake.enrollmentApplicationId);
  await saveEnrollmentRegistration(pool as any, contextA, intake.enrollmentApplicationId, {
    expectedRegistrationVersion: registrationBeforeSave.registrationVersion,
    student: { expectedVersion: registrationBeforeSave.student.version, name: 'Aluno S03', birthDate: '2012-04-03', phone: '923000001', gender: 'male', nationality: 'Angolana', province: 'Luanda', municipality: 'Talatona', addressLine: 'Rua S03' },
    guardian: { expectedVersion: '1', name: 'Responsável S03', relationship: 'Pai', phone: '924000001' }, enrollment: {},
  });
  const documentBlocked = await loadEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId);
  assert(documentBlocked.currentStage === 'P04' && documentBlocked.nextAction?.code === 'SUBMIT_REQUIRED_DOCUMENTS', 'Completed registration must expose the real pending document action.');

  const documents = await pool.query<{ id: string }>('SELECT id FROM enrollment_documents WHERE enrollment_application_id=$1 AND required=true', [intake.enrollmentApplicationId]);
  const documentId = documents.rows[0].id;
  await transitionEnrollmentDocument(pool as any, contextA, { enrollmentId: intake.enrollmentApplicationId, documentId, toStatus: 'submitted', evidenceReference: 's03/evidence/id' });
  const submitted = await loadEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId);
  assert(submitted.nextAction?.code === 'VERIFY_REQUIRED_DOCUMENTS', 'Submitted evidence must change the process action without browser stage writes.');
  await transitionEnrollmentDocument(pool as any, contextA, { enrollmentId: intake.enrollmentApplicationId, documentId, toStatus: 'verified' });
  await pool.query("UPDATE enrollment_applications SET status='under_review',updated_at=now() WHERE id=$1", [intake.enrollmentApplicationId]);
  const ready = await loadEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId);
  assert(ready.currentStage === 'P06' && ready.progress.completed === 5 && ready.nextAction?.code === 'VALIDATE_ENROLLMENT', 'Verified documents and complete registration must reach Ready for decision.');

  let forbiddenActorRejected = false;
  try { await assignEnrollmentProcess(pool as any, forbiddenContextA, intake.enrollmentApplicationId, { assignedToPersonId: ids.assigneeA, expectedVersion: ready.version }); }
  catch (error) { forbiddenActorRejected = error instanceof EnrollmentProcessApiError && error.code === 'FORBIDDEN'; }
  assert(forbiddenActorRejected, 'Financial Membership must not assign Enrollment process work.');
  let forbiddenAssigneeRejected = false;
  try { await assignEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId, { assignedToPersonId: ids.forbiddenAssigneeA, expectedVersion: ready.version }); }
  catch (error) { forbiddenAssigneeRejected = error instanceof EnrollmentProcessApiError && error.code === 'INVALID_ASSIGNEE'; }
  assert(forbiddenAssigneeRejected, 'Financial Membership must not receive Enrollment process work.');
  let inactiveAssigneeRejected = false;
  try { await assignEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId, { assignedToPersonId: ids.inactiveAssigneeA, expectedVersion: ready.version }); }
  catch (error) { inactiveAssigneeRejected = error instanceof EnrollmentProcessApiError && error.code === 'INVALID_ASSIGNEE'; }
  assert(inactiveAssigneeRejected, 'Inactive Membership must not receive Enrollment process work.');

  const progressBeforeAssignment = await pool.query<{ last_progress_at: string }>('SELECT last_progress_at::text FROM enrollment_processes WHERE enrollment_application_id=$1', [intake.enrollmentApplicationId]);
  await pool.query('SELECT pg_sleep(0.01)');
  const assigned = await assignEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId, { assignedToPersonId: ids.assigneeA, expectedVersion: ready.version });
  assert(assigned.assigned_to_person_id === ids.assigneeA && assigned.version === ready.version + 1, 'Same-institution assignment must persist with optimistic versioning.');
  const progressAfterAssignment = await pool.query<{ last_progress_at: string }>('SELECT last_progress_at::text FROM enrollment_processes WHERE enrollment_application_id=$1', [intake.enrollmentApplicationId]);
  assert(progressAfterAssignment.rows[0].last_progress_at > progressBeforeAssignment.rows[0].last_progress_at, 'Approved assignment is a progress event and must advance last_progress_at.');
  await loadEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId);
  const progressAfterRead = await pool.query<{ last_progress_at: string }>('SELECT last_progress_at::text FROM enrollment_processes WHERE enrollment_application_id=$1', [intake.enrollmentApplicationId]);
  assert(progressAfterRead.rows[0].last_progress_at === progressAfterAssignment.rows[0].last_progress_at, 'Plain read must not advance last_progress_at.');
  let staleRejected = false;
  try { await assignEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId, { assignedToPersonId: null, expectedVersion: ready.version }); }
  catch (error) { staleRejected = error instanceof EnrollmentProcessApiError && error.code === 'STALE_VERSION'; }
  assert(staleRejected, 'Stale assignment must not overwrite the latest process state.');
  let outsiderRejected = false;
  try { await assignEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId, { assignedToPersonId: ids.outsiderB, expectedVersion: assigned.version }); }
  catch (error) { outsiderRejected = error instanceof EnrollmentProcessApiError && error.code === 'INVALID_ASSIGNEE'; }
  assert(outsiderRejected, 'Cross-institution assignee must be rejected.');

  let crossTenantReadRejected = false;
  try { await loadEnrollmentProcess(pool as any, contextB, intake.enrollmentApplicationId); }
  catch (error) { crossTenantReadRejected = error instanceof EnrollmentProcessApiError && error.code === 'NOT_FOUND'; }
  assert(crossTenantReadRejected, 'Cross-institution read must fail as not found without leak.');

  await pool.query("UPDATE enrollment_applications SET status='validated',updated_at=now() WHERE id=$1", [intake.enrollmentApplicationId]);
  const validated = await loadEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId);
  assert(validated.currentStage === 'P06' && validated.progress.percent === 100 && validated.nextAction === null, 'Validated must complete S03 without exposing activation.');

  await pool.end();
  pool = new Pool({ connectionString, options: `-c search_path=${schema},public`, max: 4 });
  const afterRestart = await loadEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId);
  assert(afterRestart.currentStage === 'P06' && afterRestart.assignedTo?.personId === ids.assigneeA, 'Restart must preserve process and assignment state.');

  const cancelledIntake = await executeEnrollmentIntake(pool as any, {
    institutionId: ids.institutionA, actorPersonId: ids.actorA, offerId: ids.offerA,
    idempotencyKey: `s03-cancel-${randomUUID()}`, person: { kind: 'new_person', name: 'Aluno Cancelado', birthDate: '2013-05-04', phone: '923000002' },
  });
  await pool.query("UPDATE enrollment_applications SET status='cancelled' WHERE id=$1", [cancelledIntake.enrollmentApplicationId]);
  const cancelled = await loadEnrollmentProcess(pool as any, contextA, cancelledIntake.enrollmentApplicationId);
  assert(cancelled.currentStage === 'P06' && cancelled.nextAction === null && cancelled.blockers.some((item) => item.reasonCode === 'ENROLLMENT_CANCELLED'), 'Cancellation must terminate process progression.');

  await pool.query("UPDATE enrollment_applications SET status='active' WHERE id=$1", [intake.enrollmentApplicationId]);
  const active = await loadEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId);
  assert(active.progress.percent === 100 && active.nextAction === null, 'Future active lifecycle state must remain terminal for S03.');

  const processEvents = await pool.query<{ event_type: string }>('SELECT event_type FROM enrollment_events WHERE enrollment_application_id=$1', [intake.enrollmentApplicationId]);
  assert(processEvents.rows.filter((row) => row.event_type === 'process_assignment_changed').length === 1, 'Assignment must be audited exactly once after stale retry.');
  assert(processEvents.rows.filter((row) => row.event_type === 'process_reconciled').length === 0, 'Plain reads must not persist reconciliation or attribute it to a human reader.');
  await reconcileEnrollmentProcess(pool as any, contextA, intake.enrollmentApplicationId, 's03-explicit-system-reconciliation');
  const progressAfterReconciliation = await pool.query<{ last_progress_at: string }>('SELECT last_progress_at::text FROM enrollment_processes WHERE enrollment_application_id=$1', [intake.enrollmentApplicationId]);
  assert(progressAfterReconciliation.rows[0].last_progress_at === progressAfterAssignment.rows[0].last_progress_at, 'System reconciliation is not progress and must not advance last_progress_at.');
  const reconciliation = await pool.query<{ actor_kind: string; actor_person_id: string | null; system_cause: string | null; correlation_id: string | null }>(
    "SELECT actor_kind, actor_person_id, system_cause, correlation_id FROM enrollment_events WHERE enrollment_application_id=$1 AND event_type='process_reconciled'",
    [intake.enrollmentApplicationId],
  );
  assert(reconciliation.rowCount === 1 && reconciliation.rows[0].actor_kind === 'system' && reconciliation.rows[0].actor_person_id === null && reconciliation.rows[0].system_cause === 'PROCESS_RECONCILIATION' && reconciliation.rows[0].correlation_id === 's03-explicit-system-reconciliation', 'Explicit reconciliation must be factual system audit evidence.');

  console.log(`[S03-PROCESS-POSTGRES] passed (${assertions} assertions).`);
} finally {
  await pool.end().catch(() => undefined);
  await bootstrap.query(`DROP SCHEMA IF EXISTS ${schemaId} CASCADE`);
  await bootstrap.end();
}
