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

  const saved = await saveEnrollmentRegistration(pool as any, context, first.enrollmentApplicationId, {
    student: {
      name: 'Ana Manuel', birthDate: '2012-05-04', phone: '923000000', whatsapp: '923000000', email: 'ana@example.test',
      nationalIdNumber: 'BI-ANA-001', gender: 'female', nationality: 'Angolana', province: 'Luanda', municipality: 'Talatona',
      addressLine: 'Rua 1, Casa 2', studentNumber: 'AL-001',
    },
    guardian: {
      name: 'Maria Manuel', relationship: 'Mãe', phone: '924000000', whatsapp: '924000000', email: 'maria@example.test',
      nationalIdNumber: 'BI-MARIA-001', financialResponsible: true,
    },
    enrollment: { previousSchool: 'Escola Primária A', notes: 'Cadastro completo S02 final.' },
  });
  assert(saved.readiness.ready, 'Complete student and guardian registration must become ready.');
  assert(saved.student.nationalIdNumber === 'BI-ANA-001', 'Student BI must persist.');
  assert(saved.student.whatsapp === '923000000', 'Student WhatsApp must persist separately.');
  assert(saved.guardian?.relationship === 'Mãe', 'Guardian relationship must persist.');
  assert(saved.guardian?.financialResponsible === true, 'Financial responsibility must persist.');
  assert(saved.enrollment.previousSchool === 'Escola Primária A', 'Enrollment-specific previous school must persist.');

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
    student: {
      name: 'João Manuel', birthDate: '2013-06-05', phone: '925000000', gender: 'male', nationality: 'Angolana',
      province: 'Luanda', municipality: 'Talatona', addressLine: 'Rua 2, Casa 3',
    },
    guardian: {
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
      student: { ...saved.student, name: 'Ana Manuel Atualizada' }, guardian: saved.guardian, enrollment: saved.enrollment,
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
