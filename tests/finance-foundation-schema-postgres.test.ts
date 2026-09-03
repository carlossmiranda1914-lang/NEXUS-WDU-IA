import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_schema_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 7000 });
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const expectedTables = [
  'finance_profile_versions', 'finance_journal_transactions', 'finance_journal_entries',
  'finance_command_results', 'finance_audit_records', 'finance_outbox', 'finance_position_projection',
];

async function rejects(action: () => Promise<unknown>, message: string): Promise<void> {
  await assert.rejects(action, undefined, message);
}

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);
    await runMigrations(client, await discoverMigrations(migrationsDirectory));

    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = ANY($2::text[])`,
      [schema, expectedTables],
    );
    assert.equal(tables.rowCount, expectedTables.length, 'Finance foundation tables must be created by the canonical migration');

    const numeric = await client.query<{ numeric_precision: number; numeric_scale: number }>(
      `SELECT numeric_precision, numeric_scale FROM information_schema.columns
       WHERE table_schema=$1 AND table_name='finance_journal_entries' AND column_name='amount'`, [schema],
    );
    assert.deepEqual(numeric.rows[0], { numeric_precision: 30, numeric_scale: 12 });
    const rate = await client.query<{ numeric_precision: number; numeric_scale: number }>(
      `SELECT numeric_precision, numeric_scale FROM information_schema.columns
       WHERE table_schema=$1 AND table_name='finance_journal_transactions' AND column_name='exchange_rate'`, [schema],
    );
    assert.deepEqual(rate.rows[0], { numeric_precision: 30, numeric_scale: 18 });

    const institutionA = '00000000-0000-0000-0000-000000000001';
    const institutionB = '00000000-0000-0000-0000-000000000002';
    const transactionA = '00000000-0000-0000-0000-000000000011';
    const transactionB = '00000000-0000-0000-0000-000000000012';
    await client.query(`INSERT INTO institutions (id,name,slug,status) VALUES ($1,'A','finance-a','active'),($2,'B','finance-b','active')`, [institutionA, institutionB]);
    await client.query(`INSERT INTO finance_journal_transactions (id,institution_id,status,currency,amount) VALUES ($1,$2,'prepared','EUR','100.00'),($3,$4,'prepared','EUR','50.00')`, [transactionA, institutionA, transactionB, institutionB]);
    await client.query(`INSERT INTO finance_journal_entries (institution_id,transaction_id,currency,amount,position_type,source_ref) VALUES ($1,$2,'EUR','100.00','received_value','fixture')`, [institutionA, transactionA]);

    await rejects(() => client.query(`INSERT INTO finance_journal_entries (institution_id,transaction_id,currency,amount,position_type,source_ref) VALUES ($1,$2,'EUR','1','received_value','orphan')`, [institutionA, randomUUID()]), 'orphan journal entry must be rejected');
    await rejects(() => client.query(`INSERT INTO finance_journal_entries (institution_id,transaction_id,currency,amount,position_type,source_ref) VALUES ($1,$2,'EUR','1','received_value','cross-tenant')`, [institutionA, transactionB]), 'cross-tenant parent link must be rejected');
    await rejects(() => client.query(`INSERT INTO finance_journal_entries (institution_id,transaction_id,currency,amount,position_type,source_ref) VALUES ($1,$2,'eur','1','received_value','currency')`, [institutionA, transactionA]), 'lowercase currency must be rejected');
    await rejects(() => client.query(`INSERT INTO finance_journal_entries (institution_id,transaction_id,currency,amount,position_type,source_ref) VALUES ($1,$2,'EURO','1','received_value','currency')`, [institutionA, transactionA]), 'non-three-letter currency must be rejected');
    await rejects(() => client.query(`INSERT INTO finance_journal_entries (institution_id,transaction_id,currency,amount,position_type,source_ref) VALUES ($1,$2,'EUR','1234567890123456789.123456789012','received_value','overflow')`, [institutionA, transactionA]), 'out-of-envelope amount must be rejected');
    await rejects(() => client.query(`INSERT INTO finance_journal_transactions (institution_id,status,currency,amount,confirmed_at) VALUES ($1,'prepared','EUR','1',now())`, [institutionA]), 'prepared transaction cannot have confirmed_at');
    await rejects(() => client.query(`INSERT INTO finance_journal_transactions (institution_id,status,currency,amount) VALUES ($1,'confirmed','EUR','1')`, [institutionA]), 'confirmed transaction requires confirmed_at');

    await client.query(`INSERT INTO finance_command_results (institution_id,operation_namespace,idempotency_key,request_fingerprint,result_ref) VALUES ($1,'finance.foundation','key-1','fingerprint','result-a'),($2,'finance.foundation','key-1','fingerprint','result-b')`, [institutionA, institutionB]);
    await rejects(() => client.query(`INSERT INTO finance_command_results (institution_id,operation_namespace,idempotency_key,request_fingerprint,result_ref) VALUES ($1,'finance.foundation','key-1','different','duplicate')`, [institutionA]), 'duplicate scoped idempotency must be rejected');
    await rejects(() => client.query(`INSERT INTO finance_command_results (institution_id,operation_namespace,idempotency_key,request_fingerprint,result_ref) VALUES ($1,'finance.foundation','key-2',NULL,'missing')`, [institutionA]), 'request fingerprint must be required');
    console.log('Finance foundation PostgreSQL schema: PASS');
  } finally { client.release(); }
} finally {
  const client = await pool.connect().catch(() => undefined);
  if (client) { try { await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); } finally { client.release(); } }
  await pool.end();
}
