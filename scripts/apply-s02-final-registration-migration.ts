import 'dotenv/config';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error('DATABASE_URL is required to apply the S02 final registration migration.');
}

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/db/migrations/0014_s02_final_registration_profile.sql',
);
const sql = await readFile(migrationPath, 'utf8');
const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');

  const verification = await client.query<{ people_columns: number; guardian_columns: number; enrollment_columns: number }>(`
    SELECT
      (SELECT count(*)::int FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'people' AND column_name IN ('email','whatsapp','national_id_number','gender','nationality','address_line','municipality','province')) AS people_columns,
      (SELECT count(*)::int FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'guardian_relationships' AND column_name IN ('is_primary','financial_responsible')) AS guardian_columns,
      (SELECT count(*)::int FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'enrollment_applications' AND column_name IN ('previous_school','enrollment_notes')) AS enrollment_columns
  `);
  const row = verification.rows[0];
  if (row.people_columns !== 8 || row.guardian_columns !== 2 || row.enrollment_columns !== 2) {
    throw new Error(`S02 final migration verification failed: people=${row.people_columns}, guardians=${row.guardian_columns}, enrollments=${row.enrollment_columns}.`);
  }
  console.log('[S02-FINAL-MIGRATION] applied and verified successfully.');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch { /* connection may already be closed */ }
  throw error;
} finally {
  await client.end();
}
