import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { discoverMigrations, migrationChecksum, runMigrations, type MigrationFile, type MigrationQueryClient } from '../src/db/migration-runner.ts';

class FakeMigrationClient implements MigrationQueryClient {
  readonly calls: string[] = [];
  readonly ledger = new Map<string, string>();
  failSql: string | null = null;

  async query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
    this.calls.push(text);
    if (text.startsWith('SELECT filename')) {
      return { rows: [...this.ledger].map(([filename, checksum]) => ({ filename, checksum }) as T), rowCount: this.ledger.size };
    }
    if (this.failSql === text) throw new Error('simulated SQL failure');
    if (text.startsWith('INSERT INTO nexus_schema_migrations')) {
      this.ledger.set(values![0] as string, values![1] as string);
    }
    return { rows: [], rowCount: 0 };
  }
}

function migration(filename: string, sql: string): MigrationFile {
  return { filename, sql, checksum: migrationChecksum(sql) };
}

test('discovers only valid migration filenames in lexical order', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'nexus-migration-runner-'));
  try {
    await Promise.all([
      writeFile(path.join(directory, '0010_later.sql'), 'SELECT 10'),
      writeFile(path.join(directory, '0002_earlier.sql'), 'SELECT 2'),
      writeFile(path.join(directory, 'notes.sql'), 'SELECT 0'),
    ]);

    assert.deepEqual((await discoverMigrations(directory)).map((entry) => entry.filename), [
      '0002_earlier.sql',
      '0010_later.sql',
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('applies only pending migrations in deterministic order and records checksums', async () => {
  const client = new FakeMigrationClient();
  const first = migration('0001_first.sql', 'SELECT 1');
  const second = migration('0002_second.sql', 'SELECT 2');

  assert.deepEqual(await runMigrations(client, [first, second]), ['0001_first.sql', '0002_second.sql']);
  assert.deepEqual([...client.ledger], [[first.filename, first.checksum], [second.filename, second.checksum]]);
  assert.deepEqual(await runMigrations(client, [first, second]), []);
  assert.equal(client.calls.filter((call) => call === 'BEGIN').length, 2);
  assert.equal(client.calls.filter((call) => call === 'COMMIT').length, 2);
});

test('T08 rejects an already-applied migration whose checksum changed', async () => {
  const client = new FakeMigrationClient();
  client.ledger.set('0001_first.sql', migrationChecksum('SELECT 1'));

  await assert.rejects(
    runMigrations(client, [migration('0001_first.sql', 'SELECT 1; -- rewritten')]),
    /Checksum mismatch.*must not be rewritten/,
  );
  assert.equal(client.calls.includes('BEGIN'), false);
});

test('rolls back and fails when migration SQL fails before ledger insertion', async () => {
  const client = new FakeMigrationClient();
  const broken = migration('0001_broken.sql', 'SELECT broken');
  client.failSql = broken.sql;

  await assert.rejects(runMigrations(client, [broken]), /Migration 0001_broken\.sql failed: simulated SQL failure/);
  assert.deepEqual(client.calls.slice(-2), [broken.sql, 'ROLLBACK']);
  assert.equal(client.ledger.size, 0);
});
