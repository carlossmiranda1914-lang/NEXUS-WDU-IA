import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import path from 'node:path';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const s = `fee_${randomUUID().replaceAll('-', '')}`;
const q = (x: string) => `"${x}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });

try {
  const c = await pool.connect();
  try {
    await c.query(`CREATE SCHEMA ${q(s)}`);
    await c.query(`SET search_path TO ${q(s)},public`);
    await runMigrations(c, await discoverMigrations(path.resolve('src/db/migrations')));

    const t = await c.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_name IN ('finance_fee_catalogue_items','finance_fee_catalogue_versions','finance_fee_types','finance_fee_code_counters')`,
      [s],
    );
    assert.equal(t.rowCount, 4, 'Must have 4 Fee Catalogue & Fee Type tables');

    const i = randomUUID();
    const p = randomUUID();
    const ftId = randomUUID();

    await c.query(`INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','a','active')`, [i]);
    await c.query(`INSERT INTO people(id,name) VALUES($1,'P')`, [p]);
    await c.query(
      `INSERT INTO finance_fee_types(id, institution_id, canonical_key, source, display_name, code_prefix, status)
       VALUES($1, $2, 'tuition', 'nexus_base', 'Propina', 'PROP', 'active')`,
      [ftId, i],
    );

    await c.query(
      `INSERT INTO finance_fee_catalogue_items(id, institution_id, fee_type_id, code, current_version, created_by_person_id) VALUES($1, $2, $3, 'PROP-000001', 1, $4)`,
      [randomUUID(), i, ftId, p],
    );

    console.log('Finance fee catalogue schema PostgreSQL: PASS');
  } finally {
    c.release();
  }
} finally {
  const c = await pool.connect().catch(() => undefined);
  if (c) {
    try {
      await c.query(`DROP SCHEMA IF EXISTS ${q(s)} CASCADE`);
    } finally {
      c.release();
    }
  }
  await pool.end();
}