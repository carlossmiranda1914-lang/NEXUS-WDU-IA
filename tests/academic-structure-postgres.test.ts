import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';
import { createAcademicProgram, createAcademicLevel, retireAcademicProgram, AcademicStructureError } from '../src/modules/academic/academic-structure-api.ts';

const { connectionString } = readApprovedTestTarget(); const pool = new pg.Pool({ connectionString });
const a=randomUUID(), b=randomUUID(), actor=randomUUID(), year=randomUUID();
try {
 await pool.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Academic A','academic-a','active'),($2,'Academic B','academic-b','active')",[a,b]);
 await pool.query("INSERT INTO people(id,name,birth_date,phone,gender,nationality,province,municipality,address_line) VALUES($1,'Actor','1980-01-01','910000001','other','Angolana','Luanda','Luanda','Rua')",[actor]);
 await pool.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026','2026-01-01','2026-12-31','active')",[year,a]);
 const context={institutionId:a,personId:actor,membershipId:randomUUID(),role:'institution_admin' as const};
 const program=await createAcademicProgram(pool as any,context,{code:'GEN',name:'Geral'}); assert.equal(program.version,'1');
 const level=await createAcademicLevel(pool as any,context,{programId:program.id,code:'10',name:'10.º'}); assert.equal(level.programId,program.id);
 await assert.rejects(()=>createAcademicProgram(pool as any,context,{code:'GEN',name:'Duplicado'}),(e:unknown)=>e instanceof AcademicStructureError&&e.code==='CONFLICT');
 await assert.rejects(()=>createAcademicLevel(pool as any,{...context,institutionId:b},{programId:program.id,code:'10',name:'Externo'}),(e:unknown)=>e instanceof AcademicStructureError&&e.code==='NOT_FOUND');
 const retired=await retireAcademicProgram(pool as any,context,{id:program.id,expectedVersion:1}); assert.equal(retired.version,'2');
 await assert.rejects(()=>retireAcademicProgram(pool as any,context,{id:program.id,expectedVersion:1}),(e:unknown)=>e instanceof AcademicStructureError&&e.code==='CONFLICT');
 console.log('[ACADEMIC-01-STRUCTURE] program/level tenant authority: PASS.');
} finally { await pool.query('DELETE FROM institutions WHERE id=ANY($1)',[[a,b]]).catch(()=>undefined); await pool.end(); }
