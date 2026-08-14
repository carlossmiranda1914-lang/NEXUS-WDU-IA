import 'dotenv/config';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectS02Schema } from './nexus-db-schema-contract.mjs';

const targetArgument = process.argv.find((value) => value.startsWith('--target='));
const target = targetArgument?.slice('--target='.length);
if (!['DATABASE_URL', 'TEST_DATABASE_URL'].includes(target)) {
  throw new Error('An explicit --target=DATABASE_URL or --target=TEST_DATABASE_URL is required.');
}
const connectionString = process.env[target]?.trim();
if (!connectionString) throw new Error(`${target} is required for S02 schema reconciliation.`);

if (target === 'TEST_DATABASE_URL') {
  if (process.env.TEST_DATABASE_CONFIRMATION !== 'NEXUS_TEST_DATABASE') {
    throw new Error('Set TEST_DATABASE_CONFIRMATION=NEXUS_TEST_DATABASE before mutating the test database.');
  }
  if (connectionString === process.env.DATABASE_URL?.trim()) {
    throw new Error('TEST_DATABASE_URL must never be the same as DATABASE_URL.');
  }
}

const allowOperational = process.argv.includes('--allow-operational');
const databaseConfirmationArgument = process.argv.find((value) => value.startsWith('--confirm-database='));
const confirmedDatabase = databaseConfirmationArgument?.slice('--confirm-database='.length);
if (target === 'DATABASE_URL' && (!allowOperational || !confirmedDatabase)) {
  throw new Error('Operational reconciliation requires --allow-operational and --confirm-database=<exact database name>.');
}

const migrationsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/db/migrations',
);
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 7000 });

async function hasColumn(table, column) {
  const result = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return Boolean(result.rowCount);
}

async function hasTable(table) {
  const result = await client.query(
    `SELECT to_regclass(format('%I.%I', current_schema(), $1::text)) IS NOT NULL AS present`,
    [table],
  );
  return result.rows[0].present;
}

async function hasIndex(index) {
  const result = await client.query(
    `SELECT to_regclass(format('%I.%I', current_schema(), $1::text)) IS NOT NULL AS present`,
    [index],
  );
  return result.rows[0].present;
}

const migrations = [
  ['0008_vnext_enrollment_intake_idempotency.sql', async () => hasTable('enrollment_intake_commands')],
  ['0009_vnext_identity_resolution_decisions.sql', async () => hasTable('identity_resolution_decisions')],
  ['0010_academic_year_active_uniqueness.sql', async () => hasIndex('academic_years_one_active_per_institution_unique')],
  ['0011_enrollment_document_policy_versions.sql', async () => {
    const states = await Promise.all([
      hasTable('enrollment_document_policies'),
      hasTable('enrollment_document_requirements'),
    ]);
    if (states[0] !== states[1]) throw new Error('Partial migration 0011 detected; manual reconciliation is required.');
    return states[0];
  }],
  ['0012_enrollment_application_document_policy_snapshot.sql', async () => {
    const states = await Promise.all([
      hasColumn('enrollment_applications', 'document_policy_id'),
      hasColumn('enrollment_applications', 'document_policy_captured_at'),
    ]);
    if (states[0] !== states[1]) throw new Error('Partial migration 0012 detected; manual reconciliation is required.');
    return states[0];
  }],
  ['0013_enrollment_document_requirement_snapshot.sql', async () => {
    const states = await Promise.all([
      hasColumn('enrollment_documents', 'required'),
      hasColumn('enrollment_documents', 'source_requirement_id'),
    ]);
    if (states[0] !== states[1]) throw new Error('Partial migration 0013 detected; manual reconciliation is required.');
    return states[0];
  }],
  // 0014 is intentionally repeatable and also repairs partial application.
  ['0014_s02_final_registration_profile.sql', async () => false],
  // 0015 is the forward-only repair for environments that missed historical 0007.
  ['0015_s02_existing_student_schema_reconciliation.sql', async () => hasColumn('people', 'birth_date')],
];

try {
  await client.connect();
  const identity = await client.query('SELECT current_database() AS database_name, current_schema() AS schema_name');
  const databaseName = identity.rows[0]?.database_name;
  const schemaName = identity.rows[0]?.schema_name;
  if (target === 'DATABASE_URL' && confirmedDatabase !== databaseName) {
    throw new Error(`Operational database confirmation mismatch: connected to ${databaseName}.`);
  }
  console.log(`[S02-SCHEMA] TARGET ${target}: database=${databaseName}; schema=${schemaName}.`);
  for (const [filename, alreadyApplied] of migrations) {
    if (await alreadyApplied()) {
      console.log(`[S02-SCHEMA] SKIP ${filename}: compatible object already present.`);
      continue;
    }
    const sql = await readFile(path.join(migrationsDirectory, filename), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`[S02-SCHEMA] APPLY ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  const missing = await inspectS02Schema(client);
  if (missing.length) throw new Error(`S02 schema remains incomplete: ${missing.join(', ')}`);
  console.log(`[S02-SCHEMA] PASS ${target}: operational schema reconciled.`);
} finally {
  await client.end().catch(() => undefined);
}
