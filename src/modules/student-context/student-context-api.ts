import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { canReadStudentContext, type StudentContextRelationship, unavailableDomains } from './student-context-policy.ts';

type Queryable = { query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> };
type HistoryOptions = { historyLimit?: unknown; enrollmentOffset?: unknown; placementOffset?: unknown };
type DocumentMetadata = { document_type: string; status: string; verified_at: Date | null };

export class StudentContextError extends Error { constructor(public code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_INPUT') { super(code); } }

const publicStudentRef = /^stu_[A-Za-z0-9_-]{22}$/;

/** Resolves a browser-safe handle only inside the server-owned institution. */
export async function resolveStudentRef(pool: Queryable, institutionId: string, studentRef: unknown): Promise<string> {
  if (typeof studentRef !== 'string' || !publicStudentRef.test(studentRef)) throw new StudentContextError('NOT_FOUND');
  const profile = await pool.query<{ person_id: string }>(
    "SELECT person_id FROM student_profiles WHERE institution_id=$1 AND public_ref=$2 AND status='active'",
    [institutionId, studentRef],
  );
  if (!profile.rowCount) throw new StudentContextError('NOT_FOUND');
  return profile.rows[0].person_id;
}

const pageNumber = (value: unknown, fallback: number, max: number) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : fallback;
};

export async function loadStudentContext(pool: Queryable, context: InstitutionalContext, studentRef: unknown, options: HistoryOptions = {}) {
  const personId = await resolveStudentRef(pool, context.institutionId, studentRef);
  let relationship: StudentContextRelationship = 'any';
  if (context.role === 'student') relationship = context.personId === personId ? 'self' : 'other';
  if (context.role === 'parent') {
    const related = await pool.query('SELECT 1 FROM guardian_relationships WHERE institution_id=$1 AND guardian_person_id=$2 AND student_person_id=$3 AND status=\'active\'', [context.institutionId, context.personId, personId]);
    relationship = related.rowCount ? 'linked' : 'other';
  }
  if (!canReadStudentContext(context.role, relationship)) throw new StudentContextError('FORBIDDEN');

  const current = await pool.query<{ display_name: string; student_status: string; enrollment_id: string | null; enrollment_status: string | null; enrollment_year_name: string | null; placement_status: string | null; placement_year_name: string | null; class_code: string | null; program_code: string | null; program_name: string | null; level_code: string | null; level_name: string | null; subjects: unknown }>(
    `WITH current_enrollment AS (
       SELECT e.id AS enrollment_id, e.status, y.name AS year_name FROM enrollment_applications e JOIN academic_years y ON y.id=e.academic_year_id AND y.institution_id=e.institution_id AND y.status='active'
       WHERE e.institution_id=$1 AND e.student_person_id=$2 AND e.status='active' ORDER BY y.starts_on DESC,e.created_at DESC LIMIT 1
     ), current_placement AS (
       SELECT pl.status,y.name AS year_name,c.id AS class_id,c.code AS class_code,p.code AS program_code,p.name AS program_name,l.code AS level_code,l.name AS level_name FROM student_academic_placements pl JOIN academic_years y ON y.id=pl.academic_year_id AND y.institution_id=pl.institution_id AND y.status='active' JOIN academic_classes c ON c.id=pl.class_id AND c.institution_id=pl.institution_id AND c.status='active' JOIN academic_programs p ON p.id=c.program_id AND p.institution_id=c.institution_id AND p.status='active' JOIN academic_levels l ON l.id=c.level_id AND l.institution_id=c.institution_id AND l.program_id=p.id AND l.status='active'
       WHERE pl.institution_id=$1 AND pl.student_person_id=$2 AND pl.status='active' ORDER BY y.starts_on DESC,pl.created_at DESC LIMIT 1
     ) SELECT p.name AS display_name,sp.status AS student_status,e.enrollment_id,e.status AS enrollment_status,e.year_name AS enrollment_year_name,pl.status AS placement_status,pl.year_name AS placement_year_name,pl.class_code,pl.program_code,pl.program_name,pl.level_code,pl.level_name,COALESCE((SELECT jsonb_agg(jsonb_build_object('code',s.code,'name',s.name) ORDER BY s.code) FROM academic_subject_offerings o JOIN academic_subjects s ON s.id=o.subject_id AND s.institution_id=o.institution_id AND s.status='active' WHERE o.institution_id=sp.institution_id AND o.class_id=pl.class_id AND o.status='active'),'[]'::jsonb) AS subjects FROM student_profiles sp JOIN people p ON p.id=sp.person_id LEFT JOIN current_enrollment e ON true LEFT JOIN current_placement pl ON true WHERE sp.institution_id=$1 AND sp.person_id=$2 AND sp.status='active'`,
    [context.institutionId, personId],
  );
  if (!current.rowCount) throw new StudentContextError('NOT_FOUND');
  const row = current.rows[0];
  const limit = Math.max(1, pageNumber(options.historyLimit, 50, 50));
  const enrollmentOffset = pageNumber(options.enrollmentOffset, 0, 10000);
  const placementOffset = pageNumber(options.placementOffset, 0, 10000);
  const [enrollmentHistory, placementHistory, documents, guardians] = await Promise.all([
    pool.query<{ status: string; year_name: string }>("SELECT e.status,y.name AS year_name FROM enrollment_applications e JOIN academic_years y ON y.id=e.academic_year_id AND y.institution_id=e.institution_id WHERE e.institution_id=$1 AND e.student_person_id=$2 AND NOT(e.status='active' AND y.status='active') ORDER BY y.starts_on DESC,e.created_at DESC,e.id DESC LIMIT $3 OFFSET $4", [context.institutionId, personId, limit + 1, enrollmentOffset]),
    pool.query<{ status: string; year_name: string; class_code: string; program_code: string; program_name: string; level_code: string; level_name: string }>("SELECT pl.status,y.name AS year_name,c.code AS class_code,p.code AS program_code,p.name AS program_name,l.code AS level_code,l.name AS level_name FROM student_academic_placements pl JOIN academic_years y ON y.id=pl.academic_year_id AND y.institution_id=pl.institution_id JOIN academic_classes c ON c.id=pl.class_id AND c.institution_id=pl.institution_id JOIN academic_programs p ON p.id=c.program_id AND p.institution_id=c.institution_id JOIN academic_levels l ON l.id=c.level_id AND l.institution_id=pl.institution_id AND l.program_id=p.id WHERE pl.institution_id=$1 AND pl.student_person_id=$2 AND NOT(pl.status='active' AND y.status='active') ORDER BY y.starts_on DESC,pl.created_at DESC,pl.id DESC LIMIT $3 OFFSET $4", [context.institutionId, personId, limit + 1, placementOffset]),
    row.enrollment_id ? pool.query<DocumentMetadata>('SELECT document_type,status,verified_at FROM enrollment_documents WHERE institution_id=$1 AND enrollment_application_id=$2 ORDER BY document_type ASC,created_at ASC,id ASC', [context.institutionId, row.enrollment_id]) : Promise.resolve({ rows: [] as DocumentMetadata[], rowCount: 0 }),
    pool.query<{ name: string; relationship: string; status: string }>('SELECT p.name,g.relationship,g.status FROM guardian_relationships g JOIN people p ON p.id=g.guardian_person_id WHERE g.institution_id=$1 AND g.student_person_id=$2 ORDER BY p.name ASC', [context.institutionId, personId]),
  ]);
  const subjects = Array.isArray(row.subjects) ? row.subjects : [];
  const page = <T>(rows: T[], offset: number, map: (item: T) => unknown) => ({ items: rows.slice(0, limit).map(map), nextOffset: rows.length > limit ? offset + limit : null });
  return {
    student: { displayName: row.display_name, status: row.student_status },
    current: { enrollment: row.enrollment_status ? { status: row.enrollment_status, academicYear: { name: row.enrollment_year_name } } : null, placement: row.placement_status ? { status: row.placement_status, academicYear: { name: row.placement_year_name }, class: { code: row.class_code }, program: { code: row.program_code, name: row.program_name }, level: { code: row.level_code, name: row.level_name }, subjects } : null },
    history: { enrollments: page(enrollmentHistory.rows, enrollmentOffset, x => ({ status: x.status, academicYear: { name: x.year_name } })), placements: page(placementHistory.rows, placementOffset, x => ({ status: x.status, academicYear: { name: x.year_name }, class: { code: x.class_code }, program: { code: x.program_code, name: x.program_name }, level: { code: x.level_code, name: x.level_name } })) },
    documents: { metadata: documents.rows.map(x => ({ type: x.document_type, status: x.status, verifiedAt: x.verified_at?.toISOString() ?? null })) },
    guardians: { items: guardians.rows.map(x => ({ name: x.name, relationship: x.relationship, status: x.status })) },
    unavailable: unavailableDomains,
  };
}
