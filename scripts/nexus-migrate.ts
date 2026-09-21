import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';

dotenv.config();
if (process.env.TEST_DATABASE_LOCAL_AUTHORIZED === 'true') {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(currentDirectory, '../.env.test.local'), override: true, quiet: true });
}

const targetArgument = process.argv.find((argument) => argument.startsWith('--target='));
const targetName = targetArgument?.slice('--target='.length) || 'DATABASE_URL';
if (!/^[A-Z][A-Z0-9_]*$/.test(targetName)) {
  throw new Error('Migration target must be an environment variable name.');
}

const connectionString = process.env[targetName]?.trim();
if (!connectionString) {
  throw new Error(`${targetName} is required for nexus:migrate.`);
}

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(currentDirectory, '../src/db/migrations');
const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });

async function main(): Promise<void> {
  const migrations = await discoverMigrations(migrationsDirectory);
  const client = await pool.connect();
  try {
    const applied = await runMigrations(client, migrations);
    console.log(`[NEXUS-MIGRATE] PASS: ${applied.length} migration(s) applied; ${migrations.length} discovered.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[NEXUS-MIGRATE]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
