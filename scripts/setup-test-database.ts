import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestDatabasePool } from '../src/db/test-database.ts';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDirectory, '../.env.test.local'), override: true, quiet: true });
const migrationsDirectory = path.resolve(currentDirectory, '../src/db/migrations');

async function setupTestDatabase(): Promise<void> {
  const pool = createTestDatabasePool();
  if (!pool) {
    throw new Error('TEST_DATABASE_URL is required to initialize the test database.');
  }

  const client = await pool.connect();
  try {
    const migrations = await discoverMigrations(migrationsDirectory);
    await runMigrations(client, migrations);
    console.log(`Test database ready with ${migrations.length} canonical migrations.`);
  } finally {
    client.release();
    await pool.end();
  }
}

setupTestDatabase().catch((error) => {
  console.error('[TEST-DB-SETUP]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
