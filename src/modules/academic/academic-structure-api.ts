import type { InstitutionalContext } from '../../auth/institutional-context.ts';

type Pool = { query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> };
export class AcademicStructureError extends Error { constructor(public readonly code: 'INVALID_INPUT'|'CONFLICT'|'NOT_FOUND'|'STALE_VERSION', message: string) { super(message); } }
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim()&&v.trim().length<=max?v.trim():null;
async function recordAcademicEvent(pool:Pool,context:InstitutionalContext,aggregateType:string,aggregateId:string,operation:string) {
 await pool.query("INSERT INTO academic_events(institution_id,aggregate_type,aggregate_id,actor_kind,actor_person_id,operation,metadata) VALUES($1,$2,$3,'human',$4,$5,'{}'::jsonb)",[context.institutionId,aggregateType,aggregateId,context.personId,operation]);
}
export async function createAcademicProgram(pool:Pool, context:InstitutionalContext,input:{code:unknown;name:unknown}) {
 const code=text(input.code,40),name=text(input.name,160); if(!code||!name) throw new AcademicStructureError('INVALID_INPUT','Programa académico inválido.');
 try { const r=await pool.query<{id:string;code:string;name:string;version:string}>("INSERT INTO academic_programs(institution_id,code,name) VALUES($1,$2,$3) RETURNING id,code,name,version",[context.institutionId,code,name]); return r.rows[0]; } catch { throw new AcademicStructureError('CONFLICT','Já existe um programa com este código nesta instituição.'); }
}
export async function createAcademicLevel(pool:Pool, context:InstitutionalContext,input:{programId:unknown;code:unknown;name:unknown}) {
 const programId=text(input.programId,36),code=text(input.code,40),name=text(input.name,160); if(!programId||!code||!name) throw new AcademicStructureError('INVALID_INPUT','Nível académico inválido.');
 const p=await pool.query('SELECT id FROM academic_programs WHERE id=$1 AND institution_id=$2 AND status=\'active\'',[programId,context.institutionId]); if(!p.rowCount) throw new AcademicStructureError('NOT_FOUND','Programa académico não encontrado.');
 try { const r=await pool.query<{id:string;program_id:string;code:string;name:string;version:string}>("INSERT INTO academic_levels(institution_id,program_id,code,name) VALUES($1,$2,$3,$4) RETURNING id,program_id,code,name,version",[context.institutionId,programId,code,name]); return {id:r.rows[0].id,programId:r.rows[0].program_id,code:r.rows[0].code,name:r.rows[0].name,version:r.rows[0].version}; } catch { throw new AcademicStructureError('CONFLICT','Já existe um nível com este código neste programa.'); }
}
export async function retireAcademicProgram(pool:Pool, context:InstitutionalContext,input:{id:unknown;expectedVersion:unknown}) {
 const id=text(input.id,36), version=Number(input.expectedVersion); if(!id||!Number.isInteger(version)||version<1) throw new AcademicStructureError('INVALID_INPUT','Versão académica inválida.');
 const r=await pool.query<{version:string}>("UPDATE academic_programs SET status='retired',version=version+1,updated_at=now() WHERE id=$1 AND institution_id=$2 AND version=$3 AND status='active' RETURNING version",[id,context.institutionId,version]); if(!r.rowCount) throw new AcademicStructureError('CONFLICT','O programa foi alterado entretanto.'); return {version:r.rows[0].version};
}

export async function createAcademicClass(pool:Pool, context:InstitutionalContext,input:{academicYearId:unknown;programId:unknown;levelId:unknown;code:unknown}) {
 const academicYearId=text(input.academicYearId,36),programId=text(input.programId,36),levelId=text(input.levelId,36),code=text(input.code,40);
 if(!academicYearId||!programId||!levelId||!code) throw new AcademicStructureError('INVALID_INPUT','Turma académica inválida.');
 const authority=await pool.query(`SELECT y.id FROM academic_years y JOIN academic_programs p ON p.id=$2 AND p.institution_id=y.institution_id AND p.status='active' JOIN academic_levels l ON l.id=$3 AND l.institution_id=y.institution_id AND l.program_id=p.id AND l.status='active' WHERE y.id=$1 AND y.institution_id=$4 AND y.status IN ('draft','active')`,[academicYearId,programId,levelId,context.institutionId]);
 if(!authority.rowCount) throw new AcademicStructureError('NOT_FOUND','Referências académicas não disponíveis nesta instituição.');
 try { const r=await pool.query<{id:string;status:string;version:string}>("INSERT INTO academic_classes(institution_id,academic_year_id,program_id,level_id,code) VALUES($1,$2,$3,$4,$5) RETURNING id,status,version",[context.institutionId,academicYearId,programId,levelId,code]); await recordAcademicEvent(pool,context,'academic_class',r.rows[0].id,'created'); return r.rows[0]; } catch { throw new AcademicStructureError('CONFLICT','Já existe uma turma com este código no âmbito académico indicado.'); }
}

