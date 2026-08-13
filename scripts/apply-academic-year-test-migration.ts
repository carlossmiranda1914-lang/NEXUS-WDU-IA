import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createTestDatabasePool } from '../src/db/test-database.ts';

const pool = createTestDatabasePool();
if (!pool) throw new Error('TEST_DATABASE_URL is required.');

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(currentDirectory, '../src/db/migrations/0010_academic_year_active_uniqueness.sql');
const sql = await readFile(migrationPath, 'utf8');
const client = await pool.connect();

try {
  const existing = await client.query(
    `SELECT 1 FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = 'academic_years_one_active_per_institution_unique'`,
  );

  if (existing.rowCount) {
    console.log('[AY-TEST-MIGRATION] already applied.');
  } else {
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log('[AY-TEST-MIGRATION] applied 0010_academic_year_active_uniqueness.sql.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
