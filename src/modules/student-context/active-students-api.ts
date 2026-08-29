import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { canReadStudentContext } from './student-context-policy.ts';

type Queryable = { query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> };

type ActiveStudentRow = {
  student_ref: string;
  display_name: string;
  status: string;
  academic_year_name: string | null;
  class_code: string | null;
  program_code: string | null;
  program_name: string | null;
  level_code: string | null;
  level_name: string | null;
};

export class ActiveStudentsError extends Error { constructor(public code: 'FORBIDDEN') { super(code); } }

/** One institutional StudentProfile becomes one read-only active-student row. */
export async function loadActiveStudents(pool: Queryable, context: InstitutionalContext) {
  if (!canReadStudentContext(context.role, 'any')) throw new ActiveStudentsError('FORBIDDEN');
  const result = await pool.query<ActiveStudentRow>(
    `SELECT sp.public_ref AS student_ref,p.name AS display_name,sp.status,
       COALESCE(current_placement.year_name,current_enrollment.year_name) AS academic_year_name,
       current_placement.class_code,current_placement.program_code,current_placement.program_name,current_placement.level_code,current_placement.level_name
       FROM student_profiles sp
       JOIN people p ON p.id=sp.person_id
       LEFT JOIN LATERAL (
         SELECT y.name AS year_name FROM enrollment_applications e
         JOIN academic_years y ON y.id=e.academic_year_id AND y.institution_id=e.institution_id AND y.status='active'
         WHERE e.institution_id=sp.institution_id AND e.student_person_id=sp.person_id AND e.status='active'
         ORDER BY y.starts_on DESC,e.created_at DESC,e.id DESC LIMIT 1
       ) current_enrollment ON true
       LEFT JOIN LATERAL (
         SELECT y.name AS year_name,c.code AS class_code,program.code AS program_code,program.name AS program_name,level.code AS level_code,level.name AS level_name
         FROM student_academic_placements placement
         JOIN academic_years y ON y.id=placement.academic_year_id AND y.institution_id=placement.institution_id AND y.status='active'
         JOIN academic_classes c ON c.id=placement.class_id AND c.institution_id=placement.institution_id AND c.status='active'
         JOIN academic_programs program ON program.id=c.program_id AND program.institution_id=c.institution_id AND program.status='active'
         JOIN academic_levels level ON level.id=c.level_id AND level.institution_id=c.institution_id AND level.program_id=program.id AND level.status='active'
         WHERE placement.institution_id=sp.institution_id AND placement.student_person_id=sp.person_id AND placement.status='active'
         ORDER BY y.starts_on DESC,placement.created_at DESC,placement.id DESC LIMIT 1
       ) current_placement ON true
       WHERE sp.institution_id=$1 AND sp.status='active'
       ORDER BY lower(p.name) ASC,sp.public_ref ASC`,
    [context.institutionId],
  );
  return {
    students: result.rows.map((row) => ({
      studentRef: row.student_ref,
      displayName: row.display_name,
      status: row.status,
      current: row.academic_year_name || row.class_code || row.program_code || row.level_code
        ? {
          academicYear: row.academic_year_name ? { name: row.academic_year_name } : null,
          class: row.class_code ? { code: row.class_code } : null,
          program: row.program_code ? { code: row.program_code, name: row.program_name } : null,
          level: row.level_code ? { code: row.level_code, name: row.level_name } : null,
        }
        : null,
    })),
  };
}
