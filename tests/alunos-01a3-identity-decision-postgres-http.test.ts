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
  secretariatOtherA: randomUUID(),
  directorA: randomUUID(),
  adminA: randomUUID(),
  localStudent: randomUUID(),
  reusableStudent: randomUUID(),
  nationalMatchStudent: randomUUID(),
  externalStudent: randomUUID(),
  yearA: randomUUID(),
  offerA: randomUUID(),
  offerB: randomUUID(),
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
      ($2, 'Secretaria B', NULL, NULL),
      ($3, 'Direção A', NULL, NULL),
      ($4, 'Admin A', NULL, NULL),
      ($5, 'Aluno Local', '2013-02-10', '+244923111111'),
      ($6, 'Aluno Reutilizável', '2014-02-10', '+244923333333'),
      ($7, 'Aluno Restrito', '2012-05-20', '+244923222222'),
      ($8, 'Aluno Correspondência Nacional', '2014-03-11', '+244923444444'),
      ($9, 'Direção B', NULL, NULL)`,
    [ids.secretariatA, ids.secretariatOtherA, ids.directorA, ids.adminA, ids.localStudent, ids.reusableStudent, ids.externalStudent, ids.nationalMatchStudent, foreignDirector],
  );
  await pool.query(
    `INSERT INTO memberships (person_id, institution_id, role, status) VALUES
      ($1, $5, 'secretariat', 'active'),
      ($2, $5, 'secretariat', 'active'),
      ($3, $5, 'director', 'active'),
      ($4, $5, 'institution_admin', 'active')`,
    [ids.secretariatA, ids.secretariatOtherA, ids.directorA, ids.adminA, ids.institutionA],
  );
  await pool.query(
    `INSERT INTO identities(person_id,provider,provider_subject) VALUES
      ($1,'firebase','decision-secretariat-a'),
      ($2,'firebase','decision-secretariat-other-a'),
      ($3,'firebase','decision-director-a'),
      ($4,'firebase','decision-admin-a'),
      ($5,'firebase','decision-director-b'),
      ($6,'firebase','decision-no-authority-a')`,
    [ids.secretariatA, ids.secretariatOtherA, ids.directorA, ids.adminA, foreignDirector, ids.localStudent],
  );
  await pool.query("INSERT INTO memberships(person_id,institution_id,role,status) VALUES($1,$2,'director','active')", [foreignDirector, ids.institutionB]);
  await pool.query(
    `INSERT INTO student_profiles (institution_id, person_id, student_number, status) VALUES
      ($1, $2, 'ALU-A-001', 'active'),
      ($1, $3, 'ALU-A-002', 'inactive'),
      ($1, $4, 'ALU-A-003', 'inactive'),
      ($5, $6, 'ALU-B-001', 'active')`,
    [ids.institutionA, ids.localStudent, ids.reusableStudent, ids.nationalMatchStudent, ids.institutionB, ids.externalStudent],
  );
  await pool.query('UPDATE people SET national_id_number = $1 WHERE id IN ($2, $3)', ['AO-1234567', ids.reusableStudent, ids.nationalMatchStudent]);
  await pool.query(
    `INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status)
     VALUES ($1, $2, '2026/2027', '2026-09-01', '2027-07-31', 'active')`,
    [ids.yearA, ids.institutionA],
  );
  await pool.query(
    `INSERT INTO enrollment_offers (id, institution_id, academic_year_id, name, code, status)
     VALUES ($1, $2, $3, 'Matrícula Geral', 'MAT-2026', 'active'),
            ($4, $2, $3, 'Matrícula Revisão', 'MAT-2026-R', 'active')`,
    [ids.offerA, ids.institutionA, ids.yearA, ids.offerB],
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
  const nationalInput = { name: 'Revisão de identidade nacional', nationalIdNumber: 'AO-1234567' };
  const nationalResolution = await resolveStudentForEnrollment(pool, secretariatContext, nationalInput);
  assert.equal(nationalResolution.status, 'MULTIPLE_MATCHES', 'Two local national-identifier matches must remain a server-owned review case.');
  assert.equal(nationalResolution.matchReasons.includes('national_id_number'), true, 'The canonical resolver must report its national-identifier match reason internally.');
  const nationalProposal = await proposeEnrollmentIdentityDecision(pool, secretariatContext, {
    offerId: ids.offerA, student: nationalInput, proposedAction: 'REVIEW_REQUIRED', evidenceTypes: ['civil_document_presented'],
  });
  const nationalReasons = await pool.query<{ match_reasons: string[] }>('SELECT match_reasons FROM identity_resolution_decisions WHERE id=$1', [nationalProposal.id]);
  assert.equal(nationalReasons.rows[0].match_reasons.includes('national_id_number'), true, 'The decision boundary must preserve every canonical resolver reason required for auditable review.');
  const nationalRead = await request(`/api/enrollments/identity-decisions/${nationalProposal.publicRef}`, 'decision-secretariat-a');
  assert.equal(nationalRead.status, 200, 'The requester must recover the opaque national-identifier review decision.');
  const nationalReadBody = await nationalRead.json();
  assertPublic(nationalReadBody);
  assert.doesNotMatch(JSON.stringify(nationalReadBody), /AO-1234567/, 'The public review DTO must never disclose the national identifier itself.');
  assert.match(proposal.publicRef, /^[a-f0-9]{36}$/i, 'decisionRef must be a random public reference, not a UUID or Person handle.');
  assert.equal(proposal.publicRef.includes(ids.externalStudent), false, 'decisionRef cannot encode the candidate Person id.');
  const queue = await request('/api/enrollments/identity-decisions', 'decision-director-a');
  assert.equal(queue.status, 200); const queueBody = await queue.json(); assertPublic(queueBody);
  assert.equal((queueBody as any).decisions.some((row: any) => row.decisionRef === proposal.publicRef), true, 'authorized leadership must resolve the generated opaque decisionRef.');
  const secretariatQueue = await request('/api/enrollments/identity-decisions', 'decision-secretariat-a');
  assert.equal(secretariatQueue.status, 200, 'Secretariat must recover only its own server-scoped identity decisions after reload.');
  const secretariatQueueBody = await secretariatQueue.json() as any;
  assert.equal(secretariatQueueBody.decisions.some((row: any) => row.decisionRef === proposal.publicRef), true, 'the requester must recover its opaque decision reference.');
  assertPublic(secretariatQueueBody);
  const requesterRead = await request(`/api/enrollments/identity-decisions/${proposal.publicRef}`, 'decision-secretariat-a');
  assert.equal(requesterRead.status, 200, 'the requester must recover its own opaque identity decision.'); assertPublic(await requesterRead.json());
  const otherSecretariatRead = await request(`/api/enrollments/identity-decisions/${proposal.publicRef}`, 'decision-secretariat-other-a');
  assert.equal(otherSecretariatRead.status, 403, 'another Secretariat operator must not read a decision it did not originate.'); assertPublic(await otherSecretariatRead.json());
  const foreign = await request(`/api/enrollments/identity-decisions/${proposal.publicRef}`, 'decision-director-b');
  assert.equal(foreign.status, 404, 'a foreign institution must receive the same non-disclosing result as an unknown decisionRef.'); assertPublic(await foreign.json());
  const foreignOfferProposal = await request('/api/enrollments/identity-decisions', 'decision-director-b', {
    method: 'POST', body: JSON.stringify({ offerId: ids.offerA, student: { name: 'Proposta Fora da Instituição' }, proposedAction: 'REVIEW_REQUIRED', evidenceTypes: ['manual_interview'] }),
  });
  assert.equal(foreignOfferProposal.status, 400, 'a browser offer from another institution cannot become an intake binding.'); assertPublic(await foreignOfferProposal.json());
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
    intakeBinding: { offerId: ids.offerB, student: restrictedInput },
  });
  const firstMore = await request(`/api/enrollments/identity-decisions/${moreInformation.publicRef}/outcome`, 'decision-director-a', { method: 'POST', body: JSON.stringify({ outcome: 'request_more_information' }) });
  assert.equal(firstMore.status, 200); const firstMoreBody = await firstMore.json() as any; assert.equal(firstMoreBody.decision.status, 'needs_more_information');
  const replayMore = await request(`/api/enrollments/identity-decisions/${moreInformation.publicRef}/outcome`, 'decision-director-a', { method: 'POST', body: JSON.stringify({ outcome: 'request_more_information' }) });
  assert.equal(replayMore.status, 200, 'repeating a server-confirmed request for more information must be idempotent.'); const replayMoreBody = await replayMore.json() as any;
  assert.equal(replayMoreBody.decision.version, firstMoreBody.decision.version, 'an idempotent replay must not increment the decision version.'); assertPublic(replayMoreBody);
  // T5B: evidence is submitted using only the opaque decisionRef and normalized
  // identity input. The server re-resolves; the restricted external match must
  // remain non-approvable and no revision can be duplicated by replay.
  const evidencePayload = { expectedVersion: replayMoreBody.decision.version, student: restrictedInput, evidenceTypes: ['civil_document_presented', 'birth_date_confirmation'] };
  const unauthorizedEvidence = await request(`/api/enrollments/identity-decisions/${moreInformation.publicRef}/evidence`, 'decision-no-authority-a', { method: 'POST', body: JSON.stringify(evidencePayload) });
  assert.equal(unauthorizedEvidence.status, 403, 'a person without active decision authority must receive 403.'); assertPublic(await unauthorizedEvidence.json());
  const otherSecretariatEvidence = await request(`/api/enrollments/identity-decisions/${moreInformation.publicRef}/evidence`, 'decision-secretariat-other-a', { method: 'POST', body: JSON.stringify(evidencePayload) });
  assert.equal(otherSecretariatEvidence.status, 403, 'a Secretariat operator must not revise another operator\'s identity decision.'); assertPublic(await otherSecretariatEvidence.json());
  const evidence = await request(`/api/enrollments/identity-decisions/${moreInformation.publicRef}/evidence`, 'decision-secretariat-a', { method: 'POST', body: JSON.stringify(evidencePayload) });
  assert.equal(evidence.status, 200, 'active Secretariat may submit allowlisted evidence.'); const evidenceBody = await evidence.json() as any; assertPublic(evidenceBody);
  assert.equal(evidenceBody.decision.status, 'needs_more_information', 'restricted re-resolution must remain review-required.');
  const evidenceReplay = await request(`/api/enrollments/identity-decisions/${moreInformation.publicRef}/evidence`, 'decision-secretariat-a', { method: 'POST', body: JSON.stringify(evidencePayload) });
  assert.equal(evidenceReplay.status, 200); assert.equal((await evidenceReplay.json() as any).decision.replayed, true, 'same evidence fingerprint must replay safely.');
  const revisionCount = await pool.query('SELECT count(*)::int AS count FROM identity_resolution_decision_revisions WHERE decision_id = $1', [moreInformation.id]);
  assert.equal(revisionCount.rows[0].count, 1, 'evidence replay must not append a duplicate revision.');
  const immutableInitial = await pool.query<{ evidence_types: string[] }>('SELECT evidence_types FROM identity_resolution_decisions WHERE id = $1', [moreInformation.id]);
  assert.deepEqual(immutableInitial.rows[0].evidence_types, ['civil_document_presented'], 'the initial decision evidence snapshot must remain immutable after a revision.');
  const staleEvidence = await request(`/api/enrollments/identity-decisions/${moreInformation.publicRef}/evidence`, 'decision-secretariat-a', { method: 'POST', body: JSON.stringify({ ...evidencePayload, evidenceTypes: ['manual_interview'] }) });
  assert.equal(staleEvidence.status, 409, 'a different stale submission must fail closed.');
  const foreignEvidence = await request(`/api/enrollments/identity-decisions/${moreInformation.publicRef}/evidence`, 'decision-director-b', { method: 'POST', body: JSON.stringify({ ...evidencePayload, expectedVersion: evidenceBody.decision.version }) });
  assert.equal(foreignEvidence.status, 404, 'foreign decisionRef evidence access must be non-disclosing.'); assertPublic(await foreignEvidence.json());
  const internalIdEvidence = await request(`/api/enrollments/identity-decisions/${moreInformation.publicRef}/evidence`, 'decision-secretariat-a', { method: 'POST', body: JSON.stringify({ ...evidencePayload, personId: ids.externalStudent }) });
  assert.equal(internalIdEvidence.status, 400, 'browser Person/decision IDs must be rejected.'); assertPublic(await internalIdEvidence.json());
  const rejectAfterMore = await request(`/api/enrollments/identity-decisions/${moreInformation.publicRef}/outcome`, 'decision-director-a', { method: 'POST', body: JSON.stringify({ outcome: 'reject' }) });
  assert.equal(rejectAfterMore.status, 200, 'requesting more information must not make a decision terminal or remove the later reject authority.'); assert.equal((await rejectAfterMore.json() as any).decision.status, 'rejected');

  // T5B complete paths: a review starts from an intentionally insufficient
  // intake, then only new evidence permits the server to derive the final
  // action. The browser never receives a candidate or chooses a Person.
  const createInitial = { name: 'Revisão Criar Pessoa', birthDate: null, phone: null };
  const createRevised = { name: 'Revisão Criar Pessoa', birthDate: '2014-04-03', phone: null };
  const createReview = await proposeEnrollmentIdentityDecision(pool, secretariatContext, {
    offerId: ids.offerA, student: createInitial, proposedAction: 'REVIEW_REQUIRED', evidenceTypes: ['manual_interview'],
  });
  assert.equal(createReview.status, 'needs_more_information');
  const createEvidence = await request(`/api/enrollments/identity-decisions/${createReview.publicRef}/evidence`, 'decision-secretariat-a', {
    method: 'POST', body: JSON.stringify({ expectedVersion: createReview.version, student: createRevised, evidenceTypes: ['civil_document_presented', 'birth_date_confirmation'] }),
  });
  assert.equal(createEvidence.status, 200, 'revised evidence with no reusable match must derive CREATE_PERSON.');
  const createEvidenceBody = await createEvidence.json() as any;
  assert.equal(createEvidenceBody.decision.proposedAction, 'CREATE_PERSON');
  assert.equal(createEvidenceBody.decision.status, 'pending_second_approval'); assertPublic(createEvidenceBody);
  const createApproved = await request(`/api/enrollments/identity-decisions/${createReview.publicRef}/outcome`, 'decision-admin-a', { method: 'POST', body: JSON.stringify({ outcome: 'approve' }) });
  assert.equal(createApproved.status, 200); assert.equal((await createApproved.json() as any).decision.status, 'approved');
  const foreignApprovedResume = await request(`/api/enrollments/identity-decisions/${createReview.publicRef}/intake`, 'decision-director-b', { method: 'POST', headers: { 'Idempotency-Key': 't5-create-foreign-resume' }, body: JSON.stringify({}) });
  assert.equal(foreignApprovedResume.status, 404, 'a foreign approved decisionRef must fail closed without disclosing its existence.'); assertPublic(await foreignApprovedResume.json());
  const otherSecretariatResume = await request(`/api/enrollments/identity-decisions/${createReview.publicRef}/intake`, 'decision-secretariat-other-a', { method: 'POST', headers: { 'Idempotency-Key': 't5-create-other-secretariat-resume' }, body: JSON.stringify({}) });
  assert.equal(otherSecretariatResume.status, 403, 'a Secretariat operator must not resume another operator\'s identity decision.'); assertPublic(await otherSecretariatResume.json());
  const wrongOffer = await request('/api/enrollments/intake', 'decision-secretariat-a', { method: 'POST', headers: { 'Idempotency-Key': 't5b-create-wrong-offer' }, body: JSON.stringify({ offerId: ids.offerB, student: createRevised, decisionRef: createReview.publicRef }) });
  assert.equal(wrongOffer.status, 409, 'a stale or browser-substituted offer must not redirect a revised decision.'); assertPublic(await wrongOffer.json());
  const staleStudent = await request('/api/enrollments/intake', 'decision-secretariat-a', { method: 'POST', headers: { 'Idempotency-Key': 't5b-create-stale-student' }, body: JSON.stringify({ offerId: ids.offerA, student: createInitial, decisionRef: createReview.publicRef }) });
  assert.equal(staleStudent.status, 409, 'the old case key must not be accepted after a server-side rebind.'); assertPublic(await staleStudent.json());
  const createIntake = await request(`/api/enrollments/identity-decisions/${createReview.publicRef}/intake`, 'decision-secretariat-a', { method: 'POST', headers: { 'Idempotency-Key': 't5b-create-approved' }, body: JSON.stringify({}) });
  assert.equal(createIntake.status, 201, 'approved CREATE_PERSON must resume intake from the server-owned decision binding.'); assertPublic(await createIntake.json());
  const createReplay = await request(`/api/enrollments/identity-decisions/${createReview.publicRef}/intake`, 'decision-secretariat-a', { method: 'POST', headers: { 'Idempotency-Key': 't5b-create-approved' }, body: JSON.stringify({}) });
  assert.equal(createReplay.status, 200, 'replaying approved CREATE_PERSON intake must be idempotent.'); assertPublic(await createReplay.json());
  const createdPerson = await pool.query<{ id: string }>(`SELECT id FROM people WHERE name = 'Revisão Criar Pessoa' AND birth_date = '2014-04-03'`);
  assert.equal(createdPerson.rowCount, 1, 'replayed CREATE_PERSON intake must create exactly one Person.');
  const createdOutcomeCounts = await pool.query<{ profiles: number; enrollments: number }>(
    `SELECT (SELECT count(*)::int FROM student_profiles WHERE institution_id = $1 AND person_id = $2) AS profiles,
            (SELECT count(*)::int FROM enrollment_applications WHERE institution_id = $1 AND student_person_id = $2) AS enrollments`,
    [ids.institutionA, createdPerson.rows[0].id],
  );
  assert.deepEqual(createdOutcomeCounts.rows[0], { profiles: 1, enrollments: 1 }, 'CREATE_PERSON handoff and replay must produce one Person, StudentProfile and Enrollment.');

  const reuseInitial = { name: 'Revisão Reutilizar', birthDate: null, phone: null };
  const reuseRevised = { name: 'Aluno Reutilizável', studentNumber: 'ALU-A-002', birthDate: '2014-02-10', phone: '+244923333333' };
  const reuseReview = await proposeEnrollmentIdentityDecision(pool, secretariatContext, {
    offerId: ids.offerB, student: reuseInitial, proposedAction: 'REVIEW_REQUIRED', evidenceTypes: ['manual_interview'],
  });
  const reuseEvidence = await request(`/api/enrollments/identity-decisions/${reuseReview.publicRef}/evidence`, 'decision-secretariat-a', {
    method: 'POST', body: JSON.stringify({ expectedVersion: reuseReview.version, student: reuseRevised, evidenceTypes: ['civil_document_presented', 'school_record'] }),
  });
  assert.equal(reuseEvidence.status, 200, 'revised local evidence must resolve only server-side.'); const reuseEvidenceBody = await reuseEvidence.json() as any;
  assert.equal(reuseEvidenceBody.decision.proposedAction, 'REUSE_PERSON'); assert.equal(reuseEvidenceBody.decision.status, 'pending_confirmation'); assertPublic(reuseEvidenceBody);
  const reuseApproved = await request(`/api/enrollments/identity-decisions/${reuseReview.publicRef}/outcome`, 'decision-director-a', { method: 'POST', body: JSON.stringify({ outcome: 'approve' }) });
  assert.equal(reuseApproved.status, 200); assert.equal((await reuseApproved.json() as any).decision.status, 'approved');
  const reuseIntake = await request(`/api/enrollments/identity-decisions/${reuseReview.publicRef}/intake`, 'decision-secretariat-a', { method: 'POST', headers: { 'Idempotency-Key': 't5b-reuse-approved' }, body: JSON.stringify({}) });
  assert.equal(reuseIntake.status, 201, 'approved REUSE_PERSON must resume canonical intake without browser identity or offer inputs.'); assertPublic(await reuseIntake.json());
  const reuseReplay = await request(`/api/enrollments/identity-decisions/${reuseReview.publicRef}/intake`, 'decision-secretariat-a', { method: 'POST', headers: { 'Idempotency-Key': 't5b-reuse-approved' }, body: JSON.stringify({}) });
  assert.equal(reuseReplay.status, 200, 'replaying approved REUSE_PERSON intake must be idempotent.'); assertPublic(await reuseReplay.json());
  const localProfileCount = await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM student_profiles WHERE institution_id = $1 AND person_id = $2', [ids.institutionA, ids.reusableStudent]);
  assert.equal(localProfileCount.rows[0].count, 1, 'REUSE_PERSON must not duplicate the existing StudentProfile.');
  const reuseEnrollmentCount = await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM enrollment_applications WHERE institution_id = $1 AND student_person_id = $2', [ids.institutionA, ids.reusableStudent]);
  assert.equal(reuseEnrollmentCount.rows[0].count, 1, 'REUSE_PERSON replay must not duplicate the Enrollment.');

  const nestedInternalEvidence = await request(`/api/enrollments/identity-decisions/${reuseReview.publicRef}/evidence`, 'decision-secretariat-a', { method: 'POST', body: JSON.stringify({ expectedVersion: reuseEvidenceBody.decision.version, student: { ...reuseRevised, personId: ids.reusableStudent }, evidenceTypes: ['school_record'] }) });
  assert.equal(nestedInternalEvidence.status, 400, 'nested browser Person IDs must be rejected.'); assertPublic(await nestedInternalEvidence.json());
  const browserCaseKey = await request(`/api/enrollments/identity-decisions/${reuseReview.publicRef}/evidence`, 'decision-secretariat-a', { method: 'POST', body: JSON.stringify({ expectedVersion: reuseEvidenceBody.decision.version, caseKey: 'browser-selected-case', student: reuseRevised, evidenceTypes: ['school_record'] }) });
  assert.equal(browserCaseKey.status, 400, 'the browser cannot provide a case key authority.'); assertPublic(await browserCaseKey.json());

  const legacy = await proposeIdentityDecision(pool, {
    institutionId: ids.institutionA, actorPersonId: ids.secretariatA, caseKey: `t5b-legacy-${randomUUID()}`,
    proposedAction: 'REVIEW_REQUIRED', reasonCode: 'INSUFFICIENT_EVIDENCE', matchReasons: [], evidenceTypes: ['manual_interview'],
  });
  const legacyEvidence = await request(`/api/enrollments/identity-decisions/${legacy.publicRef}/evidence`, 'decision-secretariat-a', { method: 'POST', body: JSON.stringify({ expectedVersion: legacy.version, student: createRevised, evidenceTypes: ['civil_document_presented'] }) });
  assert.equal(legacyEvidence.status, 400, 'legacy decisions lacking original server binding must fail closed.'); assertPublic(await legacyEvidence.json());

  const concurrentInitial = { name: 'Revisão Concorrente', birthDate: null, phone: null };
  const concurrent = await proposeEnrollmentIdentityDecision(pool, secretariatContext, { offerId: ids.offerB, student: concurrentInitial, proposedAction: 'REVIEW_REQUIRED', evidenceTypes: ['manual_interview'] });
  const concurrentRequest = (student: any, evidenceTypes: string[]) => request(`/api/enrollments/identity-decisions/${concurrent.publicRef}/evidence`, 'decision-secretariat-a', { method: 'POST', body: JSON.stringify({ expectedVersion: concurrent.version, student, evidenceTypes }) });
  const [concurrentOne, concurrentTwo] = await Promise.all([
    concurrentRequest({ name: 'Revisão Concorrente A', birthDate: '2014-05-01' }, ['civil_document_presented']),
    concurrentRequest({ name: 'Revisão Concorrente B', birthDate: '2014-05-02' }, ['school_record']),
  ]);
  assert.deepEqual([concurrentOne.status, concurrentTwo.status].sort(), [200, 409], 'competing versions must permit one append and fail the stale submission closed.');
  const concurrentRevisionCount = await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM identity_resolution_decision_revisions WHERE decision_id = (SELECT id FROM identity_resolution_decisions WHERE public_ref = $1)', [concurrent.publicRef]);
  assert.equal(concurrentRevisionCount.rows[0].count, 1, 'concurrent submissions must not append two revisions.');

  const collisionOne = await proposeEnrollmentIdentityDecision(pool, secretariatContext, { offerId: ids.offerA, student: { name: 'Colisão Inicial Um' }, proposedAction: 'REVIEW_REQUIRED', evidenceTypes: ['manual_interview'] });
  const collisionTwo = await proposeEnrollmentIdentityDecision(pool, secretariatContext, { offerId: ids.offerA, student: { name: 'Colisão Inicial Dois' }, proposedAction: 'REVIEW_REQUIRED', evidenceTypes: ['manual_interview'] });
  const collisionEvidence = { student: { name: 'Colisão Normalizada', birthDate: '2014-06-01' }, evidenceTypes: ['civil_document_presented'] };
  const collisionFirst = await request(`/api/enrollments/identity-decisions/${collisionOne.publicRef}/evidence`, 'decision-secretariat-a', { method: 'POST', body: JSON.stringify({ expectedVersion: collisionOne.version, ...collisionEvidence }) });
  assert.equal(collisionFirst.status, 200);
  const collisionSecond = await request(`/api/enrollments/identity-decisions/${collisionTwo.publicRef}/evidence`, 'decision-secretariat-a', { method: 'POST', body: JSON.stringify({ expectedVersion: collisionTwo.version, ...collisionEvidence }) });
  assert.equal(collisionSecond.status, 409, 'a derived case-key collision must fail closed rather than raise a database error.'); assertPublic(await collisionSecond.json());
  const collisionSecondRevisions = await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM identity_resolution_decision_revisions WHERE decision_id = (SELECT id FROM identity_resolution_decisions WHERE public_ref = $1)', [collisionTwo.publicRef]);
  assert.equal(collisionSecondRevisions.rows[0].count, 0, 'a failed derived case-key collision must not append a partial revision.');

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
  if (Number(counts.rows[0].enrollment_count) !== 5) throw new Error('Expected exactly five enrollments after the T5B CREATE and REUSE approved handoffs.');
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
