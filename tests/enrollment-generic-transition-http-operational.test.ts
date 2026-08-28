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
import { registerEnrollmentRoutes } from '../src/modules/enrollments/enrollment.controller.ts';

const { connectionString } = readApprovedTestTarget();
const schema = `nexus_generic_http_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const setup = new pg.Pool({ connectionString }); let service: pg.Pool | undefined; let server: http.Server | undefined; let productionServer: http.Server | undefined;
const noLeak = (body: unknown) => assert.doesNotMatch(JSON.stringify(body).toLowerCase(), /select |stack|postgres|person_id|identity|9000000|aluno generic|activation_commands/);

try {
  // The default mount remains protected by the canonical production middleware.
  const productionApp = express(); productionApp.use(express.json()); registerEnrollmentRoutes(productionApp);
  productionServer = http.createServer(productionApp); productionServer.listen(0, '127.0.0.1'); await once(productionServer, 'listening'); const productionAddress = productionServer.address() as any;
  const productionAuth = await fetch(`http://127.0.0.1:${productionAddress.port}/api/enrollments/${randomUUID()}/transitions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toStatus: 'under_review' }) }); assert.equal(productionAuth.status, 401);
  await setup.query(`CREATE SCHEMA "${schema}"`);
  const client = await setup.connect(); try { for (const file of (await readdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations'))).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()) await client.query(`SET search_path TO "${schema}"; ${await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations', file), 'utf8')}`); } finally { client.release(); }
  service = new pg.Pool({ connectionString, options: `-c search_path=${schema}` });
  const [institution, actor, student, guardian, validatedStudent, validatedGuardian, year, offer, policy, requirement, draft, validated, membership] = Array.from({ length: 13 }, randomUUID);
  await service.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Generic HTTP','generic-http','active')", [institution]);
  await service.query("INSERT INTO people(id,name,birth_date,phone,gender,nationality,province,municipality,address_line) VALUES($1,'Director Generic','1980-01-01','901000001','other','Angolana','Luanda','Luanda','Rua A'),($2,'Aluno Generic','2012-01-01','901000002','other','Angolana','Luanda','Luanda','Rua B'),($3,'Guardião Generic','1970-01-01','901000003','other','Angolana','Luanda','Luanda','Rua C'),($4,'Aluno Validado','2013-01-01','901000004','other','Angolana','Luanda','Luanda','Rua D'),($5,'Guardião Validado','1971-01-01','901000005','other','Angolana','Luanda','Luanda','Rua E')", [actor, student, guardian, validatedStudent, validatedGuardian]);
  await service.query("INSERT INTO identities(person_id,provider,provider_subject) VALUES($1,'firebase','generic-director')", [actor]);
  await service.query("INSERT INTO memberships(id,person_id,institution_id,role,status,approved_at) VALUES($1,$2,$3,'director','active',now())", [membership, actor, institution]);
  await service.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026','2026-01-01','2026-12-31','active')", [year,institution]); await service.query("INSERT INTO enrollment_offers(id,institution_id,academic_year_id,name,code,status) VALUES($1,$2,$3,'A','A','active')", [offer,institution,year]);
  await service.query("INSERT INTO enrollment_document_policies(id,institution_id,offer_id,version,status,created_by) VALUES($1,$2,$3,1,'active',$4)", [policy,institution,offer,actor]); await service.query("INSERT INTO enrollment_document_requirements(id,institution_id,policy_id,document_type,required,sort_order) VALUES($1,$2,$3,'ID',true,1)",[requirement,institution,policy]);
  await service.query("INSERT INTO student_profiles(institution_id,person_id,status) VALUES($1,$2,'inactive'),($1,$3,'inactive')",[institution,student,validatedStudent]); await service.query("INSERT INTO guardian_relationships(institution_id,guardian_person_id,student_person_id,relationship,status,is_primary) VALUES($1,$2,$3,'Mãe','active',true),($1,$4,$5,'Mãe','active',true)",[institution,guardian,student,validatedGuardian,validatedStudent]);
  await service.query("INSERT INTO enrollment_applications(id,institution_id,student_person_id,guardian_person_id,academic_year_id,offer_id,status,document_policy_id,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,'draft',$7,$8,$8),($9,$2,$10,$11,$5,$6,'validated',$7,$8,$8)",[draft,institution,student,guardian,year,offer,policy,actor,validated,validatedStudent,validatedGuardian]);
  const app=express(); app.use(express.json()); const auth=createRequireAuth({verifyIdToken:async token=>({uid:token}),pool:service as any,resolveInstitutionalContext}); registerEnrollmentRoutes(app,{pool:service as any,requireAuth:auth}); server=http.createServer(app); server.listen(0,'127.0.0.1'); await once(server,'listening'); const addr=server.address() as any; const request=(id:string,toStatus:string)=>fetch(`http://127.0.0.1:${addr.port}/api/enrollments/${id}/transitions`,{method:'POST',headers:{Authorization:'Bearer generic-director','Content-Type':'application/json'},body:JSON.stringify({toStatus})});
  // Characterises that this exact production router uses the injected disposable pool.
  const ordinary=await request(draft,'under_review'); assert.equal(ordinary.status,200); assert.equal((await ordinary.json() as any).enrollment.status,'under_review');
  const blocked=await request(validated,'active'); assert.equal(blocked.status,409); const blockedBody=await blocked.json(); assert.equal((blockedBody as any).code,'ACTIVE_REQUIRES_CANONICAL_ACTIVATION'); noLeak(blockedBody);
  const state=await service.query<{status:string;profile:string;events:string;ledger:string}>("SELECT e.status,sp.status profile,(SELECT count(*)::text FROM enrollment_events WHERE enrollment_application_id=e.id AND event_type='enrollment_activated') events,(SELECT count(*)::text FROM enrollment_activation_commands WHERE enrollment_application_id=e.id) ledger FROM enrollment_applications e JOIN student_profiles sp ON sp.institution_id=e.institution_id AND sp.person_id=e.student_person_id WHERE e.id=$1",[validated]); assert.deepEqual(state.rows[0],{status:'validated',profile:'inactive',events:'0',ledger:'0'});
  console.log('[ENROLLMENT-02-GENERIC-HTTP] injected production router and active fence: PASS.');
} finally { if(server) await new Promise<void>(r=>server!.close(()=>r())); if(productionServer) await new Promise<void>(r=>productionServer!.close(()=>r())); if(service) await service.end(); await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(()=>undefined); await setup.end(); }
