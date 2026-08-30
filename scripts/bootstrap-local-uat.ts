import pg from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { readApprovedTestTarget } from './nexus-test-db-safety.mjs';

const UAT_INSTITUTION = 'nexus-local-iam-uat';
const UAT_STUDENTS = [
  { studentNumber: 'UAT-STUDENT-360-A', name: 'Ana Manuel', guardianName: 'Maria Manuel', relationship: 'Mãe', programCode: 'ENS-G', programName: 'Ensino Geral', levelCode: '10', levelName: '10.ª Classe', classCodes: ['10A', '10A-2025', '10A-2024'], offerPrefix: 'ENS-G', documentType: 'Bilhete de Identidade', documentStatus: 'verified', subjectCode: 'MAT', subjectName: 'Matemática' },
  { studentNumber: 'UAT-STUDENT-360-B', name: 'Carlos António', guardianName: 'Joana António', relationship: 'Encarregada de Educação', programCode: 'ENS-T', programName: 'Ensino Técnico', levelCode: '9', levelName: '9.ª Classe', classCodes: ['9B', '9B-2025'], offerPrefix: 'ENS-T', documentType: 'Declaração', documentStatus: 'submitted', subjectCode: 'TEC', subjectName: 'Tecnologias' },
] as const;
const execFileAsync = promisify(execFile);

