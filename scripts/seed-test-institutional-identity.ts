import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const [firebaseUid, email] = process.argv.slice(2);
const productionUrl = process.env.DATABASE_URL?.trim();
const testUrl = process.env.TEST_DATABASE_URL?.trim();

if (!firebaseUid || !email) {
  throw new Error('Usage: npm run test:identity -- <firebase-uid> <email>');
}
if (!testUrl || testUrl === productionUrl) {
  throw new Error('Refusing to seed identity: TEST_DATABASE_URL must exist and differ from DATABASE_URL.');
}

const pool = new pg.Pool({ connectionString: testUrl, connectionTimeoutMillis: 5000 });

async function seedTestIdentity() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const institution = await client.query<{ id: string }>(
      `INSERT INTO institutions (name, slug, status)
       VALUES ('TESTE — Nexus QA School', 'nexus-qa-test', 'active')
       ON CONFLICT (slug) DO UPDATE SET status = 'active'
       RETURNING id`,
    );
    const existingIdentity = await client.query<{ person_id: string }>(
      `SELECT person_id FROM identities WHERE provider = 'firebase' AND provider_subject = $1`, [firebaseUid],
    );
    const personId = existingIdentity.rowCount
      ? existingIdentity.rows[0].person_id
      : (await client.query<{ id: string }>(`INSERT INTO people (name) VALUES ('TESTE — Administrador') RETURNING id`)).rows[0].id;
    const identity = await client.query<{ person_id: string }>(
      `INSERT INTO identities (person_id, provider, provider_subject, email)
       VALUES ($1, 'firebase', $2, $3)
       ON CONFLICT (provider, provider_subject) DO UPDATE SET email = EXCLUDED.email, updated_at = now()
       RETURNING person_id`, [personId, firebaseUid, email.trim().toLowerCase()],
    );
    await client.query(
      `INSERT INTO memberships (person_id, institution_id, role, status, approved_by, approved_at)
       VALUES ($1, $2, 'institution_admin', 'active', $1, now())
       ON CONFLICT (person_id, institution_id, role) DO UPDATE SET status = 'active', approved_at = now(), revoked_at = null`,
      [identity.rows[0].person_id, institution.rows[0].id],
    );
    await client.query('COMMIT');
    console.log('Test institutional identity ready. No production database was changed.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedTestIdentity().catch((error) => {
  console.error('[TEST-IDENTITY]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
