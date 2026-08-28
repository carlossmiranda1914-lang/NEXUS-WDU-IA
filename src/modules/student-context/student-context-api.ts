import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { canReadStudentContext, type StudentContextRelationship, unavailableDomains } from './student-context-policy.ts';

type Queryable={query<T=any>(sql:string,params?:unknown[]):Promise<{rows:T[];rowCount:number|null}>};
export class StudentContextError extends Error { constructor(public code:'NOT_FOUND'|'FORBIDDEN'|'INVALID_INPUT') { super(code); } }
export async function loadStudentContext(pool:Queryable,context:InstitutionalContext,personRef:unknown) {
 if(typeof personRef!=='string'||!personRef.trim())throw new StudentContextError('INVALID_INPUT');
 const personId=personRef.trim(); let relationship:StudentContextRelationship='any';
 if(context.role==='student')relationship=context.personId===personId?'self':'other';
 if(context.role==='parent'){const r=await pool.query('SELECT 1 FROM guardian_relationships WHERE institution_id=$1 AND guardian_person_id=$2 AND student_person_id=$3 AND status=\'active\'',[context.institutionId,context.personId,personId]);relationship=r.rowCount?'linked':'other';}
 if(!canReadStudentContext(context.role,relationship))throw new StudentContextError('FORBIDDEN');
 const r=await pool.query<{display_name:string;student_status:string;enrollment_status:string|null;placement_status:string|null}>(`SELECT p.name display_name,sp.status student_status,e.status enrollment_status,pl.status placement_status FROM student_profiles sp JOIN people p ON p.id=sp.person_id LEFT JOIN enrollment_applications e ON e.institution_id=sp.institution_id AND e.student_person_id=sp.person_id AND e.status='active' LEFT JOIN student_academic_placements pl ON pl.institution_id=sp.institution_id AND pl.student_person_id=sp.person_id AND pl.status='active' WHERE sp.institution_id=$1 AND sp.person_id=$2 AND sp.status='active'`,[context.institutionId,personId]);
 if(!r.rowCount)throw new StudentContextError('NOT_FOUND'); return {student:{displayName:r.rows[0].display_name,status:r.rows[0].student_status},current:{enrollmentStatus:r.rows[0].enrollment_status,placementStatus:r.rows[0].placement_status},unavailable:unavailableDomains};
}