async function ensureStudentFixture(pool: pg.Pool, institutionId: string, adminId: string, fixture: typeof UAT_STUDENTS[number]) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const student = await client.query<{ id: string }>(`WITH existing AS (SELECT person_id AS id FROM student_profiles WHERE institution_id=$1 AND student_number=$2), created AS (INSERT INTO people(name) SELECT $3 WHERE NOT EXISTS (SELECT 1 FROM existing) RETURNING id), profile AS (INSERT INTO student_profiles(institution_id,person_id,student_number,status) SELECT $1,id,$2,'active' FROM created ON CONFLICT (institution_id,person_id) DO UPDATE SET status='active' RETURNING person_id) SELECT id FROM existing UNION ALL SELECT person_id FROM profile LIMIT 1`, [institutionId, fixture.studentNumber, fixture.name]);
    const studentId = student.rows[0]?.id; if (!studentId) throw new Error('Could not create the canonical UAT StudentProfile.');
    const guardian = await client.query<{ id: string }>(`WITH existing AS (SELECT guardian_person_id AS id FROM guardian_relationships WHERE institution_id=$1 AND student_person_id=$2 AND relationship=$3), created AS (INSERT INTO people(name) SELECT $4 WHERE NOT EXISTS (SELECT 1 FROM existing) RETURNING id) SELECT id FROM existing UNION ALL SELECT id FROM created LIMIT 1`, [institutionId, studentId, fixture.relationship, fixture.guardianName]);
    const guardianId = guardian.rows[0]?.id; if (!guardianId) throw new Error('Could not create the canonical UAT guardian fixture.');
    await client.query(`INSERT INTO guardian_relationships(institution_id,guardian_person_id,student_person_id,relationship,status) VALUES($1,$2,$3,$4,'active') ON CONFLICT(institution_id,guardian_person_id,student_person_id) DO UPDATE SET relationship=EXCLUDED.relationship,status='active'`, [institutionId, guardianId, studentId, fixture.relationship]);
    const years = [] as string[];
    for (const [name, start, end, status] of [['2026','2026-01-01','2026-12-31','active'], ['2025','2025-01-01','2025-12-31','closed'], ['2024','2024-01-01','2024-12-31','closed']] as const) {
      const result = await client.query<{ id: string }>(`INSERT INTO academic_years(institution_id,name,starts_on,ends_on,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(institution_id,name) DO UPDATE SET status=EXCLUDED.status RETURNING id`, [institutionId,name,start,end,status]); years.push(result.rows[0].id);
    }
    const program = await client.query<{ id: string }>(`INSERT INTO academic_programs(institution_id,code,name,status) VALUES($1,$2,$3,'active') ON CONFLICT(institution_id,code) DO UPDATE SET status='active' RETURNING id`, [institutionId, fixture.programCode, fixture.programName]);
    const level = await client.query<{ id: string }>(`INSERT INTO academic_levels(institution_id,program_id,code,name,status) VALUES($1,$2,$3,$4,'active') ON CONFLICT(institution_id,program_id,code) DO UPDATE SET status='active' RETURNING id`, [institutionId, program.rows[0].id, fixture.levelCode, fixture.levelName]);
    const classes: string[] = [];
    for (let i=0;i<fixture.classCodes.length;i++) { const result=await client.query<{id:string}>(`INSERT INTO academic_classes(institution_id,academic_year_id,program_id,level_id,code,status) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(institution_id,academic_year_id,program_id,level_id,code) DO UPDATE SET status=EXCLUDED.status RETURNING id`, [institutionId,years[i],program.rows[0].id,level.rows[0].id,fixture.classCodes[i],i===0?'active':'closed']); classes.push(result.rows[0].id); }
    for (let i=0;i<fixture.classCodes.length;i++) { const offer=await client.query<{id:string}>(`INSERT INTO enrollment_offers(institution_id,academic_year_id,name,code,status) VALUES($1,$2,$3,$4,'active') ON CONFLICT(institution_id,code) DO UPDATE SET status='active' RETURNING id`, [institutionId,years[i],`Matrícula ${2026-i}`,`${fixture.offerPrefix}-${2026-i}`]); await client.query(`INSERT INTO enrollment_applications(institution_id,student_person_id,academic_year_id,offer_id,status,created_by,updated_by) VALUES($1,$2,$3,$4,'active',$5,$5) ON CONFLICT DO NOTHING`, [institutionId,studentId,years[i],offer.rows[0].id,adminId]); }
    await client.query(`INSERT INTO enrollment_documents(institution_id,enrollment_application_id,document_type,status,verified_by,verified_at)
      SELECT e.institution_id,e.id,$3,$4,$5,'2026-01-15T10:00:00Z'
      FROM enrollment_applications e JOIN academic_years y ON y.id=e.academic_year_id AND y.institution_id=e.institution_id
      WHERE e.institution_id=$1 AND e.student_person_id=$2 AND e.status='active' AND y.status='active'
      ON CONFLICT(enrollment_application_id,document_type) DO NOTHING`, [institutionId,studentId,fixture.documentType,fixture.documentStatus,adminId]);
    const subject=await client.query<{id:string}>(`INSERT INTO academic_subjects(institution_id,code,name,status) VALUES($1,$2,$3,'active') ON CONFLICT(institution_id,code) DO UPDATE SET status='active' RETURNING id`, [institutionId,fixture.subjectCode,fixture.subjectName]);
    await client.query(`INSERT INTO academic_subject_offerings(institution_id,academic_year_id,class_id,subject_id,status) VALUES($1,$2,$3,$4,'active') ON CONFLICT(institution_id,academic_year_id,class_id,subject_id) DO NOTHING`, [institutionId,years[0],classes[0],subject.rows[0].id]);
    for (let i=0;i<fixture.classCodes.length;i++) { await client.query(`INSERT INTO student_academic_placements(institution_id,academic_year_id,class_id,student_person_id,status) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS(SELECT 1 FROM student_academic_placements WHERE institution_id=$1 AND academic_year_id=$2 AND student_person_id=$4)`, [institutionId,years[i],classes[i],studentId,i===0?'active':'ended']); }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function main() {
  const { connectionString, target } = readApprovedTestTarget();
  if (target.host !== '127.0.0.1' || target.port !== '54329') throw new Error('UAT bootstrap is restricted to the approved disposable PostgreSQL target.');
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    const client = await pool.connect();
    try {
      const migrations = await discoverMigrations(fileURLToPath(new URL('../src/db/migrations/', import.meta.url)));
      await runMigrations(client, migrations);
    } finally { client.release(); }

    const firebaseUid = process.env.NEXUS_UAT_FIREBASE_UID?.trim();
    if (!firebaseUid) throw new Error('NEXUS_UAT_FIREBASE_UID must be set in ignored external local configuration for the canonical UAT administrative account.');
    await execFileAsync(process.execPath, ['--import', 'tsx', 'scripts/provision-local-iam-uat.ts', firebaseUid], {
      cwd: process.cwd(), env: process.env, windowsHide: true,
    });

    const admin = await pool.query<{ institution_id: string; person_id: string }>(
      `SELECT n.id AS institution_id,m.person_id FROM institutions n JOIN identities i ON i.provider='firebase' AND i.provider_subject=$1 JOIN memberships m ON m.person_id=i.person_id AND m.institution_id=n.id
       WHERE n.slug=$2 AND n.status='active' AND m.status='active' AND m.role='institution_admin' LIMIT 1`, [firebaseUid, UAT_INSTITUTION],
    );
    if (admin.rowCount !== 1) throw new Error('Configured UAT administrative identity must resolve to exactly one active institution_admin Membership in the canonical local institution.');
    for (const fixture of UAT_STUDENTS) await ensureStudentFixture(pool, admin.rows[0].institution_id, admin.rows[0].person_id, fixture);
    await pool.query(`UPDATE student_profiles SET status='inactive' WHERE institution_id=$1 AND student_number='UAT-STUDENT-360'`, [admin.rows[0].institution_id]);
    const fixture = await pool.query<{ active_profile: boolean; active_enrollment: boolean; active_placement: boolean; document_metadata: boolean; history_count: string; separate_from_admin: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM student_profiles sp WHERE sp.institution_id=$1 AND sp.student_number=$2 AND sp.status='active') AS active_profile,
       EXISTS(SELECT 1 FROM enrollment_applications e JOIN student_profiles sp ON sp.person_id=e.student_person_id AND sp.institution_id=e.institution_id JOIN academic_years y ON y.id=e.academic_year_id AND y.institution_id=e.institution_id WHERE e.institution_id=$1 AND sp.student_number=$2 AND e.status='active' AND y.status='active') AS active_enrollment,
       EXISTS(SELECT 1 FROM student_academic_placements pl JOIN student_profiles sp ON sp.person_id=pl.student_person_id AND sp.institution_id=pl.institution_id JOIN academic_years y ON y.id=pl.academic_year_id AND y.institution_id=pl.institution_id WHERE pl.institution_id=$1 AND sp.student_number=$2 AND pl.status='active' AND y.status='active') AS active_placement,
       EXISTS(SELECT 1 FROM enrollment_documents d JOIN enrollment_applications e ON e.id=d.enrollment_application_id AND e.institution_id=d.institution_id JOIN student_profiles sp ON sp.person_id=e.student_person_id AND sp.institution_id=e.institution_id JOIN academic_years y ON y.id=e.academic_year_id AND y.institution_id=e.institution_id WHERE d.institution_id=$1 AND sp.student_number=$2 AND e.status='active' AND y.status='active') AS document_metadata,
       (SELECT count(*) FROM student_academic_placements pl JOIN student_profiles sp ON sp.person_id=pl.student_person_id AND sp.institution_id=pl.institution_id JOIN academic_years y ON y.id=pl.academic_year_id AND y.institution_id=pl.institution_id WHERE pl.institution_id=$1 AND sp.student_number=$2 AND NOT(pl.status='active' AND y.status='active')) AS history_count,
       EXISTS(SELECT 1 FROM student_profiles sp WHERE sp.institution_id=$1 AND sp.student_number=$2 AND sp.person_id <> $3) AS separate_from_admin`,
      [admin.rows[0].institution_id, UAT_STUDENTS[0].studentNumber, admin.rows[0].person_id],
    );
    const row = fixture.rows[0];
    if (!row?.active_profile || !row.active_enrollment || !row.active_placement || !row.document_metadata || !row.separate_from_admin || Number(row.history_count) < 1) {
      throw new Error('The canonical Student fixture is missing. Restore it through the approved UAT fixture procedure; bootstrap never invents a browser or legacy Student authority.');
    }
    const allFixtures = await pool.query<{ student_number: string; history_count: string; guardian_count: string }>(
      `SELECT sp.student_number,
       (SELECT count(*) FROM student_academic_placements pl JOIN academic_years y ON y.id=pl.academic_year_id AND y.institution_id=pl.institution_id WHERE pl.institution_id=$1 AND pl.student_person_id=sp.person_id AND NOT(pl.status='active' AND y.status='active')) AS history_count,
       (SELECT count(*) FROM guardian_relationships g WHERE g.institution_id=$1 AND g.student_person_id=sp.person_id) AS guardian_count
       FROM student_profiles sp WHERE sp.institution_id=$1 AND sp.student_number = ANY($2::text[])`,
      [admin.rows[0].institution_id, UAT_STUDENTS.map((item) => item.studentNumber)],
    );
    if (allFixtures.rowCount !== UAT_STUDENTS.length || allFixtures.rows.some((item) => Number(item.history_count) < 1 || Number(item.guardian_count) < 1)) throw new Error('The two canonical Student fixtures are incomplete. Restore them through the approved UAT fixture procedure.');
    console.log(JSON.stringify({ target: 'approved-local-postgres', migrations: 'verified', firebaseIdentity: 'canonical', institutionalContext: 'active', studentFixture: 'current-and-history-ready', fixtures: 2 }));
  } finally { await pool.end(); }
}

main().catch((error) => { console.error('[NEXUS-UAT-BOOTSTRAP]', error instanceof Error ? error.message : error); process.exitCode = 1; });
