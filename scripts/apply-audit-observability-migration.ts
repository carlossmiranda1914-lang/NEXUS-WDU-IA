import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

dotenv.config();

const confirmation = process.env.APPLY_AUDIT_MIGRATION;
const databaseUrl = process.env.DATABASE_URL?.trim();
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (confirmation !== 'NEXUS_APPLY_AUDIT_MIGRATION') {
  throw new Error('Explicit migration confirmation is required.');
}
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}
if (databaseUrl === testDatabaseUrl) {
  throw new Error('The audit migration must not use TEST_DATABASE_URL.');
}

const migrationPath = path.resolve('src/db/migrations/0005_vnext_audit_observability.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });

async function applyMigration(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(migrationSql);
    await client.query('COMMIT');
    console.log('Audit observability migration applied successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch((error) => {
  console.error('[AUDIT-MIGRATION]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
