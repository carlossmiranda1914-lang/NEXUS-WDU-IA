import 'dotenv/config';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error('DATABASE_URL is required to apply the S03 process migration.');
const migrationPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations/0016_s03_enrollment_process_persistence.sql');
const sql = await readFile(migrationPath, 'utf8');
const client = new pg.Client({ connectionString });

async function verify() {
  const result = await client.query<{ process_count: number; application_count: number; invalid_scope_count: number }>(`
    SELECT
      (SELECT count(*)::int FROM enrollment_processes) AS process_count,
      (SELECT count(*)::int FROM enrollment_applications) AS application_count,
      (SELECT count(*)::int
         FROM enrollment_processes p
         JOIN enrollment_applications e ON e.id = p.enrollment_application_id
        WHERE p.institution_id <> e.institution_id) AS invalid_scope_count
  `);
  const row = result.rows[0];
  if (row.process_count !== row.application_count || row.invalid_scope_count !== 0) {
    throw new Error(`S03 migration verification failed: processes=${row.process_count}, applications=${row.application_count}, invalidScope=${row.invalid_scope_count}.`);
  }
  console.log(`[S03-MIGRATION] verified: ${row.process_count} process row(s), 1:1 and institution-scoped.`);
}

try {
  await client.connect();
  await client.query('SELECT pg_advisory_lock(hashtext($1))', ['nexus:s03:process-migration']);
  const exists = await client.query<{ present: boolean }>("SELECT to_regclass(current_schema() || '.enrollment_processes') IS NOT NULL AS present");
  if (!exists.rows[0].present) {
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log('[S03-MIGRATION] applied 0016_s03_enrollment_process_persistence.sql.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } else {
    console.log('[S03-MIGRATION] already applied; verifying existing schema.');
  }
  await verify();
} finally {
  try { await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['nexus:s03:process-migration']); } catch { /* connection may not be available */ }
  await client.end();
}
