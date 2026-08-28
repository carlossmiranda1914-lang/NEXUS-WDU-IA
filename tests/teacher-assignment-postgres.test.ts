import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';
import { AcademicStructureError, assignTeacher, listTeacherAssignments, replaceTeacher } from '../src/modules/academic/academic-structure-api.ts';

const { connectionString } = readApprovedTestTarget();
const pool = new pg.Pool({ connectionString, max: 6 });
const [institutionA, institutionB, actor, teacherA, teacherB, teacherC, inactiveTeacher, year, program, level, klass, subject, offering] = Array.from({ length: 13 }, randomUUID);
const suffix = randomUUID().slice(0, 8);
const context = { institutionId: institutionA, personId: actor, membershipId: randomUUID(), role: 'director' as const, personName: 'Director', identityEmail: null, institutionName: `Teacher A ${suffix}`, institutionSlug: `teacher-a-${suffix}` };
const rejects = (work: () => Promise<unknown>, code: AcademicStructureError['code']) => assert.rejects(work, (error: unknown) => error instanceof AcademicStructureError && error.code === code);

try {
  await pool.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,$2,$3,'active'),($4,$5,$6,'active')", [institutionA, `Teacher A ${suffix}`, `teacher-a-${suffix}`, institutionB, `Teacher B ${suffix}`, `teacher-b-${suffix}`]);
  await pool.query("INSERT INTO people(id,name,birth_date,phone,gender,nationality,province,municipality,address_line) VALUES($1,'Actor','1980-01-01','900000001','other','Angolana','Luanda','Luanda','Rua'),($2,'Teacher A','1980-01-01','900000002','other','Angolana','Luanda','Luanda','Rua'),($3,'Teacher B','1980-01-01','900000003','other','Angolana','Luanda','Luanda','Rua'),($4,'Teacher C','1980-01-01','900000004','other','Angolana','Luanda','Luanda','Rua'),($5,'Inactive','1980-01-01','900000005','other','Angolana','Luanda','Luanda','Rua')", [actor, teacherA, teacherB, teacherC, inactiveTeacher]);
  await pool.query("INSERT INTO memberships(person_id,institution_id,role,status,approved_at) VALUES($1,$2,'teacher','active',now()),($3,$2,'teacher','active',now()),($4,$2,'teacher','active',now()),($5,$2,'teacher','revoked',now())", [teacherA, institutionA, teacherB, teacherC, inactiveTeacher]);
  await pool.query("INSERT INTO academic_years(id,institution_id,name,starts_on,ends_on,status) VALUES($1,$2,'2026','2026-01-01','2026-12-31','active')", [year, institutionA]);
  await pool.query("INSERT INTO academic_programs(id,institution_id,code,name) VALUES($1,$2,'GEN','Geral')", [program, institutionA]);
  await pool.query("INSERT INTO academic_levels(id,institution_id,program_id,code,name) VALUES($1,$2,$3,'10','10.º')", [level, institutionA, program]);
  await pool.query("INSERT INTO academic_classes(id,institution_id,academic_year_id,program_id,level_id,code,status) VALUES($1,$2,$3,$4,$5,'10A','active')", [klass, institutionA, year, program, level]);
  await pool.query("INSERT INTO academic_subjects(id,institution_id,code,name) VALUES($1,$2,'MAT','Matemática')", [subject, institutionA]);
  await pool.query('INSERT INTO academic_subject_offerings(id,institution_id,academic_year_id,class_id,subject_id) VALUES($1,$2,$3,$4,$5)', [offering, institutionA, year, klass, subject]);

  const original = await assignTeacher(pool as any, context, { academicYearId: year, classId: klass, subjectOfferingId: offering, teacherPersonId: teacherA, effectiveFrom: '2026-08-01', expectedVersion: 1 });
  const replacement = await replaceTeacher(pool as any, context, { id: original.id, teacherPersonId: teacherB, effectiveFrom: '2026-08-15', expectedVersion: 1 });
  assert.deepEqual({ status: replacement.status, version: replacement.version }, { status: 'active', version: '1' });
  const current = await listTeacherAssignments(pool as any, context);
  assert.deepEqual(current.map(row => row.teacher_person_id), [teacherB]);
  const historical = await listTeacherAssignments(pool as any, context, { view: 'historical' });
  assert.deepEqual(new Set(historical.map(row => row.teacher_person_id)), new Set([teacherA, teacherB]));
  const old = await pool.query<{ status: string; effective_to: string; version: string }>('SELECT status,effective_to::text,version FROM teacher_assignments WHERE id=$1', [original.id]);
  assert.deepEqual(old.rows[0], { status: 'replaced', effective_to: '2026-08-14', version: '2' });
  await rejects(() => replaceTeacher(pool as any, context, { id: original.id, teacherPersonId: teacherC, effectiveFrom: '2026-08-20', expectedVersion: 1 }), 'STALE_VERSION');
  await rejects(() => replaceTeacher(pool as any, context, { id: replacement.id, teacherPersonId: inactiveTeacher, effectiveFrom: '2026-08-20', expectedVersion: 1 }), 'NOT_FOUND');
  await rejects(() => replaceTeacher(pool as any, { ...context, institutionId: institutionB }, { id: replacement.id, teacherPersonId: teacherB, effectiveFrom: '2026-08-20', expectedVersion: 1 }), 'NOT_FOUND');

  const concurrent = await Promise.allSettled([
    replaceTeacher(pool as any, context, { id: replacement.id, teacherPersonId: teacherA, effectiveFrom: '2026-08-20', expectedVersion: 1 }),
    replaceTeacher(pool as any, context, { id: replacement.id, teacherPersonId: teacherC, effectiveFrom: '2026-08-20', expectedVersion: 1 }),
  ]);
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = concurrent.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  assert(rejected?.reason instanceof AcademicStructureError && rejected.reason.code === 'STALE_VERSION');
  const afterConcurrency = await listTeacherAssignments(pool as any, context);
  assert.equal(afterConcurrency.length, 1);

  const active = afterConcurrency[0];
  await pool.query("CREATE FUNCTION reject_teacher_assignment_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'teacher assignment audit failure injection'; END $$; CREATE TRIGGER reject_teacher_assignment_audit BEFORE INSERT ON academic_events FOR EACH ROW EXECUTE FUNCTION reject_teacher_assignment_audit()");
  await rejects(() => replaceTeacher(pool as any, context, { id: active.id, teacherPersonId: teacherB, effectiveFrom: '2026-08-25', expectedVersion: Number(active.version) }), 'CONFLICT');
  const rollback = await pool.query<{ count: string; teacher_person_id: string; status: string }>("SELECT (SELECT count(*)::text FROM teacher_assignments WHERE institution_id=$1) count,teacher_person_id,status FROM teacher_assignments WHERE id=$2", [institutionA, active.id]);
  assert.deepEqual(rollback.rows[0], { count: '3', teacher_person_id: active.teacher_person_id, status: 'active' });
  console.log('[ACADEMIC-01-TEACHER-ASSIGNMENT] replacement/history/stale/concurrency/rollback/tenant/eligibility: PASS.');
} finally {
  await pool.query('DROP TRIGGER IF EXISTS reject_teacher_assignment_audit ON academic_events; DROP FUNCTION IF EXISTS reject_teacher_assignment_audit()').catch(() => undefined);
  await pool.query('DELETE FROM institutions WHERE id=ANY($1)', [[institutionA, institutionB]]).catch(() => undefined);
  await pool.end();
}
