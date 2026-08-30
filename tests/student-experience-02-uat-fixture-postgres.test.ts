import assert from 'node:assert/strict';
import pg from 'pg';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';

const { connectionString, target } = readApprovedTestTarget();
assert.equal(target.host, '127.0.0.1');
assert.equal(target.port, '54329');

const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
try {
  const activeUatProfiles = await pool.query<{ count: string }>(
    `SELECT count(*) FROM student_profiles sp
     JOIN institutions institution ON institution.id=sp.institution_id
     WHERE institution.slug='nexus-local-iam-uat' AND sp.status='active' AND sp.student_number LIKE 'UAT-STUDENT-360%'`,
  );
  assert.equal(activeUatProfiles.rows[0].count, '2', 'Human UAT must not show a superseded active fixture alongside Students A and B.');
  const result = await pool.query<{
    student_number: string; public_ref: string; current_class: string; program_code: string; level_code: string;
    enrollment_history_count: string; placement_history_count: string; document_type: string; guardian_relationship: string;
  }>(
    `SELECT sp.student_number,sp.public_ref,current_class.code AS current_class,program.code AS program_code,level.code AS level_code,
      (SELECT count(*) FROM enrollment_applications e JOIN academic_years y ON y.id=e.academic_year_id AND y.institution_id=e.institution_id WHERE e.institution_id=sp.institution_id AND e.student_person_id=sp.person_id AND NOT(e.status='active' AND y.status='active')) AS enrollment_history_count,
      (SELECT count(*) FROM student_academic_placements pl JOIN academic_years y ON y.id=pl.academic_year_id AND y.institution_id=pl.institution_id WHERE pl.institution_id=sp.institution_id AND pl.student_person_id=sp.person_id AND NOT(pl.status='active' AND y.status='active')) AS placement_history_count,
      (SELECT d.document_type FROM enrollment_documents d JOIN enrollment_applications e ON e.id=d.enrollment_application_id AND e.institution_id=d.institution_id JOIN academic_years y ON y.id=e.academic_year_id AND y.institution_id=e.institution_id WHERE d.institution_id=sp.institution_id AND e.student_person_id=sp.person_id AND e.status='active' AND y.status='active' ORDER BY d.created_at ASC LIMIT 1) AS document_type,
      (SELECT g.relationship FROM guardian_relationships g WHERE g.institution_id=sp.institution_id AND g.student_person_id=sp.person_id ORDER BY g.created_at ASC LIMIT 1) AS guardian_relationship
     FROM student_profiles sp
     JOIN student_academic_placements current_placement ON current_placement.institution_id=sp.institution_id AND current_placement.student_person_id=sp.person_id AND current_placement.status='active'
     JOIN academic_years current_year ON current_year.id=current_placement.academic_year_id AND current_year.institution_id=current_placement.institution_id AND current_year.status='active'
     JOIN academic_classes current_class ON current_class.id=current_placement.class_id AND current_class.institution_id=current_placement.institution_id
     JOIN academic_programs program ON program.id=current_class.program_id AND program.institution_id=current_class.institution_id
     JOIN academic_levels level ON level.id=current_class.level_id AND level.institution_id=current_class.institution_id
     JOIN institutions institution ON institution.id=sp.institution_id AND institution.slug='nexus-local-iam-uat'
     WHERE sp.student_number = ANY($1::text[])
     ORDER BY sp.student_number`,
    [['UAT-STUDENT-360-A', 'UAT-STUDENT-360-B']],
  );
  assert.equal(result.rowCount, 2, 'Human UAT requires exactly two canonical student fixtures.');
  const [studentA, studentB] = result.rows;
  for (const fixture of result.rows) {
    assert.match(fixture.public_ref, /^stu_[A-Za-z0-9_-]{22}$/);
    assert.ok(fixture.current_class && fixture.program_code && fixture.level_code, 'Each UAT fixture needs an authoritative current academic context.');
    assert.ok(Number(fixture.enrollment_history_count) >= 1 && Number(fixture.placement_history_count) >= 1, 'Each UAT fixture needs factual history.');
    assert.ok(fixture.document_type && fixture.guardian_relationship, 'Each UAT fixture needs factual document metadata and guardian context.');
  }
  assert.notEqual(studentA.public_ref, studentB.public_ref, 'Each student uses a distinct opaque browser reference.');
  assert.notEqual(studentA.current_class, studentB.current_class, 'A/B current class must differ materially.');
  assert.notEqual(studentA.program_code, studentB.program_code, 'A/B programme must differ materially.');
  assert.notEqual(studentA.document_type, studentB.document_type, 'A/B document metadata must differ materially.');
  assert.notEqual(studentA.guardian_relationship, studentB.guardian_relationship, 'A/B guardian context must differ materially.');
  console.log('[STUDENT-EXPERIENCE-02] Human UAT canonical A/B fixtures: PASS.');
} finally {
  await pool.end();
}
