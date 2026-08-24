import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

const target = await verifyApprovedTestConnection();
const schema = `nexus_cp2_${randomUUID().replaceAll('-', '')}`;
const directory = await mkdtemp(path.join(os.tmpdir(), 'nexus-cp2-'));
const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const client = new pg.Client({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 7000,
});

async function run() {
  return runMigrations(client, await discoverMigrations(directory));
}

try {
  await writeFile(path.join(directory, '0002_second.sql'), 'CREATE TABLE cp2_second (id integer PRIMARY KEY);');
  await writeFile(path.join(directory, '0001_first.sql'), 'CREATE TABLE cp2_first (id integer PRIMARY KEY);');

  await client.connect();
  await client.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);

  const firstApplied = await run();
  if (firstApplied.join(',') !== '0001_first.sql,0002_second.sql') {
    throw new Error(`Migration discovery/order is not deterministic: ${firstApplied.join(',')}`);
  }

  const ledger = await client.query(
    'SELECT filename, checksum, applied_at FROM nexus_schema_migrations ORDER BY filename',
  );
  if (ledger.rowCount !== 2) {
    throw new Error(`Expected 2 migration ledger rows; got ${ledger.rowCount}`);
  }
  if (!ledger.rows.every((row) => typeof row.checksum === 'string' && row.checksum.length === 64 && row.applied_at)) {
    throw new Error('Migration ledger metadata is incomplete.');
  }

  const secondApplied = await run();
  if (secondApplied.length !== 0) {
    throw new Error('Unchanged migration rerun was not pending-only/idempotent.');
  }

  await writeFile(
    path.join(directory, '0003_fail.sql'),
    'CREATE TABLE cp2_before_failure (id integer); SELECT invalid_cp2_sql;',
  );

  let sqlFailureObserved = false;
  try {
    await run();
  } catch {
    sqlFailureObserved = true;
  }
  if (!sqlFailureObserved) {
    throw new Error('Expected SQL migration failure was not observed.');
  }

  const failedLedger = await client.query(
    "SELECT 1 FROM nexus_schema_migrations WHERE filename = '0003_fail.sql'",
  );
  const rolledBackRelation = await client.query('SELECT to_regclass($1) AS relation', [
    `${schema}.cp2_before_failure`,
  ]);
  if (failedLedger.rowCount !== 0) {
    throw new Error('Failed migration was incorrectly recorded as applied.');
  }
  if (rolledBackRelation.rows[0]?.relation !== null) {
    throw new Error('Failed migration left persistent schema changes.');
  }

  await unlink(path.join(directory, '0003_fail.sql'));
  await writeFile(
    path.join(directory, '0001_first.sql'),
    'CREATE TABLE cp2_first (id integer PRIMARY KEY, changed boolean);',
  );
  await writeFile(
    path.join(directory, '0003_pending.sql'),
    'CREATE TABLE cp2_pending_after_t08 (id integer PRIMARY KEY);',
  );

  let checksumRejected = false;
  try {
    await run();
  } catch (error) {
    if (String(error?.message).includes('Checksum mismatch')) {
      checksumRejected = true;
    } else {
      throw error;
    }
  }
  if (!checksumRejected) {
    throw new Error('T08 failed: rewritten applied migration was not rejected.');
  }

  const pendingAfterT08 = await client.query('SELECT to_regclass($1) AS relation', [
    `${schema}.cp2_pending_after_t08`,
  ]);
  const ledgerAfterT08 = await client.query(
    'SELECT filename FROM nexus_schema_migrations ORDER BY filename',
  );
  if (pendingAfterT08.rows[0]?.relation !== null) {
    throw new Error('T08 failed: a pending migration executed after history mismatch was detected.');
  }
  if (ledgerAfterT08.rows.map((row) => row.filename).join(',') !== '0001_first.sql,0002_second.sql') {
    throw new Error('T08 checksum rejection changed the migration ledger.');
  }

  console.log(
    `[FND-01-CP2] PASS ${target.database}: ordering, ledger metadata, idempotency, rollback, failed-entry absence, T08 and T08-before-pending-mutation proven on PostgreSQL.`,
  );
} finally {
  await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`).catch(() => undefined);
  await client.end().catch(() => undefined);
  await rm(directory, { recursive: true, force: true });
}
