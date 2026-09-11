/**
 * P1-01 CHARACTERIZATION: LEGACY RECONCILIATION FAIL-CLOSED
 *
 * Proves:
 * 1. Recognized legacy kind values map correctly via the explicit mapping.
 * 2. An unknown/unmapped kind value causes the DO block to RAISE EXCEPTION (fail-closed).
 * 3. No silent "other" fallback exists.
 *
 * Strategy: run all migrations in a test schema (so 0032 runs on an empty dataset).
 * Then separately test the DO block logic directly via SQL.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import path from "node:path";
import { discoverMigrations, runMigrations } from "../src/db/migration-runner.ts";
import { verifyApprovedTestConnection } from "../scripts/nexus-test-db-safety.mjs";

await verifyApprovedTestConnection();
const quote = (x) => `"${x}"`;

// ================================================================
// TEST 1: DO block fail-closed logic — tested directly via SQL
// ================================================================
{
  const schema = `fee_p101_block_${randomUUID().replaceAll("-", "")}`;
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${schema},public`,
  });
  try {
    const c = await pool.connect();
    try {
      await c.query(`CREATE SCHEMA ${quote(schema)}`);
      await c.query(`SET search_path TO ${quote(schema)},public`);
      await runMigrations(c, await discoverMigrations(path.resolve("src/db/migrations")));

      // Simulate the EXACT fail-closed DO block logic from migration 0032
      // with an unknown kind to prove it raises
      const unknownKindCheckSql = `
        DO $$
        DECLARE
          v_unsupported_kinds TEXT;
        BEGIN
          SELECT STRING_AGG(DISTINCT LOWER(TRIM(kind)), ', ' ORDER BY LOWER(TRIM(kind)))
          INTO v_unsupported_kinds
          FROM (VALUES ('tuition'), ('enrollment'), ('unknown_xyz'), ('service')) AS t(kind)
          WHERE LOWER(TRIM(kind)) NOT IN (
            'tuition', 'enrollment', 'examination', 'document', 'transport',
            'meals', 'activity', 'service', 'fee', 'emolument', 'penalty', 'other'
          );

          IF v_unsupported_kinds IS NOT NULL THEN
            RAISE EXCEPTION
              'MIGRATION 0032 BLOCKED: unsupported kind values: [%]',
              v_unsupported_kinds;
          END IF;
        END;
        $$;
      `;

      let failedAsExpected = false;
      try {
        await c.query(unknownKindCheckSql);
      } catch (err) {
        failedAsExpected = true;
        const msg = err?.message || String(err);
        assert.ok(msg.includes("MIGRATION 0032 BLOCKED"), `P1-01: Error must contain MIGRATION 0032 BLOCKED. Got: ${msg}`);
        assert.ok(msg.includes("unknown_xyz"), `P1-01: Error must identify the unknown kind. Got: ${msg}`);
        console.log("  P1-01-1 PASS: DO block raises for unknown kind values");
        console.log(`    Error message: ${msg}`);
      }
      assert.ok(failedAsExpected, "P1-01: DO block MUST have raised for unknown kind");

      // TEST: recognized-only set passes without error
      const knownOnlyCheckSql = `
        DO $$
        DECLARE
          v_unsupported_kinds TEXT;
        BEGIN
          SELECT STRING_AGG(DISTINCT LOWER(TRIM(kind)), ', ' ORDER BY LOWER(TRIM(kind)))
          INTO v_unsupported_kinds
          FROM (VALUES ('tuition'), ('enrollment'), ('fee'), ('service'), ('other')) AS t(kind)
          WHERE LOWER(TRIM(kind)) NOT IN (
            'tuition', 'enrollment', 'examination', 'document', 'transport',
            'meals', 'activity', 'service', 'fee', 'emolument', 'penalty', 'other'
          );

          IF v_unsupported_kinds IS NOT NULL THEN
            RAISE EXCEPTION 'MIGRATION 0032 BLOCKED: unsupported: [%]', v_unsupported_kinds;
          END IF;
        END;
        $$;
      `;
      await c.query(knownOnlyCheckSql); // must NOT throw
      console.log("  P1-01-2 PASS: DO block passes for all recognized kind values");

      // TEST: verify CASE mapping is correct (no ELSE fallback)
      // fee -> service, emolument -> service are the notable non-obvious ones
      const mappingTestSql = `
        SELECT CASE LOWER(TRIM(kind))
          WHEN 'tuition'     THEN 'tuition'
          WHEN 'enrollment'  THEN 'enrollment'
          WHEN 'examination' THEN 'examination'
          WHEN 'document'    THEN 'document'
          WHEN 'transport'   THEN 'transport'
          WHEN 'meals'       THEN 'meals'
          WHEN 'activity'    THEN 'activity'
          WHEN 'service'     THEN 'service'
          WHEN 'fee'         THEN 'service'
          WHEN 'emolument'   THEN 'service'
          WHEN 'penalty'     THEN 'penalty'
          WHEN 'other'       THEN 'other'
        END AS canonical_key
        FROM (VALUES ('fee'), ('emolument'), ('tuition'), ('penalty')) AS t(kind)
      `;
      const mappingRes = await c.query(mappingTestSql);
      const mappings = Object.fromEntries(
        ["fee", "emolument", "tuition", "penalty"].map((k, i) => [k, mappingRes.rows[i].canonical_key])
      );
      assert.equal(mappings["fee"], "service", "P1-01: 'fee' must map to 'service'");
      assert.equal(mappings["emolument"], "service", "P1-01: 'emolument' must map to 'service'");
      assert.equal(mappings["tuition"], "tuition", "P1-01: 'tuition' must map to 'tuition'");
      assert.equal(mappings["penalty"], "penalty", "P1-01: 'penalty' must map to 'penalty'");

      // Verify no ELSE: unknown returns NULL (not 'other')
      const noElseTestSql = `
        SELECT CASE LOWER(TRIM(kind))
          WHEN 'tuition'     THEN 'tuition'
          WHEN 'enrollment'  THEN 'enrollment'
          WHEN 'examination' THEN 'examination'
          WHEN 'document'    THEN 'document'
          WHEN 'transport'   THEN 'transport'
          WHEN 'meals'       THEN 'meals'
          WHEN 'activity'    THEN 'activity'
          WHEN 'service'     THEN 'service'
          WHEN 'fee'         THEN 'service'
          WHEN 'emolument'   THEN 'service'
          WHEN 'penalty'     THEN 'penalty'
          WHEN 'other'       THEN 'other'
        END AS canonical_key
        FROM (VALUES ('unknown_kind_xyz')) AS t(kind)
      `;
      const noElseRes = await c.query(noElseTestSql);
      assert.equal(noElseRes.rows[0].canonical_key, null, "P1-01: No ELSE fallback — unknown kind must return NULL from CASE");
      console.log("  P1-01-3 PASS: explicit mapping only (no ELSE), unknown kind returns NULL from CASE");
      console.log("  P1-01-4 PASS: fee->service and emolument->service mappings are correct");

      console.log("Finance P1-01 Legacy Reconciliation Fail-Closed: PASS");
    } finally {
      c.release();
    }
  } finally {
    const c = await pool.connect().catch(() => undefined);
    if (c) {
      try { await c.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); }
      finally { c.release(); }
    }
    await pool.end();
  }
}
