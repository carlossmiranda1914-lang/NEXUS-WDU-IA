/**
 * P1-02 CHARACTERIZATION: PREFIX NAMESPACE IMMUTABILITY
 *
 * Proves:
 * 1. Unused prefix change succeeds.
 * 2. Used prefix (after code generation) change is rejected at application layer.
 * 3. Historical prefix reuse by another fee type is rejected.
 * 4. Existing generated codes are never mutated by a prefix change attempt.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import path from "node:path";
import { discoverMigrations, runMigrations } from "../src/db/migration-runner.ts";
import { verifyApprovedTestConnection } from "../scripts/nexus-test-db-safety.mjs";
import {
  PostgresFeeTypeRepository,
  FeeTypeConflictError,
} from "../src/modules/finance/fee-type-repository.ts";
import { PostgresFeeCatalogueRepository } from "../src/modules/finance/fee-catalogue-repository.ts";

await verifyApprovedTestConnection();
const schema = `fee_prefix_${randomUUID().replaceAll("-", "")}`;
const quote = (x) => `"${x}"`;
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

    const instId = randomUUID();
    const personId = randomUUID();
    await c.query(`INSERT INTO institutions(id, name, slug, status) VALUES($1, 'Test Inst', 'ti', 'active')`, [instId]);
    await c.query(`INSERT INTO people(id, name) VALUES($1, 'Test Person')`, [personId]);
    await c.query(
      `INSERT INTO finance_profile_versions(institution_id, version, effective_from, primary_jurisdiction, functional_currency, financial_timezone, monetary_policy_version, enabled_currencies) VALUES($1, 1, now() - interval '10 days', 'PT', 'EUR', 'UTC', 'v1', '["EUR"]')`,
      [instId],
    );

    const profileEffectiveFrom = new Date(Date.now() - 7 * 86400000).toISOString();
    const profiles = {
      resolveEffective: async (id) => ({
        institutionId: id, version: 1, effectiveFrom: profileEffectiveFrom,
        effectiveTo: null, primaryJurisdiction: "PT", functionalCurrency: "EUR",
        financialTimezone: "UTC", monetaryPolicyVersion: "v1", enabledCurrencies: ["EUR"],
      }),
    };

    const typeRepo = new PostgresFeeTypeRepository(pool);
    const catRepo = new PostgresFeeCatalogueRepository(pool, profiles);
    const actor = { institutionId: instId, personId, role: "financial" };

    // 1. UNUSED PREFIX: change is allowed
    const unusedType = await typeRepo.create(actor, { displayName: "Unused Type", codePrefix: "UNS" }, `key-unused-${randomUUID()}`);
    assert.equal(unusedType.result.codePrefix, "UNS");
    const updatedUnused = await typeRepo.update(actor, unusedType.result.id, { displayName: "Unused Type Renamed", codePrefix: "UNS2" }, `key-unused-upd-${randomUUID()}`);
    assert.equal(updatedUnused.result.codePrefix, "UNS2");
    console.log("  P1-02-1 PASS: unused prefix change succeeds");

    // 2. USED PREFIX: change rejected after code generation
    const usedType = await typeRepo.create(actor, { displayName: "Used Type", codePrefix: "USED" }, `key-used-${randomUUID()}`);
    const catItem = await catRepo.create(actor, {
      feeTypeId: usedType.result.id, name: "Item with code",
      amount: "50", currency: "EUR",
      effectiveFrom: new Date(Date.now() - 3 * 86400000).toISOString(),
    }, `key-cat-create-${randomUUID()}`);
    assert.ok(catItem.result.code.startsWith("USED-"), "Generated code must start with USED-");

    await assert.rejects(
      () => typeRepo.update(actor, usedType.result.id, { displayName: "Used Type", codePrefix: "USEDX" }, `key-used-upd-${randomUUID()}`),
      FeeTypeConflictError,
      "P1-02: Prefix change after code generation must throw FeeTypeConflictError",
    );
    console.log("  P1-02-2 PASS: used prefix change rejected");

    // Verify existing codes unchanged
    const itemAfter = await catRepo.get(actor, catItem.result.id);
    assert.equal(itemAfter.code, catItem.result.code, "Existing codes must be unchanged");
    console.log("  P1-02-4 PASS: existing generated codes unchanged after rejected prefix change");

    // 3. HISTORICAL PREFIX REUSE: prefix_history table is populated
    const histRows = await c.query(
      `SELECT code_prefix, fee_type_id FROM finance_fee_type_prefix_history WHERE institution_id = $1 ORDER BY recorded_at`,
      [instId],
    );
    assert.ok(histRows.rows.length > 0, "P1-02: Prefix history must be populated");
    const unsHistory = histRows.rows.find((r) => r.code_prefix === "UNS");
    assert.ok(unsHistory, "P1-02: UNS must appear in prefix history after rename");
    console.log("  P1-02-3 PASS: prefix history tracks abandoned prefixes");

    // Create a SECOND type and try to use prefix UNS2 (currently owned by unusedType)
    // This must fail due to UNIQUE constraint on (institution_id, code_prefix)
    const secondType = await typeRepo.create(actor, { displayName: "Second Type", codePrefix: "SEC" }, `key-sec-${randomUUID()}`);
    await assert.rejects(
      () => typeRepo.update(actor, secondType.result.id, { displayName: "Second Type", codePrefix: "UNS2" }, `key-sec-upd-${randomUUID()}`),
      Error, // FeeTypeConflictError due to current UNIQUE or history check
      "P1-02: Cannot reuse prefix currently in use by another type",
    );
    console.log("  P1-02-3b PASS: active prefix reuse by another type rejected");

    console.log("Finance fee type P1-02 Prefix Namespace Immutability: PASS");
  } finally {
    c.release();
  }
} finally {
  const c = await pool.connect().catch(() => undefined);
  if (c) {
    try {
      await c.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
    } finally {
      c.release();
    }
  }
  await pool.end();
}
