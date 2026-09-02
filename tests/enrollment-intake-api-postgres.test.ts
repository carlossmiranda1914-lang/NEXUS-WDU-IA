import 'dotenv/config';
import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import {
  decideEnrollmentIdentityDecision,
  EnrollmentIntakeApiError,
  proposeEnrollmentIdentityDecision,
  resolveStudentForEnrollment,
  startEnrollmentIntake,
  type EnrollmentApiPool,
} from '../src/modules/enrollments/enrollment-intake-api.ts';
import { EnrollmentIntakeError, executeEnrollmentIntake } from '../src/modules/enrollments/enrollment-intake.ts';

const { Pool } = pg;
const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error('TEST_DATABASE_URL is required for T6 PostgreSQL integration test.');

const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const schemaName = `nexus_t6_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
if (!/^[a-z0-9_]+$/.test(schemaName)) throw new Error('Unsafe generated schema name.');
const schemaIdentifier = `"${schemaName}"`;

const bootstrapPool = new Pool({ connectionString });
await bootstrapPool.query(`CREATE SCHEMA ${schemaIdentifier}`);

function createScopedPool(): pg.Pool & EnrollmentApiPool {
  return new Pool({
    connectionString,
    options: `-c search_path=${schemaName},public`,
    max: 4,
  }) as pg.Pool & EnrollmentApiPool;
}

let pool = createScopedPool();

const ids = {
  institutionA: randomUUID(),
  institutionB: randomUUID(),
  secretariatA: randomUUID(),
  directorA: randomUUID(),
  adminA: randomUUID(),
  localStudent: randomUUID(),
  externalStudent: randomUUID(),
  yearA: randomUUID(),
  offerA: randomUUID(),
};

function context(personId: string, role: 'secretariat' | 'director' | 'institution_admin'): InstitutionalContext {
  return {
    personId,
    personName: role === 'secretariat' ? 'Secretaria A' : role === 'director' ? 'Direção A' : 'Admin A',
    identityEmail: null,
    membershipId: randomUUID(),
    institutionId: ids.institutionA,
    institutionName: 'Escola A',
    institutionSlug: 'escola-a',
    role,
  };
}

const secretariatContext = context(ids.secretariatA, 'secretariat');
const directorContext = context(ids.directorA, 'director');
const adminContext = context(ids.adminA, 'institution_admin');

try {
  const migrationFiles = (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  const migrationPool = new Pool({ connectionString, options: `-c search_path=${schemaName}` });
  const migrationClient = await migrationPool.connect();
  try {
    for (const filename of migrationFiles) {
      await migrationClient.query(await readFile(path.join(migrationsDirectory, filename), 'utf8'));
    }
  } finally {
    migrationClient.release(); await migrationPool.end();
  }

  await pool.query(
    `INSERT INTO institutions (id, name, slug, status) VALUES
      ($1, 'Escola A', 'escola-a', 'active'),
      ($2, 'Escola B', 'escola-b', 'active')`,
    [ids.institutionA, ids.institutionB],
  );
  await pool.query(
    `INSERT INTO people (id, name, birth_date, phone) VALUES
      ($1, 'Secretaria A', NULL, NULL),
      ($2, 'Direção A', NULL, NULL),
      ($3, 'Admin A', NULL, NULL),
      ($4, 'Aluno Local', '2013-02-10', '+244923111111'),
      ($5, 'Aluno Restrito', '2012-05-20', '+244923222222')`,
    [ids.secretariatA, ids.directorA, ids.adminA, ids.localStudent, ids.externalStudent],
  );
  await pool.query(
    `INSERT INTO memberships (person_id, institution_id, role, status) VALUES
      ($1, $4, 'secretariat', 'active'),
      ($2, $4, 'director', 'active'),
      ($3, $4, 'institution_admin', 'active')`,
    [ids.secretariatA, ids.directorA, ids.adminA, ids.institutionA],
  );
  await pool.query(
    `INSERT INTO student_profiles (institution_id, person_id, student_number, status) VALUES
      ($1, $2, 'ALU-A-001', 'active'),
      ($3, $4, 'ALU-B-001', 'active')`,
    [ids.institutionA, ids.localStudent, ids.institutionB, ids.externalStudent],
  );
  await pool.query(
    `INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status)
     VALUES ($1, $2, '2026/2027', '2026-09-01', '2027-07-31', 'active')`,
    [ids.yearA, ids.institutionA],
  );
  await pool.query(
    `INSERT INTO enrollment_offers (id, institution_id, academic_year_id, name, code, status)
     VALUES ($1, $2, $3, 'Matrícula Geral', 'MAT-2026', 'active')`,
    [ids.offerA, ids.institutionA, ids.yearA],
  );

  // Regression proof: direct T4 reuse of an external Person without an approved
  // decision must fail closed before any global Person-existence lookup.
  let directExternalReuseError: unknown;
  try {
    await executeEnrollmentIntake(pool, {
      institutionId: ids.institutionA,
      actorPersonId: ids.secretariatA,
      offerId: ids.offerA,
      idempotencyKey: 't6-direct-external-reuse-0001',
      person: { kind: 'reuse_person', personId: ids.externalStudent },
    });
  } catch (error) { directExternalReuseError = error; }
  if (!(directExternalReuseError instanceof EnrollmentIntakeError) || directExternalReuseError.code !== 'PERSON_NOT_FOUND') {
    throw new Error('Direct cross-institution reuse must preserve T4 PERSON_NOT_FOUND fail-closed behavior.');
  }

  // D-06 C2: only a human name is available. The resolver runs, but direct
  // creation remains blocked until a controlled, independently approved decision.
  const nameOnlyStudent = { name: 'Nova Pessoa Real', birthDate: null, phone: null };
  let nameOnlyBlocked: unknown;
  try {
    await startEnrollmentIntake(pool, secretariatContext, {
      offerId: ids.offerA,
      student: nameOnlyStudent,
      idempotencyKey: 't6-restart-name-only-0001',
    });
  } catch (error) { nameOnlyBlocked = error; }
  if (!(nameOnlyBlocked instanceof EnrollmentIntakeApiError) || nameOnlyBlocked.code !== 'IDENTITY_REVIEW_REQUIRED') {
    throw new Error('Name-only intake must not create Person automatically.');
  }

  const nameOnlyProposal = await proposeEnrollmentIdentityDecision(pool, directorContext, {
    offerId: ids.offerA,
    student: nameOnlyStudent,
    proposedAction: 'CREATE_PERSON',
    evidenceTypes: ['manual_interview'],
  });
  if (nameOnlyProposal.status !== 'pending_second_approval') {
    throw new Error('Name-only exceptional creation must require second approval.');
  }
  const nameOnlyApproved = await decideEnrollmentIdentityDecision(pool, adminContext, nameOnlyProposal.id, 'approve');
  if (nameOnlyApproved.status !== 'approved') throw new Error('Institution Admin did not approve D-06 exceptional creation.');

  const first = await startEnrollmentIntake(pool, secretariatContext, {
    offerId: ids.offerA,
    student: nameOnlyStudent,
    idempotencyKey: 't6-restart-name-only-0001',
    decisionId: nameOnlyApproved.id,
  });
  if (first.replayed) throw new Error('First approved name-only intake must not be replayed.');

  await pool.end();
  pool = createScopedPool();

  const replay = await startEnrollmentIntake(pool, secretariatContext, {
    offerId: ids.offerA,
    student: nameOnlyStudent,
    idempotencyKey: 't6-restart-name-only-0001',
    decisionId: nameOnlyApproved.id,
  });
  if (!replay.replayed || replay.enrollmentApplicationId !== first.enrollmentApplicationId) {
    throw new Error('Restart replay did not return the original enrollment.');
  }

  const local = await startEnrollmentIntake(pool, secretariatContext, {
    offerId: ids.offerA,
    student: { name: 'Aluno Local', studentNumber: 'ALU-A-001' },
    idempotencyKey: 't6-local-reuse-0001',
  });
  if (local.studentPersonId !== ids.localStudent) throw new Error('Local Person was not reused.');

  const restrictedInput = { name: 'Aluno Restrito', birthDate: '2012-05-20' };
  const restricted = await resolveStudentForEnrollment(pool, secretariatContext, restrictedInput);
  if (restricted.status !== 'RESTRICTED_POSSIBLE_MATCH') throw new Error('Expected restricted cross-institution match.');
  if (restricted.candidatePersonId || 'localCandidates' in restricted) throw new Error('Restricted response leaked Person information.');

  const proposal = await proposeEnrollmentIdentityDecision(pool, secretariatContext, {
    offerId: ids.offerA,
    student: restrictedInput,
    proposedAction: 'REUSE_PERSON',
    evidenceTypes: ['civil_document_presented', 'birth_date_confirmation'],
  });
  if (proposal.status !== 'pending_confirmation') throw new Error('Restricted reuse proposal must await leadership confirmation.');

  const approved = await decideEnrollmentIdentityDecision(pool, directorContext, proposal.id, 'approve');
  if (approved.status !== 'approved') throw new Error('Director did not approve the level-B identity decision.');

  const crossInstitution = await startEnrollmentIntake(pool, secretariatContext, {
    offerId: ids.offerA,
    student: restrictedInput,
    idempotencyKey: 't6-approved-cross-institution-0001',
    decisionId: approved.id,
  });
  if (crossInstitution.studentPersonId !== ids.externalStudent) throw new Error('Approved cross-institution Person was not reused.');

  const profile = await pool.query(
    `SELECT id FROM student_profiles WHERE institution_id = $1 AND person_id = $2`,
    [ids.institutionA, ids.externalStudent],
  );
  if (profile.rowCount !== 1) throw new Error('Approved reuse did not create exactly one institutional StudentProfile.');

  const counts = await pool.query<{ enrollment_count: string }>(
    `SELECT (SELECT count(*) FROM enrollment_applications)::text AS enrollment_count`,
  );
  if (Number(counts.rows[0].enrollment_count) !== 3) throw new Error('Expected exactly three enrollments in T6 integration proof.');

  console.log('[T6-POSTGRES] PASS: direct cross-institution reuse without decision failed closed with PERSON_NOT_FOUND.');
  console.log('[T6-POSTGRES] PASS: D-06 name-only intake was blocked from automatic creation and completed only after independent approval.');
  console.log('[T6-POSTGRES] PASS: approved intake persisted across pool restart and replayed idempotently.');
  console.log('[T6-POSTGRES] PASS: local Person reused without duplicate.');
  console.log('[T6-POSTGRES] PASS: Escola B candidate remained restricted to Escola A until D-05 approval.');
  console.log('[T6-POSTGRES] PASS: approved D-05 decision enabled cross-institution reuse inside the T4 transaction.');
} finally {
  await pool.end().catch(() => undefined);
  await bootstrapPool.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`).catch(() => undefined);
  await bootstrapPool.end();
}
