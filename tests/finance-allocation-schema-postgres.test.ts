import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();

const schema = `finance_allocation_schema_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

async function constraintExists(client: pg.PoolClient, table: string, name: string): Promise<boolean> {
  const result = await client.query(`SELECT 1 FROM information_schema.table_constraints WHERE table_schema=$1 AND table_name=$2 AND constraint_name=$3`, [schema, table, name]);
  return result.rowCount === 1;
}

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);
    await runMigrations(client, await discoverMigrations(migrations));

    for (const table of ['finance_allocations', 'finance_allocation_reversals']) {
      const exists = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2`, [schema, table]);
      assert.equal(exists.rowCount, 1, `${table} must be created by the canonical migration chain`);
    }

    const allocationColumns = await client.query<{ column_name: string; data_type: string }>(`SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name='finance_allocations'`, [schema]);
    const allocation = new Map(allocationColumns.rows.map((row) => [row.column_name, row.data_type]));
    for (const column of ['id', 'institution_id', 'financial_account_id', 'payment_id', 'obligation_id', 'currency', 'journal_transaction_id', 'effective_at', 'recorded_at', 'actor_kind', 'actor_person_id']) assert.ok(allocation.has(column), `allocation requires ${column}`);
    assert.equal(allocation.get('amount'), 'numeric', 'allocation Money must use NUMERIC');

    const reversalColumns = await client.query<{ column_name: string; data_type: string; is_nullable: string }>(`SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema=$1 AND table_name='finance_allocation_reversals'`, [schema]);
    const reversal = new Map(reversalColumns.rows.map((row) => [row.column_name, row]));
    for (const column of ['id', 'institution_id', 'original_allocation_id', 'currency', 'journal_transaction_id', 'effective_at', 'recorded_at', 'actor_kind', 'actor_person_id']) assert.ok(reversal.has(column), `reversal requires ${column}`);
    assert.equal(reversal.get('amount')?.data_type, 'numeric', 'reversal Money must use NUMERIC');
    assert.equal(reversal.get('reason')?.is_nullable, 'NO', 'reversal reason must be required');

    const floatingMoney = await client.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name IN ('finance_allocations','finance_allocation_reversals') AND column_name='amount' AND data_type IN ('real','double precision')`, [schema]);
    assert.equal(floatingMoney.rowCount, 0, 'allocation authority cannot use floating point Money');
    assert.equal(await constraintExists(client, 'finance_obligations', 'uq_finance_obligations_institution_id'), true, 'Allocation obligation tenant FK requires a matching tenant-pair unique constraint');
    for (const [table, name] of [
      ['finance_allocations', 'fk_finance_allocations_payment_tenant'],
      ['finance_allocations', 'fk_finance_allocations_obligation_tenant'],
      ['finance_allocations', 'fk_finance_allocations_account_tenant'],
      ['finance_allocations', 'fk_finance_allocations_journal_tenant'],
      ['finance_allocation_reversals', 'fk_finance_allocation_reversals_original_tenant'],
      ['finance_allocation_reversals', 'fk_finance_allocation_reversals_journal_tenant'],
    ] as const) assert.equal(await constraintExists(client, table, name), true, `${table}.${name} protects tenant ownership`);

    const indexes = await client.query<{ indexname: string }>(`SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND tablename IN ('finance_allocations','finance_allocation_reversals')`, [schema]);
    const names = new Set(indexes.rows.map((row) => row.indexname));
    for (const name of ['idx_finance_allocations_inst_payment', 'idx_finance_allocations_inst_obligation', 'idx_finance_allocations_inst_account', 'idx_finance_allocation_reversals_inst_original']) assert.ok(names.has(name), `missing allocation derivation index ${name}`);

    const immutableTriggers = await client.query<{ tgname: string }>(`SELECT tgname FROM pg_trigger WHERE tgrelid IN ('finance_allocations'::regclass, 'finance_allocation_reversals'::regclass) AND NOT tgisinternal`);
    const triggerNames = new Set(immutableTriggers.rows.map((row) => row.tgname));
    assert.ok(triggerNames.has('trg_finance_allocations_immutability'), 'allocation facts must be immutable');
    assert.ok(triggerNames.has('trg_finance_allocation_reversals_immutability'), 'allocation reversal facts must be immutable');

    console.log('Finance Allocation Schema PostgreSQL: PASS');
  } finally { client.release(); }
} finally {
  const client = await pool.connect().catch(() => undefined);
  if (client) { try { await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); } finally { client.release(); } }
  await pool.end();
}
