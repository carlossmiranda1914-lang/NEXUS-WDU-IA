import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readdir, readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';
import { resolveInstitutionalContext } from '../src/auth/institutional-context.ts';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { configureEnrollmentDocumentRequirements } from '../src/modules/enrollments/enrollment-document-requirements-api.ts';
import { registerEnrollmentDocumentRoutes } from '../src/modules/enrollments/enrollment-document.controller.ts';
import { transitionEnrollmentDocument } from '../src/modules/enrollments/enrollment-document-api.ts';
import { documentValidationGate } from '../src/modules/enrollments/enrollment-document-requirement-policy.ts';
import { projectEnrollmentProcess } from '../src/modules/enrollments/enrollment-process-policy.ts';

const { connectionString } = readApprovedTestTarget();
const schema = `nexus_alunos_docs_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const setup = new pg.Pool({ connectionString });
let service: pg.Pool | undefined;
let server: http.Server | undefined;
let assertions = 0;
const expect: (condition: unknown, message: string) => asserts condition = (condition, message) => { assertions += 1; assert.ok(condition, message); };
const noLeak = (value: unknown) => assert.doesNotMatch(JSON.stringify(value).toLowerCase(), /person_id|student_profile_id|membership_id|provider_subject|select |stack|postgres/);

try {
  await setup.query(`CREATE SCHEMA "${schema}"`);
  const migrations = (await readdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations'))).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
  for (const migration of migrations) await setup.query(`SET search_path TO "${schema}"; ${await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations', migration), 'utf8')}`);
  service = new pg.Pool({ connectionString, options: `-c search_path=${schema}`, max: 5 });

  const [institutionA, institutionB, directorA, directorB, secretariatA, studentA, studentB, yearA, offerA, enrollmentA, enrollmentB, membershipA, membershipB, membershipSecretariat] = Array.from({ length: 14 }, randomUUID);
  await service.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Documentos A','documentos-a','active'),($2,'Documentos B','documentos-b','active')", [institutionA, institutionB]);
  await service.query("INSERT INTO people(id,name) VALUES($1,'Direção A'),($2,'Direção B'),($3,'Secretaria A'),($4,'Aluno A'),($5,'Aluno B')", [directorA, directorB, secretariatA, studentA, studentB]);
  await service.query("INSERT INTO identities(person_id,provider,provider_subject) VALUES($1,'firebase','docs-director-a'),($2,'firebase','docs-director-b'),($3,'firebase','docs-secretariat-a')", [directorA, directorB, secretariatA]);
  await service.query("INSERT INTO memberships(id,person_id,institution_id,role,status,approved_at) VALUES($1,$2,$3,'director','active',now()),($4,$5,$6,'director','active',now()),($7,$8,$3,'secretariat','active',now())", [membershipA, directorA, institutionA, membershipB, directorB, institutionB, membershipSecretariat, secretariatA]);
  await service.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026/2027','2026-01-01','2026-12-31','active')", [yearA, institutionA]);
  await service.query("INSERT INTO enrollment_offers(id,institution_id,academic_year_id,name,code,status) VALUES($1,$2,$3,'Ensino Geral','DOC-A','active')", [offerA, institutionA, yearA]);
  await service.query("INSERT INTO enrollment_applications(id,institution_id,student_person_id,academic_year_id,offer_id,status,created_by,updated_by) VALUES($1,$2,$3,$4,$5,'under_review',$6,$6),($7,$2,$8,$4,$5,'under_review',$6,$6)", [enrollmentA, institutionA, studentA, yearA, offerA, directorA, enrollmentB, studentB]);

  const adminContext = { personId: directorA, personName: 'Direção A', identityEmail: null, membershipId: membershipA, institutionId: institutionA, institutionName: 'Documentos A', institutionSlug: 'documentos-a', role: 'director' as const };
  const secretariatContext = { personId: secretariatA, personName: 'Secretaria A', identityEmail: null, membershipId: membershipSecretariat, institutionId: institutionA, institutionName: 'Documentos A', institutionSlug: 'documentos-a', role: 'secretariat' as const };

  const configured = await configureEnrollmentDocumentRequirements(service as any, adminContext, { enrollmentId: enrollmentA, requirements: ['Bilhete de identidade', 'Declaração escolar'] });
  expect(configured.replayed === false && configured.requirementsCaptured === 2, 'An authorized director must configure and materialize exactly two canonical requirements.');
  noLeak(configured);
  const materialized = await service.query<{document_type: string; required: boolean; status: string; source_requirement_id: string | null}>("SELECT document_type,required,status,source_requirement_id FROM enrollment_documents WHERE enrollment_application_id=$1 ORDER BY document_type", [enrollmentA]);
  expect(materialized.rows.length === 2 && materialized.rows.every((row) => row.required && row.status === 'pending' && row.source_requirement_id), 'Configuration must materialize one pending requirement snapshot per enrollment.');
  const replay = await configureEnrollmentDocumentRequirements(service as any, adminContext, { enrollmentId: enrollmentA, requirements: ['Declaração escolar', 'Bilhete de identidade'] });
  expect(replay.replayed === true && replay.requirementsCaptured === 2, 'Equivalent repeated configuration must replay without duplicate documents or policies.');
  const unchanged = await service.query<{count: string}>("SELECT count(*)::text AS count FROM enrollment_documents WHERE enrollment_application_id=$1", [enrollmentA]);
  expect(unchanged.rows[0].count === '2', 'Idempotent replay must not duplicate the enrollment snapshot.');
  let secretariatDenied = false;
  try { await configureEnrollmentDocumentRequirements(service as any, secretariatContext, { enrollmentId: enrollmentB, requirements: ['BI'] }); } catch (error: any) { secretariatDenied = error?.code === 'FORBIDDEN'; }
  expect(secretariatDenied, 'Secretariat must not configure an institutional document policy.');
  const historical = await service.query<{document_policy_id: string | null; count: string}>("SELECT e.document_policy_id,(SELECT count(*)::text FROM enrollment_documents d WHERE d.enrollment_application_id=e.id) AS count FROM enrollment_applications e WHERE e.id=$1", [enrollmentA]);
  expect(historical.rows[0].document_policy_id !== null && historical.rows[0].count === '2', 'A captured enrollment must retain its original snapshot.');

  await transitionEnrollmentDocument(service as any, secretariatContext, { enrollmentId: enrollmentA, documentId: (await service.query<{id: string}>("SELECT id FROM enrollment_documents WHERE enrollment_application_id=$1 ORDER BY document_type LIMIT 1", [enrollmentA])).rows[0].id, toStatus: 'submitted', evidenceReference: 'Protocolo DOC-001' });
  const allDocumentIds = await service.query<{id:string}>("SELECT id FROM enrollment_documents WHERE enrollment_application_id=$1 ORDER BY document_type", [enrollmentA]);
  const rejected = await transitionEnrollmentDocument(service as any, secretariatContext, { enrollmentId: enrollmentA, documentId: allDocumentIds.rows[0].id, toStatus: 'rejected' });
  expect(rejected.status === 'rejected', 'A submitted requirement must retain the canonical rejected truth before resubmission.');
  await transitionEnrollmentDocument(service as any, secretariatContext, { enrollmentId: enrollmentA, documentId: allDocumentIds.rows[0].id, toStatus: 'submitted', evidenceReference: 'Protocolo DOC-001-R' });
  await transitionEnrollmentDocument(service as any, secretariatContext, { enrollmentId: enrollmentA, documentId: allDocumentIds.rows[0].id, toStatus: 'verified' });
  await transitionEnrollmentDocument(service as any, secretariatContext, { enrollmentId: enrollmentA, documentId: allDocumentIds.rows[1].id, toStatus: 'submitted', evidenceReference: 'Protocolo DOC-002' });
  await transitionEnrollmentDocument(service as any, secretariatContext, { enrollmentId: enrollmentA, documentId: allDocumentIds.rows[1].id, toStatus: 'verified' });
  const gateRows = await service.query<{document_type:string;required:boolean;status:'pending'|'submitted'|'verified'|'rejected';source_requirement_id:string|null}>("SELECT document_type,required,status,source_requirement_id FROM enrollment_documents WHERE enrollment_application_id=$1", [enrollmentA]);
  expect(documentValidationGate(true, gateRows.rows.map((row) => ({ documentType: row.document_type, required: row.required, status: row.status, sourceRequirementId: row.source_requirement_id }))).ready, 'The canonical document gate must advance only after all materialized required documents are verified.');
  const process = projectEnrollmentProcess({ enrollmentStatus: 'under_review', registrationReady: true, registrationMissing: [], academicContextValid: true, policyCaptured: true, documents: gateRows.rows.map((row) => ({ documentType: row.document_type, required: row.required, status: row.status, sourceRequirementId: row.source_requirement_id })) }, 'director');
  expect(process.stages.find((stage) => stage.key === 'P04')?.status === 'completed', 'The process projection must mark the document stage complete only from verified snapshot truth.');

  const app = express(); app.use(express.json());
  const auth = createRequireAuth({ verifyIdToken: async (token) => ({ uid: token }), pool: service as any, resolveInstitutionalContext });
  registerEnrollmentDocumentRoutes(app, { pool: service as any, requireAuth: auth });
  server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address() as any;
  const url = `http://127.0.0.1:${address.port}/api/enrollments/${enrollmentB}/document-requirements`;
  const noAuth = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirements: ['BI'] }) });
  expect(noAuth.status === 401, 'Unauthenticated configuration must fail closed.');
  const forbidden = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer docs-secretariat-a', 'Content-Type': 'application/json' }, body: JSON.stringify({ requirements: ['BI'] }) });
  expect(forbidden.status === 403, 'Unauthorized role must not configure requirements over HTTP.'); noLeak(await forbidden.json());
  const foreign = await fetch(`http://127.0.0.1:${address.port}/api/enrollments/${enrollmentB}/document-requirements`, { method: 'POST', headers: { Authorization: 'Bearer docs-director-b', 'Content-Type': 'application/json' }, body: JSON.stringify({ requirements: ['BI'] }) });
  expect(foreign.status === 404, 'Foreign institution configuration must be non-disclosing.'); noLeak(await foreign.json());
  const httpConfigured = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer docs-director-a', 'Content-Type': 'application/json' }, body: JSON.stringify({ requirements: ['BI'] }) });
  expect(httpConfigured.status === 201, 'Authorized HTTP configuration must materialize the selected enrollment.');
  const configuredBody = await httpConfigured.json();
  expect(Object.keys(configuredBody).length === 1 && Object.keys(configuredBody.configuration ?? {}).sort().join(',') === 'replayed,requirementsCaptured', 'Configuration success must expose only the public replay and captured-count contract.');
  noLeak(configuredBody);
  const preservedSnapshot = await service.query<{document_type: string; count: string}>("SELECT document_type, count(*) OVER ()::text AS count FROM enrollment_documents WHERE enrollment_application_id=$1 ORDER BY document_type", [enrollmentA]);
  expect(preservedSnapshot.rows.length === 2 && preservedSnapshot.rows[0].count === '2', 'A newer offer policy must not rewrite the already captured enrollment snapshot.');
  console.log(`[ALUNOS-01A-DOCUMENTS] PostgreSQL + HTTP configuration/materialization: PASS (${assertions} assertions).`);
} finally {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (service) await service.end();
  await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
  await setup.end();
}
