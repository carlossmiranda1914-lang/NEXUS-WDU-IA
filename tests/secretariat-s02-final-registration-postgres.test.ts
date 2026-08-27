import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeEnrollmentIntake } from '../src/modules/enrollments/enrollment-intake.ts';
import {
  EnrollmentRegistrationApiError,
  loadEnrollmentRegistration,
  saveEnrollmentRegistration,
} from '../src/modules/enrollments/enrollment-registration-api.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error('TEST_DATABASE_URL is required for S02 final registration PostgreSQL test.');
const { Pool } = pg;
const schema = `nexus_s02final_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const schemaId = `"${schema}"`;
const bootstrap = new Pool({ connectionString });
await bootstrap.query(`CREATE SCHEMA ${schemaId}`);
const pool = new Pool({ connectionString, options: `-c search_path=${schema},public`, max: 4 });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };

try {
  const migrations = (await readdir(migrationsDir)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const filename of migrations) await pool.query(await readFile(path.join(migrationsDir, filename), 'utf8'));

  const institution = randomUUID();
  const actor = randomUUID();
  const membership = randomUUID();
  const year = randomUUID();
  const offer = randomUUID();
  await pool.query("INSERT INTO institutions (id,name,slug,status) VALUES ($1,'Escola S02 Final','s02-final','active')", [institution]);
  await pool.query("INSERT INTO people (id,name) VALUES ($1,'Secretaria S02 Final')", [actor]);
  await pool.query("INSERT INTO memberships (id,person_id,institution_id,role,status) VALUES ($1,$2,$3,'secretariat','active')", [membership, actor, institution]);
  await pool.query("INSERT INTO academic_years (id,institution_id,name,starts_on,ends_on,status) VALUES ($1,$2,'2026/2027','2026-09-01','2027-07-31','active')", [year, institution]);
  await pool.query("INSERT INTO enrollment_offers (id,institution_id,academic_year_id,name,code,status) VALUES ($1,$2,$3,'Ensino Geral','S02FINAL','active')", [offer, institution, year]);

  const context: InstitutionalContext = {
    personId: actor,
    personName: 'Secretaria S02 Final',
    identityEmail: 'secretaria@example.test',
    membershipId: membership,
    institutionId: institution,
    institutionName: 'Escola S02 Final',
    institutionSlug: 's02-final',
    role: 'secretariat',
  };

  const first = await executeEnrollmentIntake(pool as any, {
    institutionId: institution,
    actorPersonId: actor,
    offerId: offer,
    idempotencyKey: `s02-final-first-${randomUUID()}`,
    person: { kind: 'new_person', name: 'Ana Manuel', birthDate: '2012-05-04', phone: '923000000' },
  });

  const initial = await loadEnrollmentRegistration(pool as any, context, first.enrollmentApplicationId);
  assert(initial.registrationVersion === '1', 'Registration reads must expose the application version for stale-write protection.');
  assert(initial.student.version === '1', 'Registration reads must expose the student Person version for stale-write protection.');
  assert(!initial.readiness.ready, 'New intake must remain incomplete until full registration is supplied.');
  assert(initial.readiness.missing.includes('guardian'), 'New intake must require a guardian.');

  let missingVersionsRejected = false;
  try {
    await saveEnrollmentRegistration(pool as any, context, first.enrollmentApplicationId, {
      student: { name: 'Ana Manuel', birthDate: '2012-05-04' }, guardian: null, enrollment: {},
    });
  } catch (error) {
    missingVersionsRejected = error instanceof EnrollmentRegistrationApiError && error.code === 'INVALID_INPUT';
  }
  assert(missingVersionsRejected, 'Registration writes must reject a payload without explicit expected versions.');

  const saved = await saveEnrollmentRegistration(pool as any, context, first.enrollmentApplicationId, {
    expectedRegistrationVersion: initial.registrationVersion,
    student: {
      expectedVersion: initial.student.version,
      name: 'Ana Manuel', birthDate: '2012-05-04', phone: '923000000', whatsapp: '923000000', email: 'ana@example.test',
      nationalIdNumber: 'BI-ANA-001', gender: 'female', nationality: 'Angolana', province: 'Luanda', municipality: 'Talatona',
      addressLine: 'Rua 1, Casa 2', studentNumber: 'AL-001',
    },
    guardian: {
      expectedVersion: '1',
      name: 'Maria Manuel', relationship: 'Mãe', phone: '924000000', whatsapp: '924000000', email: 'maria@example.test',
      nationalIdNumber: 'BI-MARIA-001', financialResponsible: true,
    },
    enrollment: { previousSchool: 'Escola Primária A', notes: 'Cadastro completo S02 final.' },
  });
  assert(saved.readiness.ready, 'Complete student and guardian registration must become ready.');
  assert(saved.registrationVersion === '2', 'A successful registration write must advance the registration version.');
  assert(saved.student.version === '2', 'A successful student mutation must advance the Person version.');
  assert(saved.student.nationalIdNumber === 'BI-ANA-001', 'Student BI must persist.');
  assert(saved.student.whatsapp === '923000000', 'Student WhatsApp must persist separately.');
  assert(saved.guardian?.relationship === 'Mãe', 'Guardian relationship must persist.');
  assert(saved.guardian?.financialResponsible === true, 'Financial responsibility must persist.');
  assert(saved.enrollment.previousSchool === 'Escola Primária A', 'Enrollment-specific previous school must persist.');

  let staleRejected = false;
  try {
    await saveEnrollmentRegistration(pool as any, context, first.enrollmentApplicationId, {
      expectedRegistrationVersion: '1',
      student: { ...saved.student, expectedVersion: '1', name: 'Ana Manuel Stale' },
      guardian: saved.guardian ? { ...saved.guardian, expectedVersion: '1' } : null,
      enrollment: saved.enrollment,
    });
  } catch (error) {
    staleRejected = error instanceof EnrollmentRegistrationApiError && error.code === 'STALE_VERSION';
  }
  assert(staleRejected, 'A stale registration write must fail closed with STALE_VERSION.');
  const persistedStudent = await pool.query('SELECT name FROM people WHERE id=$1', [first.studentPersonId]);
  assert(persistedStudent.rows[0].name === 'Ana Manuel', 'A stale registration write must not overwrite the accepted student value.');
  const successEventsAfterStale = await pool.query("SELECT count(*)::int AS count FROM enrollment_events WHERE enrollment_application_id = $1 AND event_type = 'registration_updated'", [first.enrollmentApplicationId]);
  assert(successEventsAfterStale.rows[0].count === 1, 'A stale conflict must not create a registration success audit event.');

  const externalPerson = randomUUID();
  const externalInstitution = randomUUID();
  await pool.query("INSERT INTO institutions (id,name,slug,status) VALUES ($1,'Escola Externa EN01','externa-en01','active')", [externalInstitution]);
  await pool.query("INSERT INTO people (id,name,national_id_number) VALUES ($1,'Pessoa Externa','BI-EXTERNO-001')", [externalPerson]);
  await pool.query("INSERT INTO student_profiles (institution_id,person_id,status) VALUES ($1,$2,'active')", [externalInstitution, externalPerson]);
  let collisionRejected = false;
  try {
    await saveEnrollmentRegistration(pool as any, context, first.enrollmentApplicationId, {
      expectedRegistrationVersion: saved.registrationVersion,
      student: { ...saved.student, expectedVersion: saved.student.version, nationalIdNumber: ' bi-externo-001 ' },
      guardian: saved.guardian ? { ...saved.guardian, expectedVersion: saved.guardian.version } : null,
      enrollment: saved.enrollment,
    });
  } catch (error) {
    collisionRejected = error instanceof EnrollmentRegistrationApiError && String(error.code) === 'IDENTITY_COLLISION';
  }
  assert(collisionRejected, 'A national identifier collision in another institution must fail closed.');
  const studentAfterCollision = await pool.query('SELECT national_id_number FROM people WHERE id=$1', [first.studentPersonId]);
  assert(studentAfterCollision.rows[0].national_id_number === 'BI-ANA-001', 'Collision rollback must leave the student unchanged.');
  const versionAfterCollision = await pool.query('SELECT registration_version FROM enrollment_applications WHERE id=$1', [first.enrollmentApplicationId]);
  assert(versionAfterCollision.rows[0].registration_version === '2', 'Collision rollback must leave the registration version unchanged.');
  const successEventsAfterCollision = await pool.query("SELECT count(*)::int AS count FROM enrollment_events WHERE enrollment_application_id = $1 AND event_type = 'registration_updated'", [first.enrollmentApplicationId]);
  assert(successEventsAfterCollision.rows[0].count === 1, 'An identity collision must not create a registration success audit event.');
  const registrationEvent = await pool.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM enrollment_events WHERE enrollment_application_id = $1 AND event_type = 'registration_updated' ORDER BY created_at DESC LIMIT 1", [first.enrollmentApplicationId]);
  const auditJson = JSON.stringify(registrationEvent.rows[0].metadata).toLowerCase();
  assert(registrationEvent.rows[0].metadata.operation === 'registration_updated' && registrationEvent.rows[0].metadata.result === 'success', 'Successful registration audit must record factual operation and result.');
  assert(!/bi-ana|example\.test|923000000|rua 1/.test(auditJson), 'Registration audit must not contain person PII.');

  const noResolutionPool = {
    connect: async () => {
      const guarded = await pool.connect();
      const query = guarded.query.bind(guarded);
      const release = guarded.release.bind(guarded);
      guarded.query = ((text: string, values?: unknown[]) => {
        if (text.includes('WITH candidate_people')) throw new Error('Profile-only edit must not invoke Person Resolution.');
        return query(text, values);
      }) as typeof guarded.query;
      guarded.release = ((error?: Error | boolean) => { guarded.query = query as typeof guarded.query; return release(error); }) as typeof guarded.release;
      return guarded;
    },
  };
  const profileOnly = await saveEnrollmentRegistration(noResolutionPool as any, context, first.enrollmentApplicationId, {
    expectedRegistrationVersion: saved.registrationVersion,
    student: { ...saved.student, expectedVersion: saved.student.version, addressLine: 'Rua 1, Casa 3' },
    guardian: saved.guardian ? { ...saved.guardian, expectedVersion: saved.guardian.version } : null,
    enrollment: saved.enrollment,
  });
  assert(profileOnly.registrationVersion === '3' && profileOnly.student.version === '3', 'A profile-only edit must remain version-protected and advance authoritative versions.');
  const profileEvent = await pool.query<{ metadata: Record<string, unknown> }>("SELECT metadata FROM enrollment_events WHERE enrollment_application_id=$1 AND event_type='registration_updated' ORDER BY created_at DESC LIMIT 1", [first.enrollmentApplicationId]);
  assert((profileEvent.rows[0].metadata.categories as string[]).includes('profile_only'), 'A profile-only edit must produce factual profile-only audit metadata.');

  let guardianStaleRejected = false;
  const guardianForStale = await pool.query<{ guardian_person_id: string }>('SELECT guardian_person_id FROM enrollment_applications WHERE id = $1', [first.enrollmentApplicationId]);
  await pool.query('UPDATE people SET version = 2 WHERE id = $1', [guardianForStale.rows[0].guardian_person_id]);
  try {
    await saveEnrollmentRegistration(pool as any, context, first.enrollmentApplicationId, {
      expectedRegistrationVersion: profileOnly.registrationVersion,
      student: { ...profileOnly.student, expectedVersion: profileOnly.student.version },
      guardian: saved.guardian ? { ...saved.guardian, expectedVersion: saved.guardian.version, phone: '925000000' } : null,
      enrollment: saved.enrollment,
    });
  } catch (error) {
    guardianStaleRejected = error instanceof EnrollmentRegistrationApiError && error.code === 'STALE_VERSION';
  }
  assert(guardianStaleRejected, 'A stale Guardian version must fail before any registration write.');

  const application = await pool.query('SELECT guardian_person_id FROM enrollment_applications WHERE id=$1', [first.enrollmentApplicationId]);
  const firstGuardianId = application.rows[0].guardian_person_id as string;
  assert(Boolean(firstGuardianId), 'Enrollment must link the primary guardian person.');
  const relationship = await pool.query('SELECT relationship,is_primary,financial_responsible FROM guardian_relationships WHERE institution_id=$1 AND student_person_id=$2 AND guardian_person_id=$3', [institution, first.studentPersonId, firstGuardianId]);
  assert(relationship.rows[0].is_primary === true, 'Guardian relationship must mark the application guardian as primary.');

  const second = await executeEnrollmentIntake(pool as any, {
    institutionId: institution,
    actorPersonId: actor,
    offerId: offer,
    idempotencyKey: `s02-final-second-${randomUUID()}`,
    person: { kind: 'new_person', name: 'João Manuel', birthDate: '2013-06-05', phone: '925000000' },
  });
  await saveEnrollmentRegistration(pool as any, context, second.enrollmentApplicationId, {
    expectedRegistrationVersion: '1',
    student: {
      expectedVersion: '1',
      name: 'João Manuel', birthDate: '2013-06-05', phone: '925000000', gender: 'male', nationality: 'Angolana',
      province: 'Luanda', municipality: 'Talatona', addressLine: 'Rua 2, Casa 3',
    },
    guardian: {
      expectedVersion: '1',
      name: 'Maria Manuel', relationship: 'Mãe', phone: '924000000', email: 'maria@example.test', nationalIdNumber: 'BI-MARIA-001',
    },
    enrollment: {},
  });
  const secondApplication = await pool.query('SELECT guardian_person_id FROM enrollment_applications WHERE id=$1', [second.enrollmentApplicationId]);
  assert(secondApplication.rows[0].guardian_person_id === firstGuardianId, 'A safely matched local guardian must be reused instead of duplicated.');

  const peopleCount = await pool.query("SELECT count(*)::int AS count FROM people WHERE national_id_number='BI-MARIA-001'");
  assert(peopleCount.rows[0].count === 1, 'Guardian reuse must not create a duplicate person.');

  const otherInstitution = randomUUID();
  const otherActor = randomUUID();
  await pool.query("INSERT INTO institutions (id,name,slug,status) VALUES ($1,'Outra Escola','outra-escola','active')", [otherInstitution]);
  await pool.query("INSERT INTO people (id,name) VALUES ($1,'Outra Secretaria')", [otherActor]);
  let isolated = false;
  try {
    await loadEnrollmentRegistration(pool as any, { ...context, institutionId: otherInstitution, personId: otherActor }, first.enrollmentApplicationId);
  } catch (error) {
    isolated = error instanceof EnrollmentRegistrationApiError && error.code === 'NOT_FOUND';
  }
  assert(isolated, 'Registration reads must preserve institutional isolation.');

  await pool.query("UPDATE enrollment_applications SET status='validated' WHERE id=$1", [first.enrollmentApplicationId]);
  let immutable = false;
  try {
    await saveEnrollmentRegistration(pool as any, context, first.enrollmentApplicationId, {
      expectedRegistrationVersion: profileOnly.registrationVersion,
      student: { ...profileOnly.student, expectedVersion: profileOnly.student.version, name: 'Ana Manuel Atualizada' },
      guardian: profileOnly.guardian ? { ...profileOnly.guardian, expectedVersion: '2' } : null,
      enrollment: saved.enrollment,
    });
  } catch (error) {
    immutable = error instanceof EnrollmentRegistrationApiError && error.code === 'IMMUTABLE';
  }
  assert(immutable, 'Validated registration must be immutable through the registration API.');

  console.log(`[S02-FINAL-REGISTRATION-POSTGRES] passed (${assertions} assertions).`);
} finally {
  await pool.end();
  await bootstrap.query(`DROP SCHEMA IF EXISTS ${schemaId} CASCADE`);
  await bootstrap.end();
}
