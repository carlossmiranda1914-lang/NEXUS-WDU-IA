import dotenv from 'dotenv';
import pg from 'pg';
import { readApprovedTestTarget } from './nexus-test-db-safety.mjs';

dotenv.config();

const verifyTestDatabase = process.env.VERIFY_TEST_DATABASE === 'NEXUS_TEST_DATABASE';
const databaseUrl = verifyTestDatabase
  ? readApprovedTestTarget().connectionString
  : process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error(verifyTestDatabase
    ? 'TEST_DATABASE_URL is required for the test schema verification.'
    : 'DATABASE_URL is required for the read-only schema verification.');
}
if (verifyTestDatabase && databaseUrl === process.env.DATABASE_URL?.trim()) {
  throw new Error('Test schema verification must not use DATABASE_URL.');
}

const { Pool } = pg;
const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });

const requiredTables = [
  'institutions',
  'people',
  'identities',
  'memberships',
  'iam_access_intents',
  'iam_command_ledger',
  'iam_membership_events',
  'student_profiles',
  'guardian_relationships',
  'institution_resource_ownership',
  'operational_logs',
  'academic_years',
  'enrollment_offers',
  'enrollment_applications',
  'enrollment_documents',
  'enrollment_events',
];

const requiredColumns: Record<string, string[]> = {
  institutions: ['id', 'name', 'slug', 'status'],
  people: ['id', 'name'],
  identities: ['person_id', 'provider', 'provider_subject'],
  memberships: ['person_id', 'institution_id', 'role', 'status', 'version'],
  iam_access_intents: ['institution_id', 'kind', 'status', 'code_hash', 'code_expires_at', 'idempotency_key', 'request_fingerprint', 'version'],
  iam_command_ledger: ['institution_id', 'operation', 'actor_scope', 'idempotency_key', 'request_fingerprint', 'status'],
  iam_membership_events: ['institution_id', 'actor_type', 'action', 'result', 'created_at'],
  student_profiles: ['institution_id', 'person_id', 'public_ref', 'legacy_student_id'],
  guardian_relationships: ['institution_id', 'guardian_person_id', 'student_person_id'],
  institution_resource_ownership: ['institution_id', 'resource_type', 'resource_id'],
  operational_logs: ['institution_id', 'request_id', 'correlation_id', 'outcome', 'metadata'],
  academic_years: ['institution_id', 'name', 'starts_on', 'ends_on', 'status'],
  enrollment_offers: ['institution_id', 'academic_year_id', 'name', 'code', 'status'],
  enrollment_applications: ['institution_id', 'student_person_id', 'academic_year_id', 'offer_id', 'status'],
  enrollment_documents: ['institution_id', 'enrollment_application_id', 'document_type', 'status'],
  enrollment_events: ['institution_id', 'enrollment_application_id', 'actor_person_id', 'event_type'],
};

async function verifySchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [requiredTables],
    );
    const found = new Set(tables.rows.map((row) => row.table_name));
    const missingTables = requiredTables.filter((name) => !found.has(name));
    if (missingTables.length > 0) {
      throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
    }

    const columns = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [requiredTables],
    );
    const byTable = new Map<string, Set<string>>();
    for (const row of columns.rows) {
      const columnSet = byTable.get(row.table_name) ?? new Set<string>();
      columnSet.add(row.column_name);
      byTable.set(row.table_name, columnSet);
    }

    const missingColumns = Object.entries(requiredColumns).flatMap(([table, names]) =>
      names.filter((name) => !byTable.get(table)?.has(name)).map((name) => `${table}.${name}`),
    );
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    const activeMembershipUnique = await client.query<{ present: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_index
          WHERE indrelid = 'public.memberships'::regclass
            AND indisunique
            AND pg_get_expr(indpred, indrelid) LIKE '%status = ''active''%'
       ) AS present`,
    );
    if (!activeMembershipUnique.rows[0]?.present) {
      throw new Error('Missing unique partial index for active Membership per Person and Institution.');
    }

    await client.query('COMMIT');
    console.log(`Schema verification passed for ${requiredTables.length} vNext tables.`);
  } finally {
    client.release();
    await pool.end();
  }
}

verifySchema().catch((error) => {
  console.error('[SCHEMA-VERIFY]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
