import dotenv from 'dotenv';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createTestDatabasePool } from '../src/db/test-database.ts';

dotenv.config();

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(currentDirectory, '../src/db/migrations');

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function verifyMigrationsIsolated(): Promise<void> {
  const pool = createTestDatabasePool();
  if (!pool) {
    throw new Error('TEST_DATABASE_URL is required to verify migrations.');
  }

  const schemaName = `nexus_verify_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const schemaIdentifier = quoteIdentifier(schemaName);
  const client = await pool.connect();

  try {
    await client.query(`CREATE SCHEMA ${schemaIdentifier}`);
    await client.query(`SET search_path TO ${schemaIdentifier}, public`);

    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();

    for (const filename of migrationFiles) {
      const sql = await readFile(path.join(migrationsDirectory, filename), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `Migration ${filename} failed in isolated schema: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const birthDate = await client.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = 'people'
         AND column_name = 'birth_date'`,
      [schemaName],
    );

    if (birthDate.rowCount !== 1) {
      throw new Error('Expected people.birth_date to exist exactly once after migrations.');
    }

    const column = birthDate.rows[0];
    if (column.data_type !== 'date' || column.is_nullable !== 'YES') {
      throw new Error(
        `Unexpected people.birth_date definition: data_type=${column.data_type}, is_nullable=${column.is_nullable}`,
      );
    }

    console.log(`[MIGRATION-VERIFY] PASS: ${migrationFiles.length} migrations applied in isolated schema.`);
    console.log('[MIGRATION-VERIFY] PASS: people.birth_date is DATE NULL.');
  } finally {
    try {
      await client.query('RESET search_path');
      await client.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`);
    } finally {
      client.release();
      await pool.end();
    }
  }
}

verifyMigrationsIsolated().catch((error) => {
  console.error('[MIGRATION-VERIFY]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
