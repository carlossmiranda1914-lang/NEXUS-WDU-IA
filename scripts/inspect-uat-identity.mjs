import { readApprovedTestTarget } from './nexus-test-db-safety.mjs';
import pg from 'pg';

const { connectionString } = readApprovedTestTarget();
const pool = new pg.Pool({ connectionString });
try {
  const uid = process.env.NEXUS_UAT_FIREBASE_UID;
  console.log('Checking NEXUS_UAT_FIREBASE_UID:', uid);
  const r = await pool.query(
    `SELECT i.id as identity_id, i.provider_subject, p.id as person_id, p.name as person_name,
            m.institution_id, m.role, m.status, inst.name as inst_name
     FROM identities i
     JOIN people p ON p.id = i.person_id
     LEFT JOIN memberships m ON m.person_id = p.id
     LEFT JOIN institutions inst ON inst.id = m.institution_id
     WHERE i.provider_subject = $1`,
    [uid]
  );
  console.log('Result:', JSON.stringify(r.rows, null, 2));

  // Check enrollment applications in that institution
  if (r.rows[0]?.institution_id) {
    const apps = await pool.query(
      `SELECT e.id, p.name as student_name, e.status, o.name as offer_name
       FROM enrollment_applications e
       JOIN people p ON p.id = e.student_person_id
       LEFT JOIN enrollment_offers o ON o.id = e.offer_id
       WHERE e.institution_id = $1 LIMIT 5`,
      [r.rows[0].institution_id]
    );
    console.log('Enrollment applications in institution:', apps.rows);

    const docs = await pool.query(
      `SELECT d.id, d.category, d.status, v.id as version_id, v.version_number
       FROM documents d
       LEFT JOIN document_versions v ON v.document_id = d.id
       WHERE d.institution_id = $1 LIMIT 5`,
      [r.rows[0].institution_id]
    );
    console.log('Documents in institution:', docs.rows);
  }
} finally {
  await pool.end();
}
