import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error('TEST_DATABASE_URL is required for ENROLLMENT-01 PostgreSQL tests.');

const schema = `nexus_enrollment01_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const quote = `"${schema}"`;
const bootstrap = new pg.Pool({ connectionString });
await bootstrap.query(`CREATE SCHEMA ${quote}`);
const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema},public` });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

try {
  const migrations = (await readdir(migrationsDir)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const migration of migrations) await pool.query(await readFile(path.join(migrationsDir, migration), 'utf8'));

  const result = await pool.query<{ table_name: string; column_name: string; data_type: string }>(
    `SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND ((table_name = 'people' AND column_name = 'version')
         OR (table_name = 'enrollment_applications' AND column_name = 'registration_version')
        )
      ORDER BY table_name, column_name`,
  );
  const expected = [
    { table_name: 'enrollment_applications', column_name: 'registration_version', data_type: 'bigint' },
    { table_name: 'people', column_name: 'version', data_type: 'bigint' },
  ];
  if (JSON.stringify(result.rows) !== JSON.stringify(expected)) {
    throw new Error(`ENROLLMENT-01 version authority missing: ${JSON.stringify(result.rows)}`);
  }

  console.log('[ENROLLMENT-01-POSTGRES] version authority: PASS.');
} finally {
  await pool.end();
  await bootstrap.query(`DROP SCHEMA IF EXISTS ${quote} CASCADE`);
  await bootstrap.end();
}
