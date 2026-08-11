import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for the read-only schema verification.');
}

const { Pool } = pg;
const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });

const requiredTables = [
  'institutions',
  'people',
  'identities',
  'memberships',
  'student_profiles',
  'guardian_relationships',
  'institution_resource_ownership',
];

const requiredColumns: Record<string, string[]> = {
  institutions: ['id', 'name', 'slug', 'status'],
  people: ['id', 'name'],
  identities: ['person_id', 'provider', 'provider_subject'],
  memberships: ['person_id', 'institution_id', 'role', 'status'],
  student_profiles: ['institution_id', 'person_id', 'legacy_student_id'],
  guardian_relationships: ['institution_id', 'guardian_person_id', 'student_person_id'],
  institution_resource_ownership: ['institution_id', 'resource_type', 'resource_id'],
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

    await client.query('ROLLBACK');
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
