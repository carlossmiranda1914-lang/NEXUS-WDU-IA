import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { readApprovedTestTarget, verifyApprovedTestConnection } from './nexus-test-db-safety.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../.env.test.local'), override: false, quiet: true });

const { target, connectionString } = readApprovedTestTarget();
if (target.database !== 'nexus_fnd01_test' || target.host !== '127.0.0.1' || target.port !== '54329') {
  throw new Error('Refusing reset outside the approved disposable FND-01 target.');
}
if (process.env.TEST_DATABASE_CONFIRMATION !== 'NEXUS_TEST_DATABASE') {
  throw new Error('Explicit disposable-database confirmation is required.');
}

const migrationsDirectory = path.resolve(directory, '../src/db/migrations');
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 7000 });

async function forensicSummary() {
  const [ledger, relations, incompleteOwnership] = await Promise.all([
    client.query('SELECT filename, checksum FROM nexus_schema_migrations ORDER BY filename').catch(() => ({ rows: [] })),
    client.query("SELECT count(*)::int AS count FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'"),
    client.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'school_tasks' AND column_name IN ('tenant_id', 'school_id', 'organization_id')"),
  ]);
  return {
    timestamp: new Date().toISOString(),
    target: { host: target.host, port: target.port, database: target.database },
    ledger: ledger.rows.map((row) => ({ filename: row.filename, checksum: row.checksum })),
    relationCount: relations.rows[0]?.count ?? 0,
    ownershipColumnCount: incompleteOwnership.rows[0]?.count ?? 0,
  };
}

try {
  await verifyApprovedTestConnection();
  await client.connect();
  const sessions = await client.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()');
  if (sessions.rows[0]?.count !== 0) throw new Error('Refusing reset: unexpected active sessions in approved disposable database.');
  console.log(`[FND-01-RESET] FORENSIC ${JSON.stringify(await forensicSummary())}`);

  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
  await client.query('SET search_path TO public');
  const migrations = await discoverMigrations(migrationsDirectory);
  await runMigrations(client, migrations);
  const [ledger, tasks] = await Promise.all([
    client.query('SELECT filename, checksum FROM nexus_schema_migrations ORDER BY filename'),
    client.query('SELECT count(*)::int AS count FROM school_tasks'),
  ]);
  if (ledger.rowCount !== migrations.length || tasks.rows[0]?.count !== 0) {
    throw new Error('Post-reset validation failed: canonical ledger or empty School Tasks target is not as expected.');
  }
  console.log(`[FND-01-RESET] PASS ${target.host}:${target.port}/${target.database}; ${ledger.rowCount} canonical migrations, empty school_tasks.`);
} finally {
  await client.end().catch(() => undefined);
}
