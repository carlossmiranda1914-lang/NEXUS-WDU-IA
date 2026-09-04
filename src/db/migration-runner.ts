import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const migrationFilenamePattern = /^(\d{4})_.+\.sql$/;

export interface MigrationFile {
  filename: string;
  sql: string;
  checksum: string;
}

export interface MigrationQueryClient {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

interface AppliedMigration {
  filename: string;
  checksum: string;
}

const migrationLedgerSql = `
  CREATE TABLE IF NOT EXISTS nexus_schema_migrations (
    filename TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

export function migrationChecksum(sql: string): string {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

export async function discoverMigrations(migrationsDirectory: string): Promise<MigrationFile[]> {
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => migrationFilenamePattern.test(filename))
    .sort();

  const seenOrders = new Set<string>();
  for (const filename of filenames) {
    const order = filename.slice(0, 4);
    if (seenOrders.has(order)) {
      throw new Error(`Migration order ${order} is ambiguous.`);
    }
    seenOrders.add(order);
  }

  return Promise.all(filenames.map(async (filename) => {
    const sql = await readFile(path.join(migrationsDirectory, filename), 'utf8');
    return { filename, sql, checksum: migrationChecksum(sql) };
  }));
}

export async function runMigrations(client: MigrationQueryClient, migrations: MigrationFile[]): Promise<string[]> {
  await client.query(migrationLedgerSql);

  const appliedResult = await client.query<AppliedMigration>(
    'SELECT filename, checksum FROM nexus_schema_migrations ORDER BY filename',
  );
  const available = new Map(migrations.map((migration) => [migration.filename, migration]));
  const applied = new Map(appliedResult.rows.map((migration) => [migration.filename, migration.checksum]));

  for (const [filename, checksum] of applied) {
    const current = available.get(filename);
    if (!current) {
      throw new Error(`Applied migration ${filename} is missing from the migration directory.`);
    }
    const rawChecksum = createHash('sha256').update(current.sql, 'utf8').digest('hex');
    const lfChecksum = createHash('sha256').update(current.sql.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
    if (checksum !== rawChecksum && checksum !== lfChecksum) {
      throw new Error(`Checksum mismatch for applied migration ${filename}. Migration history must not be rewritten.`);
    }
  }

  const appliedNow: string[] = [];
  for (const migration of migrations) {
    if (applied.has(migration.filename)) continue;

    await client.query('BEGIN');
    try {
      await client.query(migration.sql);
      await client.query(
        'INSERT INTO nexus_schema_migrations (filename, checksum) VALUES ($1, $2)',
        [migration.filename, migration.checksum],
      );
      await client.query('COMMIT');
      appliedNow.push(migration.filename);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${migration.filename} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return appliedNow;
}
