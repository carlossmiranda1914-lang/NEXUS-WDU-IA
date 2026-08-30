import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';
import { AcademicStructureError, createAcademicClass, createAcademicSubject, offerAcademicSubject, closeAcademicClass } from '../src/modules/academic/academic-structure-api.ts';

const { connectionString } = readApprovedTestTarget(); const pool = new pg.Pool({ connectionString });
const a=randomUUID(), b=randomUUID(), actor=randomUUID(), year=randomUUID(), program=randomUUID(), level=randomUUID(), suffix=randomUUID().slice(0,8), auditTrigger=`reject_academic_audit_${randomUUID().replaceAll('-','')}`;
const context={institutionId:a,personId:actor,membershipId:randomUUID(),role:'institution_admin' as const,personName:'Academic actor',identityEmail:null,institutionName:`Class A ${suffix}`,institutionSlug:`class-a-${suffix}`};
try {
 await pool.query('DROP TRIGGER IF EXISTS reject_academic_audit ON academic_events; DROP FUNCTION IF EXISTS reject_academic_audit()');
 await pool.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,$2,$3,'active'),($4,$5,$6,'active')",[a,`Class A ${suffix}`,`class-a-${suffix}`,b,`Class B ${suffix}`,`class-b-${suffix}`]);
 await pool.query("INSERT INTO people(id,name,birth_date,phone,gender,nationality,province,municipality,address_line) VALUES($1,'Academic actor','1980-01-01','910000001','other','Angolana','Luanda','Luanda','Rua')",[actor]);
 await pool.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026','2026-01-01','2026-12-31','active')",[year,a]);
 await pool.query("INSERT INTO academic_programs(id,institution_id,code,name) VALUES($1,$2,'GEN','Geral')",[program,a]);
 await pool.query("INSERT INTO academic_levels(id,institution_id,program_id,code,name) VALUES($1,$2,$3,'10','10.º')",[level,a,program]);
 const klass=await createAcademicClass(pool as any,context,{academicYearId:year,programId:program,levelId:level,code:'10A'}); assert.equal(klass.version,'1'); assert.equal(klass.status,'planned');
 const subject=await createAcademicSubject(pool as any,context,{code:'MAT',name:'Matemática'}); assert.equal(subject.version,'1');
 const offering=await offerAcademicSubject(pool as any,context,{academicYearId:year,classId:klass.id,subjectId:subject.id}); assert.equal(offering.status,'active');
 await assert.rejects(()=>createAcademicClass(pool as any,context,{academicYearId:year,programId:program,levelId:level,code:'10A'}),(e:unknown)=>e instanceof AcademicStructureError&&e.code==='CONFLICT');
 await assert.rejects(()=>offerAcademicSubject(pool as any,{...context,institutionId:b,institutionName:'B',institutionSlug:`class-b-${suffix}`},{academicYearId:year,classId:klass.id,subjectId:subject.id}),(e:unknown)=>e instanceof AcademicStructureError&&e.code==='NOT_FOUND');
 const closed=await closeAcademicClass(pool as any,context,{id:klass.id,expectedVersion:1}); assert.equal(closed.version,'2');
 await assert.rejects(()=>closeAcademicClass(pool as any,context,{id:klass.id,expectedVersion:1}),(e:unknown)=>e instanceof AcademicStructureError&&e.code==='STALE_VERSION');
 const history=await pool.query<{status:string;version:string}>('SELECT status,version FROM academic_classes WHERE id=$1 AND institution_id=$2',[klass.id,a]); assert.deepEqual(history.rows[0],{status:'closed',version:'2'});
 const audit=await pool.query<{metadata:unknown}>("SELECT metadata FROM academic_events WHERE institution_id=$1 ORDER BY created_at",[a]); assert.equal(audit.rows.length,4); assert.deepEqual(audit.rows[0].metadata,{});
 await pool.query(`CREATE FUNCTION ${auditTrigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit failure injection'; END $$; CREATE TRIGGER ${auditTrigger} BEFORE INSERT ON academic_events FOR EACH ROW EXECUTE FUNCTION ${auditTrigger}()`);
 await assert.rejects(()=>createAcademicClass(pool as any,context,{academicYearId:year,programId:program,levelId:level,code:'ROLLBACK'}),(e:unknown)=>e instanceof AcademicStructureError&&e.code==='CONFLICT');
 const rollback=await pool.query<{classes:string;events:string}>("SELECT (SELECT count(*)::text FROM academic_classes WHERE institution_id=$1 AND code='ROLLBACK') classes,(SELECT count(*)::text FROM academic_events WHERE institution_id=$1 AND operation='created') events",[a]); assert.deepEqual(rollback.rows[0],{classes:'0',events:'3'});
 console.log('[ACADEMIC-01-CLASS-SUBJECT] temporal tenant authority: PASS.');
} finally { await pool.query(`DROP TRIGGER IF EXISTS ${auditTrigger} ON academic_events; DROP FUNCTION IF EXISTS ${auditTrigger}()`).catch(()=>undefined); await pool.query('DELETE FROM institutions WHERE id=ANY($1)',[[a,b]]).catch(()=>undefined); await pool.end(); }
