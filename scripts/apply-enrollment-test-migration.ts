import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

dotenv.config();

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (process.env.TEST_DATABASE_CONFIRMATION !== 'NEXUS_TEST_DATABASE') throw new Error('Explicit test database confirmation is required.');
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
if (testDatabaseUrl === process.env.DATABASE_URL?.trim()) throw new Error('TEST_DATABASE_URL must never be DATABASE_URL.');

const migrationSql = fs.readFileSync(path.resolve('src/db/migrations/0006_vnext_enrollment_student360.sql'), 'utf8');
const pool = new pg.Pool({ connectionString: testDatabaseUrl, connectionTimeoutMillis: 5000 });

async function applyTestMigration() {
  const client = await pool.connect();
  try { await client.query('BEGIN'); await client.query(migrationSql); await client.query('COMMIT'); console.log('Enrollment migration applied to TEST_DATABASE_URL.'); }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
applyTestMigration().catch((error) => { console.error('[ENROLLMENT-TEST-MIGRATION]', error instanceof Error ? error.message : error); process.exitCode = 1; });
