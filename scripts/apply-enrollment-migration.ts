import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL?.trim();
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (process.env.APPLY_ENROLLMENT_MIGRATION !== 'NEXUS_APPLY_ENROLLMENT_MIGRATION') throw new Error('Explicit enrollment migration confirmation is required.');
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
if (databaseUrl === testDatabaseUrl) throw new Error('The enrollment migration must not use TEST_DATABASE_URL.');

const migrationSql = fs.readFileSync(path.resolve('src/db/migrations/0006_vnext_enrollment_student360.sql'), 'utf8');
const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });

async function applyMigration() {
  const client = await pool.connect();
  try { await client.query('BEGIN'); await client.query(migrationSql); await client.query('COMMIT'); console.log('Enrollment migration applied successfully.'); }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
applyMigration().catch((error) => { console.error('[ENROLLMENT-MIGRATION]', error instanceof Error ? error.message : error); process.exitCode = 1; });
