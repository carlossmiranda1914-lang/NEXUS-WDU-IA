import { InstitutionalContext, QueryExecutor } from './institutional-context.ts';

export interface AuthorizedStudent {
  studentProfileId: string;
  personId: string;
  name: string;
  studentNumber: string | null;
  legacyStudentId: string | null;
}

export async function resolveAuthorizedStudents(
  executor: QueryExecutor,
  context: InstitutionalContext,
): Promise<AuthorizedStudent[]> {
  const isStudent = context.role === 'student';
  const query = isStudent
    ? `SELECT student_profiles.id AS student_profile_id, people.id AS person_id, people.name, student_profiles.student_number, student_profiles.legacy_student_id
       FROM student_profiles JOIN people ON people.id = student_profiles.person_id
       WHERE student_profiles.institution_id = $1 AND student_profiles.person_id = $2 AND student_profiles.status = 'active'`
    : `SELECT student_profiles.id AS student_profile_id, people.id AS person_id, people.name, student_profiles.student_number, student_profiles.legacy_student_id
       FROM guardian_relationships
       JOIN student_profiles ON student_profiles.person_id = guardian_relationships.student_person_id
         AND student_profiles.institution_id = guardian_relationships.institution_id
       JOIN people ON people.id = student_profiles.person_id
       WHERE guardian_relationships.institution_id = $1
         AND guardian_relationships.guardian_person_id = $2
         AND guardian_relationships.status = 'active'
         AND student_profiles.status = 'active'`;
  const result = await executor.query(query, [context.institutionId, context.personId]);
  return (result.rows as Array<{ student_profile_id: string; person_id: string; name: string; student_number: string | null; legacy_student_id: string | null }>).map((row) => ({
    studentProfileId: row.student_profile_id,
    personId: row.person_id,
    name: row.name,
    studentNumber: row.student_number,
    legacyStudentId: row.legacy_student_id,
  }));
}
