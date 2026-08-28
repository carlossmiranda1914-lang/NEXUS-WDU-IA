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
import { registerEnrollmentActivationRoutes } from '../src/modules/enrollments/enrollment-activation.controller.ts';

const { connectionString } = readApprovedTestTarget();
const schema = `nexus_activation_http_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const setup = new pg.Pool({ connectionString }); let service: pg.Pool | undefined; let server: http.Server | undefined;
const noLeak = (body: unknown) => assert.doesNotMatch(JSON.stringify(body).toLowerCase(), /select |stack|postgres|person_id|identity|9000000|aluno http|activation_commands/);

try {
  await setup.query(`CREATE SCHEMA "${schema}"`);
  const client = await setup.connect(); try { for (const file of (await readdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations'))).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()) await client.query(`SET search_path TO "${schema}"; ${await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations', file), 'utf8')}`); } finally { client.release(); }
  service = new pg.Pool({ connectionString, options: `-c search_path=${schema}` });
  const [institution, actor, student, guardian, year, offer, policy, requirement, enrollment, membership] = Array.from({ length: 10 }, randomUUID);
  await service.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'HTTP','http','active')", [institution]);
  await service.query("INSERT INTO people(id,name,birth_date,phone,gender,nationality,province,municipality,address_line) VALUES($1,'Director HTTP','1980-01-01','900000001','other','Angolana','Luanda','Luanda','Rua A'),($2,'Aluno HTTP','2012-01-01','900000002','other','Angolana','Luanda','Luanda','Rua B'),($3,'Guardião HTTP','1970-01-01','900000003','other','Angolana','Luanda','Luanda','Rua C')", [actor, student, guardian]);
  await service.query("INSERT INTO identities(person_id,provider,provider_subject) VALUES($1,'firebase','activation-director')", [actor]);
  await service.query("INSERT INTO memberships(id,person_id,institution_id,role,status,approved_at) VALUES($1,$2,$3,'director','active',now())", [membership, actor, institution]);
  await service.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026','2026-01-01','2026-12-31','active')", [year,institution]); await service.query("INSERT INTO enrollment_offers(id,institution_id,academic_year_id,name,code,status) VALUES($1,$2,$3,'A','A','active')", [offer,institution,year]);
  await service.query("INSERT INTO enrollment_document_policies(id,institution_id,offer_id,version,status,created_by) VALUES($1,$2,$3,1,'active',$4)", [policy,institution,offer,actor]); await service.query("INSERT INTO enrollment_document_requirements(id,institution_id,policy_id,document_type,required,sort_order) VALUES($1,$2,$3,'ID',true,1)",[requirement,institution,policy]);
  await service.query("INSERT INTO student_profiles(institution_id,person_id,status) VALUES($1,$2,'inactive')",[institution,student]); await service.query("INSERT INTO guardian_relationships(institution_id,guardian_person_id,student_person_id,relationship,status,is_primary) VALUES($1,$2,$3,'Mãe','active',true)",[institution,guardian,student]);
  await service.query("INSERT INTO enrollment_applications(id,institution_id,student_person_id,guardian_person_id,academic_year_id,offer_id,status,document_policy_id,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,'validated',$7,$8,$8)",[enrollment,institution,student,guardian,year,offer,policy,actor]); await service.query("INSERT INTO enrollment_documents(institution_id,enrollment_application_id,document_type,required,status,source_requirement_id,verified_by) VALUES($1,$2,'ID',true,'verified',$3,$4)",[institution,enrollment,requirement,actor]);
  const app=express(); app.use(express.json()); const auth=createRequireAuth({verifyIdToken:async token=>({uid:token}),pool:service as any,resolveInstitutionalContext}); registerEnrollmentActivationRoutes(app,{pool:service as any,requireAuth:auth}); server=http.createServer(app); server.listen(0,'127.0.0.1'); await once(server,'listening'); const addr=server.address() as any; const url=`http://127.0.0.1:${addr.port}/api/enrollments/${enrollment}/activate`;
  const send=(body: unknown,key='activation-http-001')=>fetch(url,{method:'POST',headers:{Authorization:'Bearer activation-director','Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});
  const first=await send({expectedLifecycleVersion:'1',expectedRegistrationVersion:'1'}); assert.equal(first.status,201); const firstBody=await first.json(); noLeak(firstBody);
  const state=await service.query<{status:string;profile:string;events:string;ledger:string}>("SELECT e.status,sp.status profile,(SELECT count(*)::text FROM enrollment_events WHERE enrollment_application_id=e.id AND event_type='enrollment_activated') events,(SELECT count(*)::text FROM enrollment_activation_commands WHERE enrollment_application_id=e.id) ledger FROM enrollment_applications e JOIN student_profiles sp ON sp.institution_id=e.institution_id AND sp.person_id=e.student_person_id WHERE e.id=$1",[enrollment]); assert.deepEqual(state.rows[0],{status:'active',profile:'active',events:'1',ledger:'1'});
  const replay=await send({expectedLifecycleVersion:'1',expectedRegistrationVersion:'1'}); assert.equal(replay.status,200); assert.equal((await replay.json() as any).activation.replayed,true);
  const stale=await send({expectedLifecycleVersion:'1',expectedRegistrationVersion:'1'},'activation-http-stale'); assert.equal(stale.status,409); const staleBody=await stale.json(); assert.equal((staleBody as any).code,'STALE_VERSION'); noLeak(staleBody);
  console.log('[ENROLLMENT-02-HTTP] auth/context/controller/activation/postgres: PASS.');
} finally { if(server) await new Promise<void>(r=>server!.close(()=>r())); if(service) await service.end(); await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(()=>undefined); await setup.end(); }
