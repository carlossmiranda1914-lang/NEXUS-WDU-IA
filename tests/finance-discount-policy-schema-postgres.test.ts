import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_discount_schema_${randomUUID().replaceAll('-', '')}`;
const q = (v: string) => `"${v.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${q(schema)},public` });

try {
  const c = await pool.connect();
  try {
    await c.query(`CREATE SCHEMA ${q(schema)}`);
    await runMigrations(c, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));

    // Verify tables exist
    const tablesRes = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1`, [schema]);
    const tableNames = new Set(tablesRes.rows.map(r => r.table_name));
    assert.ok(tableNames.has('finance_discount_policies'), 'finance_discount_policies table must exist');
    assert.ok(tableNames.has('finance_discount_policy_versions'), 'finance_discount_policy_versions table must exist');
    assert.ok(tableNames.has('finance_obligation_discounts'), 'finance_obligation_discounts table must exist');
    assert.ok(tableNames.has('finance_obligation_discount_revocations'), 'finance_obligation_discount_revocations table must exist');

    // Verify discount policies uniqueness constraints
    const policyId = randomUUID();
    const instA = randomUUID();
    const instB = randomUUID();
    await c.query(`INSERT INTO institutions(id, name, slug, status) VALUES ($1, 'Inst A', 'inst-a', 'active'), ($2, 'Inst B', 'inst-b', 'active')`, [instA, instB]);

    await c.query(`INSERT INTO finance_discount_policies(id, institution_id, code, status) VALUES ($1, $2, 'BOLSA-20', 'active')`, [policyId, instA]);
    // Duplicate code in same tenant must fail
    await assert.rejects(() => c.query(`INSERT INTO finance_discount_policies(id, institution_id, code, status) VALUES ($1, $2, 'BOLSA-20', 'active')`, [randomUUID(), instA]), /unique/i);
    // Same code in different tenant succeeds
    await c.query(`INSERT INTO finance_discount_policies(id, institution_id, code, status) VALUES ($1, $2, 'BOLSA-20', 'active')`, [randomUUID(), instB]);

    // Insert version 1
    const ver1Id = randomUUID();
    await c.query(`INSERT INTO finance_discount_policy_versions(id, institution_id, policy_id, version, name, calculation_mode, value, currency, effective_from, effective_to) VALUES ($1, $2, $3, 1, 'Bolsa 20%', 'percentage', '20.00', NULL, '2026-09-01T00:00:00Z', '2027-08-31T23:59:59Z')`, [ver1Id, instA, policyId]);

    // Percentage mode requires currency NULL and value <= 100
    await assert.rejects(() => c.query(`INSERT INTO finance_discount_policy_versions(id, institution_id, policy_id, version, name, calculation_mode, value, currency) VALUES ($1, $2, $3, 2, 'Bad', 'percentage', '120.00', NULL)`, [randomUUID(), instA, policyId]), /check/i);
    await assert.rejects(() => c.query(`INSERT INTO finance_discount_policy_versions(id, institution_id, policy_id, version, name, calculation_mode, value, currency) VALUES ($1, $2, $3, 2, 'Bad', 'percentage', '20.00', 'EUR')`, [randomUUID(), instA, policyId]), /check/i);

    // Fixed amount mode requires currency NOT NULL
    await assert.rejects(() => c.query(`INSERT INTO finance_discount_policy_versions(id, institution_id, policy_id, version, name, calculation_mode, value, currency) VALUES ($1, $2, $3, 2, 'Bad', 'fixed_amount', '20.00', NULL)`, [randomUUID(), instA, policyId]), /check/i);

    // Cross-tenant composite FK violation on version
    await assert.rejects(() => c.query(`INSERT INTO finance_discount_policy_versions(id, institution_id, policy_id, version, name, calculation_mode, value, currency) VALUES ($1, $2, $3, 2, 'Foreign', 'percentage', '20.00', NULL)`, [randomUUID(), instB, policyId]), /foreign key|fk/i);

    console.log('Finance discount policy schema postgres: PASS');
  } finally {
    c.release();
  }
} finally {
  const c = await pool.connect().catch(() => undefined);
  if (c) {
    try { await c.query(`DROP SCHEMA IF EXISTS ${q(schema)} CASCADE`); } finally { c.release(); }
  }
  await pool.end();
}
