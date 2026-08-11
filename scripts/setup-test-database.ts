import dotenv from 'dotenv';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestDatabasePool } from '../src/db/test-database.ts';

dotenv.config();

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(currentDirectory, '../src/db/migrations');

const legacyTestSchema = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uid TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    phone TEXT,
    department TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    last_access TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS school_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    assigned_to TEXT NOT NULL DEFAULT 'Não atribuído',
    department TEXT NOT NULL DEFAULT 'Secretaria',
    priority TEXT NOT NULL DEFAULT 'Normal',
    status TEXT NOT NULL DEFAULT 'Pendente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date DATE NOT NULL,
    limit_date DATE NOT NULL,
    created_automatically BOOLEAN DEFAULT false,
    reference_id TEXT,
    reference_type TEXT,
    observations TEXT,
    history JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    executed_by TEXT,
    completed_by TEXT,
    completed_at TIMESTAMPTZ,
    dependencies JSONB DEFAULT '[]'::jsonb,
    is_deleted BOOLEAN DEFAULT false NOT NULL,
    deleted_at TIMESTAMPTZ,
    deleted_by TEXT,
    started_at TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,
    sla_deadline TIMESTAMPTZ,
    sla_status TEXT DEFAULT 'On Track',
    tenant_id TEXT NOT NULL DEFAULT 'default-tenant',
    school_id TEXT NOT NULL DEFAULT 'default-school',
    organization_id TEXT NOT NULL DEFAULT 'default-org'
  );
`;

async function setupTestDatabase(): Promise<void> {
  const pool = createTestDatabasePool();
  if (!pool) {
    throw new Error('TEST_DATABASE_URL is required to initialize the test database.');
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS nexus_schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();

    for (const filename of migrationFiles) {
      const alreadyApplied = await client.query(
        'SELECT 1 FROM nexus_schema_migrations WHERE filename = $1',
        [filename],
      );
      if (alreadyApplied.rowCount) continue;

      const sql = await readFile(path.join(migrationsDirectory, filename), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO nexus_schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    await client.query(legacyTestSchema);
    console.log(`Test database ready with ${migrationFiles.length} vNext migrations.`);
  } finally {
    client.release();
    await pool.end();
  }
}

setupTestDatabase().catch((error) => {
  console.error('[TEST-DB-SETUP]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
