/**
 * P1-04 CHARACTERIZATION: INACTIVE TYPE DURING VERSION PUBLISHING
 *
 * Proves:
 * 1. Amount-only version publish on item with inactive current type: SUCCEEDS (historical validity preserved).
 * 2. Changing to an inactive target type: FAILS with validation error.
 * 3. Changing to an active target type: SUCCEEDS.
 * 4. History preserves original type references.
 * 
 * P1-03 CHARACTERIZATION: kind is derived from fee type, not from user input.
 * 5. kind on created/updated versions always equals the fee type canonical_key or code_prefix.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import path from "node:path";
import { discoverMigrations, runMigrations } from "../src/db/migration-runner.ts";
import { verifyApprovedTestConnection } from "../scripts/nexus-test-db-safety.mjs";
import { PostgresFeeTypeRepository } from "../src/modules/finance/fee-type-repository.ts";
import { PostgresFeeCatalogueRepository } from "../src/modules/finance/fee-catalogue-repository.ts";
import { FeeCatalogueValidationError } from "../src/modules/finance/fee-catalogue-model.ts";

await verifyApprovedTestConnection();
const schema = `fee_inactive_${randomUUID().replaceAll("-", "")}`;
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
    await c.query(`INSERT INTO institutions(id, name, slug, status) VALUES($1, 'Inst', 'inst', 'active')`, [instId]);
    await c.query(`INSERT INTO people(id, name) VALUES($1, 'Person')`, [personId]);
    await c.query(
      `INSERT INTO finance_profile_versions(institution_id, version, effective_from, primary_jurisdiction, functional_currency, financial_timezone, monetary_policy_version, enabled_currencies) VALUES($1, 1, now() - interval '30 days', 'PT', 'EUR', 'UTC', 'v1', '["EUR"]')`,
      [instId],
    );

    const profileEffectiveFrom = new Date(Date.now() - 25 * 86400000).toISOString();
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

    // Create two fee types: one will become inactive, one stays active
    const typeA = await typeRepo.create(actor, { displayName: "Type A", codePrefix: "TYA" }, `key-tya-${randomUUID()}`);
    const typeB = await typeRepo.create(actor, { displayName: "Type B (inactive)", codePrefix: "TYB" }, `key-tyb-${randomUUID()}`);
    const typeC = await typeRepo.create(actor, { displayName: "Type C (active)", codePrefix: "TYC" }, `key-tyc-${randomUUID()}`);

    // Create a catalogue item under typeA
    const v1EffectiveFrom = new Date(Date.now() - 20 * 86400000).toISOString();
    const item = await catRepo.create(actor, {
      feeTypeId: typeA.result.id,
      name: "Test Fee",
      amount: "100",
      currency: "EUR",
      effectiveFrom: v1EffectiveFrom,
    }, `key-item-create-${randomUUID()}`);
    assert.ok(item.result.code.startsWith("TYA-"), "Code must start with TYA-");
    assert.equal(item.result.currentVersion, 1);

    // P1-03: kind must equal fee type canonical_key or code_prefix at creation
    // typeA is institution_custom so canonical_key is null; kind = code_prefix = TYA
    assert.equal(item.result.current.kind, "TYA", "P1-03: kind must be derived from fee type (code_prefix for custom types)");
    console.log("  P1-03-1 PASS: kind on created version equals fee type code_prefix");

    // Deactivate typeA (the item's current type becomes inactive)
    await typeRepo.setStatus(actor, typeA.result.id, "inactive", `key-tya-inact-${randomUUID()}`);

    // Also deactivate typeB
    await typeRepo.setStatus(actor, typeB.result.id, "inactive", `key-tyb-inact-${randomUUID()}`);

    // P1-04 Test 1: same-type version publish with inactive current type -> MUST SUCCEED
    const v2EffectiveFrom = new Date(Date.now() - 10 * 86400000).toISOString();
    const v2 = await catRepo.update(actor, item.result.id, {
      expectedVersion: 1,
      feeTypeId: typeA.result.id, // same type (inactive)
      name: "Test Fee Updated",
      amount: "120",
      currency: "EUR",
      effectiveFrom: v2EffectiveFrom,
    }, `key-item-v2-${randomUUID()}`);
    assert.equal(v2.result.currentVersion, 2, "P1-04: Same-type version publish must succeed even with inactive type");
    assert.equal(v2.result.feeTypeId, typeA.result.id, "Fee type reference must be preserved");
    console.log("  P1-04-1 PASS: same-type version publish with inactive type succeeds");

    // P1-03: kind on v2 must still be derived from fee type
    assert.equal(v2.result.current.kind, "TYA", "P1-03: kind on updated version must still be fee-type-derived");
    console.log("  P1-03-2 PASS: kind on updated version still equals fee type code_prefix");

    // P1-04 Test 2: change to inactive target type -> MUST FAIL
    const v3EffectiveFrom = new Date(Date.now() - 5 * 86400000).toISOString();
    await assert.rejects(
      () => catRepo.update(actor, item.result.id, {
        expectedVersion: 2,
        feeTypeId: typeB.result.id, // inactive target
        name: "Test Fee V3",
        amount: "130",
        currency: "EUR",
        effectiveFrom: v3EffectiveFrom,
      }, `key-item-v3-fail-${randomUUID()}`),
      FeeCatalogueValidationError,
      "P1-04: Changing to inactive target type must throw FeeCatalogueValidationError",
    );
    // Verify item still at v2 (no mutation)
    const afterFailedChange = await catRepo.get(actor, item.result.id);
    assert.equal(afterFailedChange.currentVersion, 2, "P1-04: Failed type change must not mutate version");
    console.log("  P1-04-2 PASS: change to inactive target type fails and does not mutate version");

    // P1-04 Test 3: change to active target type -> MUST SUCCEED
    const v3ActiveFrom = new Date(Date.now() - 2 * 86400000).toISOString();
    const v3 = await catRepo.update(actor, item.result.id, {
      expectedVersion: 2,
      feeTypeId: typeC.result.id, // active target
      name: "Test Fee V3 Active",
      amount: "140",
      currency: "EUR",
      effectiveFrom: v3ActiveFrom,
    }, `key-item-v3-ok-${randomUUID()}`);
    assert.equal(v3.result.currentVersion, 3, "P1-04: Changing to active type must succeed");
    assert.equal(v3.result.feeTypeId, typeC.result.id, "Fee type must be updated to typeC");
    console.log("  P1-04-3 PASS: change to active target type succeeds");

    // P1-04 Test 4: history preserves original type references
    const withHistory = await catRepo.get(actor, item.result.id, true);
    assert.ok(withHistory.history, "Must have history");
    assert.equal(withHistory.history.length, 3, "Must have 3 versions in history");
    // v1 had typeA
    const histV1 = withHistory.history.find((h) => h.version === 1);
    assert.equal(histV1.feeTypeId, typeA.result.id, "P1-04: History v1 must preserve original typeA reference");
    // v2 had typeA (same-type publish)
    const histV2 = withHistory.history.find((h) => h.version === 2);
    assert.equal(histV2.feeTypeId, typeA.result.id, "P1-04: History v2 must preserve typeA reference");
    // v3 has typeC
    const histV3 = withHistory.history.find((h) => h.version === 3);
    assert.equal(histV3.feeTypeId, typeC.result.id, "P1-04: History v3 must have typeC reference");
    console.log("  P1-04-4 PASS: history preserves original type references across versions");

    console.log("Finance fee catalogue P1-03/P1-04 Inactive Type Version Publishing: PASS");
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
