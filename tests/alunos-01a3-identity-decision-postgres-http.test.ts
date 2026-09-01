import 'dotenv/config';
import assert from 'node:assert/strict';
import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import http from 'node:http';
import express from 'express';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import { resolveInstitutionalContext } from '../src/auth/institutional-context.ts';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { registerEnrollmentRoutes } from '../src/modules/enrollments/enrollment.controller.ts';
import {
  decideEnrollmentIdentityDecision,
  EnrollmentIntakeApiError,
  proposeEnrollmentIdentityDecision,
  resolveStudentForEnrollment,
  startEnrollmentIntake,
  type EnrollmentApiPool,
} from '../src/modules/enrollments/enrollment-intake-api.ts';
import { EnrollmentIntakeError, executeEnrollmentIntake } from '../src/modules/enrollments/enrollment-intake.ts';
import { proposeIdentityDecision } from '../src/modules/people/identity-resolution-decision.ts';

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
const foreignDirector = randomUUID();

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
let server: http.Server | undefined;

try {
  const migrationFiles = (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  const migrationClient = await pool.connect();
  try {
    for (const filename of migrationFiles) {
      await migrationClient.query(await readFile(path.join(migrationsDirectory, filename), 'utf8'));
    }
  } finally {
    migrationClient.release();
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
      ($5, 'Aluno Restrito', '2012-05-20', '+244923222222'),
      ($6, 'Direção B', NULL, NULL)`,
    [ids.secretariatA, ids.directorA, ids.adminA, ids.localStudent, ids.externalStudent, foreignDirector],
  );
  await pool.query(
    `INSERT INTO memberships (person_id, institution_id, role, status) VALUES
      ($1, $4, 'secretariat', 'active'),
      ($2, $4, 'director', 'active'),
      ($3, $4, 'institution_admin', 'active')`,
    [ids.secretariatA, ids.directorA, ids.adminA, ids.institutionA],
  );
  await pool.query(
    `INSERT INTO identities(person_id,provider,provider_subject) VALUES
      ($1,'firebase','decision-secretariat-a'),
      ($2,'firebase','decision-director-a'),
      ($3,'firebase','decision-admin-a'),
      ($4,'firebase','decision-director-b')`,
    [ids.secretariatA, ids.directorA, ids.adminA, foreignDirector],
  );
  await pool.query("INSERT INTO memberships(person_id,institution_id,role,status) VALUES($1,$2,'director','active')", [foreignDirector, ids.institutionB]);
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

  // The public contract is exercised through the real HTTP router over the
  // disposable PostgreSQL schema. It has no way to receive a decision/person
  // UUID from the browser.
  const app = express();
  app.use(express.json());
  const auth = createRequireAuth({ verifyIdToken: async (token) => ({ uid: token }), pool: pool as any, resolveInstitutionalContext });
  registerEnrollmentRoutes(app, { pool: pool as any, requireAuth: auth });
  server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as any).port;
  const request = (path: string, token: string, init: RequestInit = {}) => fetch(`http://127.0.0.1:${port}${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const assertPublic = (body: unknown) => assert.doesNotMatch(JSON.stringify(body).toLowerCase(), /candidatepersonid|person_id|personid|decision_id|decisionid|membership_id|membershipid|provider_subject/);
  assert.match(proposal.publicRef, /^[a-f0-9]{36}$/i, 'decisionRef must be a random public reference, not a UUID or Person handle.');
  assert.equal(proposal.publicRef.includes(ids.externalStudent), false, 'decisionRef cannot encode the candidate Person id.');
  const queue = await request('/api/enrollments/identity-decisions', 'decision-director-a');
  assert.equal(queue.status, 200); const queueBody = await queue.json(); assertPublic(queueBody);
  assert.equal((queueBody as any).decisions.some((row: any) => row.decisionRef === proposal.publicRef), true, 'authorized leadership must resolve the generated opaque decisionRef.');
  const secretariatQueue = await request('/api/enrollments/identity-decisions', 'decision-secretariat-a');
  assert.equal(secretariatQueue.status, 403, 'Secretariat must not access the decision queue.'); assertPublic(await secretariatQueue.json());
  const foreign = await request(`/api/enrollments/identity-decisions/${proposal.publicRef}`, 'decision-director-b');
  assert.equal(foreign.status, 404, 'a foreign institution must receive the same non-disclosing result as an unknown decisionRef.'); assertPublic(await foreign.json());
  const unknown = await request(`/api/enrollments/identity-decisions/${'f'.repeat(36)}`, 'decision-director-a');
  assert.equal(unknown.status, 404, 'random public decisionRef must be non-disclosing.'); assertPublic(await unknown.json());

  const outcome = await request(`/api/enrollments/identity-decisions/${proposal.publicRef}/outcome`, 'decision-director-a', { method: 'POST', body: JSON.stringify({ outcome: 'approve' }) });
  assert.equal(outcome.status, 200); const outcomeBody = await outcome.json(); assertPublic(outcomeBody); assert.equal((outcomeBody as any).decision.status, 'approved');
  const replayOutcome = await request(`/api/enrollments/identity-decisions/${proposal.publicRef}/outcome`, 'decision-director-a', { method: 'POST', body: JSON.stringify({ outcome: 'approve' }) });
  assert.equal(replayOutcome.status, 200, 'same terminal outcome must be idempotent.'); assertPublic(await replayOutcome.json());
  const moreInformation = await proposeIdentityDecision(pool, {
    institutionId: ids.institutionA, actorPersonId: ids.secretariatA, caseKey: `t5a-more-info-${randomUUID()}`,
    proposedAction: 'REUSE_PERSON', reasonCode: 'MATCH_CONFIRMED_WITH_NEW_EVIDENCE',
    proposedCandidatePersonId: ids.externalStudent, candidatePersonIds: [ids.externalStudent],
    matchReasons: ['name', 'birth_date'], evidenceTypes: ['civil_document_presented'],
  });
  const firstMore = await request(`/api/enrollments/identity-decisions/${moreInformation.publicRef}/outcome`, 'decision-director-a', { method: 'POST', body: JSON.stringify({ outcome: 'request_more_information' }) });
  assert.equal(firstMore.status, 200); const firstMoreBody = await firstMore.json() as any; assert.equal(firstMoreBody.decision.status, 'needs_more_information');
  const replayMore = await request(`/api/enrollments/identity-decisions/${moreInformation.publicRef}/outcome`, 'decision-director-a', { method: 'POST', body: JSON.stringify({ outcome: 'request_more_information' }) });
  assert.equal(replayMore.status, 200, 'repeating a server-confirmed request for more information must be idempotent.'); const replayMoreBody = await replayMore.json() as any;
  assert.equal(replayMoreBody.decision.version, firstMoreBody.decision.version, 'an idempotent replay must not increment the decision version.'); assertPublic(replayMoreBody);
  const rejectAfterMore = await request(`/api/enrollments/identity-decisions/${moreInformation.publicRef}/outcome`, 'decision-director-a', { method: 'POST', body: JSON.stringify({ outcome: 'reject' }) });
  assert.equal(rejectAfterMore.status, 200, 'requesting more information must not make a decision terminal or remove the later reject authority.'); assert.equal((await rejectAfterMore.json() as any).decision.status, 'rejected');

  const intake = await request('/api/enrollments/intake', 'decision-secretariat-a', { method: 'POST', headers: { 'Idempotency-Key': 't5a-approved-intake-001' }, body: JSON.stringify({ offerId: ids.offerA, student: restrictedInput, decisionRef: proposal.publicRef }) });
  assert.equal(intake.status, 201, 'approved public decisionRef must resume canonical intake.'); const intakeBody = await intake.json(); assertPublic(intakeBody);
  const intakeReplay = await request('/api/enrollments/intake', 'decision-secretariat-a', { method: 'POST', headers: { 'Idempotency-Key': 't5a-approved-intake-001' }, body: JSON.stringify({ offerId: ids.offerA, student: restrictedInput, decisionRef: proposal.publicRef }) });
  assert.equal(intakeReplay.status, 200, 'approved intake must replay without a second enrollment/person/student.'); assertPublic(await intakeReplay.json());

  const profile = await pool.query(
    `SELECT id FROM student_profiles WHERE institution_id = $1 AND person_id = $2`,
    [ids.institutionA, ids.externalStudent],
  );
  if (profile.rowCount !== 1) throw new Error('Approved reuse did not create exactly one institutional StudentProfile.');

  const counts = await pool.query<{ enrollment_count: string; person_count: string }>(
    `SELECT (SELECT count(*) FROM enrollment_applications)::text AS enrollment_count,
      (SELECT count(*) FROM people WHERE id = $1)::text AS person_count`, [ids.externalStudent],
  );
  if (Number(counts.rows[0].enrollment_count) !== 3) throw new Error('Expected exactly three enrollments in T6 integration proof.');
  if (counts.rows[0].person_count !== '1') throw new Error('Approved decision intake must not duplicate Person.');

  console.log('[T6-POSTGRES] PASS: direct cross-institution reuse without decision failed closed with PERSON_NOT_FOUND.');
  console.log('[T6-POSTGRES] PASS: D-06 name-only intake was blocked from automatic creation and completed only after independent approval.');
  console.log('[T6-POSTGRES] PASS: approved intake persisted across pool restart and replayed idempotently.');
  console.log('[T6-POSTGRES] PASS: local Person reused without duplicate.');
  console.log('[T6-POSTGRES] PASS: Escola B candidate remained restricted to Escola A until D-05 approval.');
  console.log('[T5A-POSTGRES-HTTP] PASS: opaque queue/read/outcome/intake boundary is tenant-safe, private, idempotent and canonical.');
} finally {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  await pool.end().catch(() => undefined);
  await bootstrapPool.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`).catch(() => undefined);
  await bootstrapPool.end();
}
