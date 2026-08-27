import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { readApprovedTestTarget } from './nexus-test-db-safety.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(currentDirectory, '../src/db/migrations');

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function verifyMigrationsIsolated(): Promise<void> {
  const { connectionString } = readApprovedTestTarget();
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });

  const schemaName = `nexus_verify_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const schemaIdentifier = quoteIdentifier(schemaName);
  const client = await pool.connect();

  try {
    await client.query(`CREATE SCHEMA ${schemaIdentifier}`);
    await client.query(`SET search_path TO ${schemaIdentifier}`);

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
        throw new Error(`Migration ${filename} failed in isolated schema: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const birthDate = await client.query<{ data_type: string; is_nullable: string }>(
      `SELECT data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'people' AND column_name = 'birth_date'`,
      [schemaName],
    );
    if (birthDate.rowCount !== 1 || birthDate.rows[0].data_type !== 'date' || birthDate.rows[0].is_nullable !== 'YES') {
      throw new Error('Expected people.birth_date to be DATE NULL after migrations.');
    }

    const commandTable = await client.query<{ constraint_name: string }>(
      `SELECT tc.constraint_name
         FROM information_schema.table_constraints tc
        WHERE tc.table_schema = $1
          AND tc.table_name = 'enrollment_intake_commands'
          AND tc.constraint_type = 'UNIQUE'
          AND tc.constraint_name = 'enrollment_intake_commands_institution_operation_key_unique'`,
      [schemaName],
    );
    if (commandTable.rowCount !== 1) {
      throw new Error('Expected enrollment_intake_commands institutional idempotency unique constraint.');
    }

    const fingerprintColumn = await client.query<{ is_nullable: string }>(
      `SELECT is_nullable
         FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = 'enrollment_intake_commands'
          AND column_name = 'request_fingerprint'`,
      [schemaName],
    );
    if (fingerprintColumn.rowCount !== 1 || fingerprintColumn.rows[0].is_nullable !== 'NO') {
      throw new Error('Expected enrollment_intake_commands.request_fingerprint to be NOT NULL.');
    }

    const identityDecisionCaseUnique = await client.query<{ constraint_name: string }>(
      `SELECT tc.constraint_name
         FROM information_schema.table_constraints tc
        WHERE tc.table_schema = $1
          AND tc.table_name = 'identity_resolution_decisions'
          AND tc.constraint_type = 'UNIQUE'
          AND tc.constraint_name = 'identity_resolution_decisions_case_unique'`,
      [schemaName],
    );
    if (identityDecisionCaseUnique.rowCount !== 1) {
      throw new Error('Expected identity resolution case uniqueness per institution.');
    }

    const activeMembershipUnique = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = $1
          AND tablename = 'memberships'
          AND indexname = 'memberships_one_active_per_person_institution_unique'`,
      [schemaName],
    );
    if (activeMembershipUnique.rowCount !== 1) {
      throw new Error('Expected IAM unique partial active Membership index.');
    }

    const iamTables = ['iam_access_intents', 'iam_command_ledger', 'iam_membership_events'];
    const iamTableResult = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = ANY($2::text[])`,
      [schemaName, iamTables],
    );
    if (iamTableResult.rowCount !== iamTables.length) {
      throw new Error('Expected all IAM-01 migration tables.');
    }

    const identityDecisionSegregation = await client.query<{ constraint_name: string }>(
      `SELECT tc.constraint_name
         FROM information_schema.table_constraints tc
        WHERE tc.table_schema = $1
          AND tc.table_name = 'identity_resolution_decisions'
          AND tc.constraint_type = 'CHECK'
          AND tc.constraint_name = 'identity_resolution_decisions_segregation'`,
      [schemaName],
    );
    if (identityDecisionSegregation.rowCount !== 1) {
      throw new Error('Expected identity resolution segregation-of-duties constraint.');
    }

    const decidedByColumn = await client.query<{ is_nullable: string }>(
      `SELECT is_nullable
         FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = 'identity_resolution_decisions'
          AND column_name = 'decided_by_person_id'`,
      [schemaName],
    );
    if (decidedByColumn.rowCount !== 1 || decidedByColumn.rows[0].is_nullable !== 'YES') {
      throw new Error('Expected nullable decided_by_person_id audit column.');
    }

    const legacyCompatibilityTables = [
      'users', 'students', 'teachers', 'invoices', 'announcements',
      'chat_messages', 'automations', 'uploaded_documents', 'approvals',
    ];
    const legacyTables = await client.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = ANY($2::text[])`,
      [schemaName, legacyCompatibilityTables],
    );
    if (legacyTables.rowCount !== legacyCompatibilityTables.length) {
      throw new Error('Expected all active legacy compatibility tables after migration-only bootstrap.');
    }
    const requiredLegacyColumns: Record<string, string[]> = {
      users: ['uid', 'email', 'status', 'last_access'],
      students: ['class', 'attendance_rate', 'average_grade', 'outstanding_fees', 'documents', 'behavior_history', 'grades'],
      teachers: ['email', 'subjects', 'classes', 'schedule', 'documents'],
      invoices: ['student_id', 'student_name', 'amount', 'due_date', 'category'],
      announcements: ['author', 'role', 'date', 'target'],
      chat_messages: ['sender', 'role', 'content', 'timestamp', 'channel'],
      automations: ['trigger', 'action', 'active', 'type', 'executions'],
      uploaded_documents: ['name', 'type', 'extracted_details', 'status'],
      approvals: ['flow_type', 'requester_role', 'created_at_date', 'history'],
    };
    for (const [table, columns] of Object.entries(requiredLegacyColumns)) {
      const found = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2 AND column_name = ANY($3::text[])`,
        [schemaName, table, columns],
      );
      if (found.rowCount !== columns.length) throw new Error(`Expected active consumer columns for legacy ${table}.`);
    }

    console.log(`[MIGRATION-VERIFY] PASS: ${migrationFiles.length} migrations applied in isolated schema.`);
    console.log('[MIGRATION-VERIFY] PASS: people.birth_date is DATE NULL.');
    console.log('[MIGRATION-VERIFY] PASS: enrollment_intake_commands idempotency constraints are present.');
    console.log('[MIGRATION-VERIFY] PASS: identity_resolution_decisions authority/audit constraints are present.');
    console.log('[MIGRATION-VERIFY] PASS: IAM active Membership uniqueness and tables are migration-owned.');
    console.log('[MIGRATION-VERIFY] PASS: CP3 active legacy compatibility tables are migration-owned.');
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
