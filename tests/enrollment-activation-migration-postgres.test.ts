import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error('TEST_DATABASE_URL is required for enrollment activation migration test.');

const { Pool } = pg;
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const schemaName = `nexus_activation_migration_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const schemaIdentifier = `"${schemaName}"`;
const bootstrap = new Pool({ connectionString });
const pool = new Pool({ connectionString, options: `-c search_path=${schemaName},public` });
let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(message); }

try {
  await bootstrap.query(`CREATE SCHEMA ${schemaIdentifier}`);
  const migrations = (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  const migrationPool = new Pool({ connectionString, options: `-c search_path=${schemaName}` });
  try {
    for (const filename of migrations) await migrationPool.query(await readFile(path.join(migrationsDirectory, filename), 'utf8'));
  } finally {
    await migrationPool.end();
  }

  const columns = await pool.query<{ table_name: string; column_name: string; is_nullable: string; data_type: string }>(
    `SELECT table_name, column_name, is_nullable, data_type
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND (table_name = 'enrollment_applications' AND column_name = 'lifecycle_version'
          OR table_name = 'enrollment_events' AND column_name IN ('actor_kind', 'correlation_id'))
      ORDER BY table_name, column_name`,
  );
  assert(columns.rows.some((row) => row.table_name === 'enrollment_applications' && row.column_name === 'lifecycle_version' && row.data_type === 'bigint' && row.is_nullable === 'NO'), 'Migration must add non-null bigint enrollment lifecycle_version.');
  assert(columns.rows.some((row) => row.table_name === 'enrollment_events' && row.column_name === 'actor_kind' && row.is_nullable === 'NO'), 'Migration must add non-null factual event actor_kind.');
  assert(columns.rows.some((row) => row.table_name === 'enrollment_events' && row.column_name === 'correlation_id'), 'Migration must add optional correlation_id.');

  const ledger = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'enrollment_activation_commands'`,
  );
  assert(ledger.rowCount === 1, 'Migration must add the activation idempotency ledger.');

  const checks = await pool.query<{ conname: string }>(
    `SELECT conname FROM pg_constraint WHERE connamespace = current_schema()::regnamespace AND conname IN ('enrollment_events_actor_kind_valid', 'enrollment_events_actor_consistent', 'enrollment_applications_lifecycle_version_valid')`,
  );
  assert(checks.rowCount === 3, 'Migration must protect lifecycle version and factual actor consistency with constraints.');

  console.log(`[ENROLLMENT-ACTIVATION-MIGRATION-POSTGRES] passed (${assertions} assertions).`);
} finally {
  await pool.end().catch(() => undefined);
  await bootstrap.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`);
  await bootstrap.end();
}
