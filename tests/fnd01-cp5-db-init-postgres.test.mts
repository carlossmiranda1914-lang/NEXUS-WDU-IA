import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env.test.local'), override: true, quiet: true });
const target = await verifyApprovedTestConnection();
const testUrl = process.env.TEST_DATABASE_URL!;
const parsed = new URL(testUrl);
const schema = `nexus_cp5_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
delete process.env.DATABASE_URL;
process.env.SQL_HOST = parsed.hostname;
process.env.SQL_PORT = parsed.port || '5432';
process.env.SQL_USER = decodeURIComponent(parsed.username);
process.env.SQL_PASSWORD = decodeURIComponent(parsed.password);
process.env.SQL_DB_NAME = decodeURIComponent(parsed.pathname.slice(1));
process.env.SQL_OPTIONS = `-c search_path=${schema}`;

const pool = new pg.Pool({ connectionString: testUrl, connectionTimeoutMillis: 7000 });
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

async function fingerprint(client: pg.PoolClient): Promise<string> {
  const result = await client.query(`
    SELECT coalesce(string_agg(value, E'\n' ORDER BY value), '') AS value
    FROM (
      SELECT c.relkind::text || ':' || c.relname AS value
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'i')
      UNION ALL
      SELECT 'ledger:' || filename || ':' || checksum FROM nexus_schema_migrations
    ) entries`);
  return result.rows[0]?.value ?? '';
}

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}`);
    await runMigrations(client, await discoverMigrations(migrationsDirectory));
    const { initializeDatabase } = await import('../src/db/init.ts');
    const before = await fingerprint(client);
    await initializeDatabase();
    const afterFirst = await fingerprint(client);
    await initializeDatabase();
    const afterSecond = await fingerprint(client);
    assert(before === afterFirst && afterFirst === afterSecond, 'Validation-only restart changed migration-owned schema.');

    await client.query('DROP TABLE task_versions');
    let missingRejected = false;
    try { await initializeDatabase(); } catch (error) { missingRejected = String(error).includes('task_versions'); }
    assert(missingRejected, 'Missing migration-owned relation must fail closed.');
    const absent = await client.query("SELECT to_regclass(current_schema() || '.task_versions') AS relation");
    assert(absent.rows[0]?.relation === null, 'Startup must not recreate missing schema.');
    console.log(`[FND-01-CP5] PASS ${target.database}: validation-only startup is read-only and missing schema fails closed.`);
  } finally { client.release(); }
} finally {
  const { pool: dbPool } = await import('../src/db/index.ts').catch(() => ({ pool: undefined }));
  await dbPool?.end().catch(() => undefined);
  const client = await pool.connect().catch(() => undefined);
  if (client) { try { await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); } finally { client.release(); } }
  await pool.end();
}