export async function createAcademicSubject(pool:Pool, context:InstitutionalContext,input:{code:unknown;name:unknown}) {
 const code=text(input.code,40),name=text(input.name,160); if(!code||!name) throw new AcademicStructureError('INVALID_INPUT','Disciplina académica inválida.');
 try { const r=await pool.query<{id:string;code:string;name:string;version:string}>("INSERT INTO academic_subjects(institution_id,code,name) VALUES($1,$2,$3) RETURNING id,code,name,version",[context.institutionId,code,name]); await recordAcademicEvent(pool,context,'academic_subject',r.rows[0].id,'created'); return r.rows[0]; } catch { throw new AcademicStructureError('CONFLICT','Já existe uma disciplina com este código nesta instituição.'); }
}

export async function offerAcademicSubject(pool:Pool, context:InstitutionalContext,input:{academicYearId:unknown;classId:unknown;subjectId:unknown}) {
 const academicYearId=text(input.academicYearId,36),classId=text(input.classId,36),subjectId=text(input.subjectId,36); if(!academicYearId||!classId||!subjectId) throw new AcademicStructureError('INVALID_INPUT','Disponibilização de disciplina inválida.');
 const authority=await pool.query(`SELECT c.id FROM academic_classes c JOIN academic_years y ON y.id=c.academic_year_id AND y.institution_id=c.institution_id JOIN academic_subjects s ON s.id=$3 AND s.institution_id=c.institution_id AND s.status='active' WHERE c.id=$2 AND c.academic_year_id=$1 AND c.institution_id=$4 AND c.status IN ('planned','active')`,[academicYearId,classId,subjectId,context.institutionId]);
 if(!authority.rowCount) throw new AcademicStructureError('NOT_FOUND','Turma ou disciplina não disponível nesta instituição.');
 try { const r=await pool.query<{id:string;status:string;version:string}>("INSERT INTO academic_subject_offerings(institution_id,academic_year_id,class_id,subject_id) VALUES($1,$2,$3,$4) RETURNING id,status,version",[context.institutionId,academicYearId,classId,subjectId]); await recordAcademicEvent(pool,context,'academic_subject_offering',r.rows[0].id,'created'); return r.rows[0]; } catch { throw new AcademicStructureError('CONFLICT','A disciplina já está disponível para esta turma.'); }
}

export async function closeAcademicClass(pool:Pool, context:InstitutionalContext,input:{id:unknown;expectedVersion:unknown}) {
 const id=text(input.id,36),version=Number(input.expectedVersion); if(!id||!Number.isInteger(version)||version<1) throw new AcademicStructureError('INVALID_INPUT','Versão académica inválida.');
 const current=await pool.query<{version:string}>('SELECT version FROM academic_classes WHERE id=$1 AND institution_id=$2 FOR UPDATE',[id,context.institutionId]);
 if(!current.rowCount) throw new AcademicStructureError('NOT_FOUND','Turma académica não encontrada.');
 if(Number(current.rows[0].version)!==version) throw new AcademicStructureError('STALE_VERSION','A turma foi alterada entretanto.');
 const r=await pool.query<{version:string}>("UPDATE academic_classes SET status='closed',version=version+1,updated_at=now() WHERE id=$1 AND institution_id=$2 AND version=$3 AND status IN ('planned','active') RETURNING version",[id,context.institutionId,version]);
 if(!r.rowCount) throw new AcademicStructureError('CONFLICT','A turma não pode ser encerrada no estado atual.'); await recordAcademicEvent(pool,context,'academic_class',id,'closed'); return {version:r.rows[0].version};
}

export async function assignTeacher(pool:Pool, context:InstitutionalContext,input:{academicYearId:unknown;classId:unknown;subjectOfferingId:unknown;teacherPersonId:unknown;effectiveFrom:unknown}) {
 const academicYearId=text(input.academicYearId,36),classId=text(input.classId,36),subjectOfferingId=text(input.subjectOfferingId,36),teacherPersonId=text(input.teacherPersonId,36),effectiveFrom=text(input.effectiveFrom,10);
 if(!academicYearId||!classId||!subjectOfferingId||!teacherPersonId||!effectiveFrom||!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new AcademicStructureError('INVALID_INPUT','Atribuição docente inválida.');
 const authority=await pool.query(`SELECT o.id FROM academic_subject_offerings o JOIN academic_classes c ON c.id=o.class_id AND c.institution_id=o.institution_id JOIN academic_years y ON y.id=o.academic_year_id AND y.institution_id=o.institution_id JOIN memberships m ON m.person_id=$4 AND m.institution_id=o.institution_id AND m.role='teacher' AND m.status='active' WHERE o.id=$3 AND o.academic_year_id=$1 AND o.class_id=$2 AND o.institution_id=$5 AND o.status='active' AND c.status IN ('planned','active') AND y.status='active'`,[academicYearId,classId,subjectOfferingId,teacherPersonId,context.institutionId]);
 if(!authority.rowCount) throw new AcademicStructureError('NOT_FOUND','A atribuição docente não é permitida nesta instituição.');
 try { const r=await pool.query<{id:string;version:string;status:string}>("INSERT INTO teacher_assignments(institution_id,academic_year_id,class_id,subject_offering_id,teacher_person_id,effective_from) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,version,status",[context.institutionId,academicYearId,classId,subjectOfferingId,teacherPersonId,effectiveFrom]); return r.rows[0]; } catch { throw new AcademicStructureError('CONFLICT','Já existe uma atribuição docente sobreposta para esta disciplina.'); }
}
