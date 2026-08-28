import type { InstitutionalContext } from '../../auth/institutional-context.ts';

type Pool = { query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> };
export class AcademicStructureError extends Error { constructor(public readonly code: 'INVALID_INPUT'|'CONFLICT'|'NOT_FOUND', message: string) { super(message); } }
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim()&&v.trim().length<=max?v.trim():null;
export async function createAcademicProgram(pool:Pool, context:InstitutionalContext,input:{code:unknown;name:unknown}) {
 const code=text(input.code,40),name=text(input.name,160); if(!code||!name) throw new AcademicStructureError('INVALID_INPUT','Programa académico inválido.');
 try { const r=await pool.query<{id:string;code:string;name:string;version:string}>("INSERT INTO academic_programs(institution_id,code,name) VALUES($1,$2,$3) RETURNING id,code,name,version",[context.institutionId,code,name]); return r.rows[0]; } catch { throw new AcademicStructureError('CONFLICT','Já existe um programa com este código nesta instituição.'); }
}
export async function createAcademicLevel(pool:Pool, context:InstitutionalContext,input:{programId:unknown;code:unknown;name:unknown}) {
 const programId=text(input.programId,36),code=text(input.code,40),name=text(input.name,160); if(!programId||!code||!name) throw new AcademicStructureError('INVALID_INPUT','Nível académico inválido.');
 const p=await pool.query('SELECT id FROM academic_programs WHERE id=$1 AND institution_id=$2 AND status=\'active\'',[programId,context.institutionId]); if(!p.rowCount) throw new AcademicStructureError('NOT_FOUND','Programa académico não encontrado.');
 try { const r=await pool.query<{id:string;program_id:string;code:string;name:string;version:string}>("INSERT INTO academic_levels(institution_id,program_id,code,name) VALUES($1,$2,$3,$4) RETURNING id,program_id,code,name,version",[context.institutionId,programId,code,name]); return {id:r.rows[0].id,programId:r.rows[0].program_id,code:r.rows[0].code,name:r.rows[0].name,version:r.rows[0].version}; } catch { throw new AcademicStructureError('CONFLICT','Já existe um nível com este código neste programa.'); }
}
