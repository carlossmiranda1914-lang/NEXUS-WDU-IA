import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import path from 'node:path';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { PostgresFeeCatalogueRepository, FeeCatalogueNotFoundError } from '../src/modules/finance/fee-catalogue-repository.ts';
import { FeeCatalogueValidationError } from '../src/modules/finance/fee-catalogue-model.ts';

await verifyApprovedTestConnection();
const schema = `fee_repo_${randomUUID().replaceAll('-', '')}`;
const quote = (x: string) => `"${x}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${schema},public`,
});

try {
  const c = await pool.connect();
  try {
    await c.query(`CREATE SCHEMA ${quote(schema)}`);
    await c.query(`SET search_path TO ${quote(schema)},public`);
    await runMigrations(c, await discoverMigrations(path.resolve('src/db/migrations')));

    const institution = randomUUID();
    const foreign = randomUUID();
    const person = randomUUID();

    await c.query(`INSERT INTO institutions(id, name, slug, status) VALUES($1, 'A', 'a', 'active'), ($2, 'B', 'b', 'active')`, [institution, foreign]);
    await c.query(`INSERT INTO people(id, name) VALUES($1, 'P')`, [person]);
    await c.query(
      `INSERT INTO finance_profile_versions(institution_id, version, effective_from, primary_jurisdiction, functional_currency, financial_timezone, monetary_policy_version, enabled_currencies) VALUES($1, 1, now() - interval '10 days', 'PT', 'EUR', 'UTC', 'v1', '["EUR"]'), ($2, 1, now() - interval '10 days', 'PT', 'EUR', 'UTC', 'v1', '["EUR"]')`,
      [institution, foreign],
    );

    const profileEffectiveFrom = new Date(Date.now() - 7 * 86400000).toISOString();
    const profiles = {
      resolveEffective: async (id: string) => ({
        institutionId: id,
        version: 1,
        effectiveFrom: profileEffectiveFrom,
        effectiveTo: null,
        primaryJurisdiction: 'PT',
        functionalCurrency: 'EUR',
        financialTimezone: 'UTC',
        monetaryPolicyVersion: 'v1',
        enabledCurrencies: ['EUR'],
      }),
    };

    const repo = new PostgresFeeCatalogueRepository(pool, profiles);
    const actor = { institutionId: institution, personId: person, role: 'financial' };

    const baseDate = new Date(Date.now() - 86400000); // Yesterday (after profileEffectiveFrom)
    const baseEffective = baseDate.toISOString();
    const input = {
      code: 'FEE',
      name: 'Fee',
      kind: 'emolument',
      amount: '10.1200',
      currency: 'EUR',
      effectiveFrom: baseEffective,
    };

    // 1. Create v1
    const first = await repo.create(actor, input, 'create-1');
    assert.equal(first.result.current.money.amount, '10.12');
    assert.equal(first.result.currentVersion, 1);
    assert.equal((await repo.create(actor, input, 'create-1')).replayed, true);

    // Rejection on distinct key with same code
    await assert.rejects(() => repo.create(actor, input, 'create-2'));
    await assert.rejects(() => repo.get({ ...actor, institutionId: foreign }, first.result.id), FeeCatalogueNotFoundError);

    // 2. Characterization: Equal effectiveFrom rejected with FeeCatalogueValidationError (no partial mutation)
    const equalDateUpdate = {
      ...input,
      name: 'Equal Date Update',
      amount: '11.00',
      effectiveFrom: baseEffective, // Exactly equal to v1 effectiveFrom
      expectedVersion: 1,
    };
    await assert.rejects(
      () => repo.update(actor, first.result.id, equalDateUpdate, 'update-equal-date'),
      (err: unknown) => err instanceof FeeCatalogueValidationError,
      'Update with equal effectiveFrom must fail with FeeCatalogueValidationError',
    );

    // Confirm no partial mutation after equal date rejection
    const afterEqualAttempt = await repo.get(actor, first.result.id, true);
    assert.equal(afterEqualAttempt.currentVersion, 1, 'Version must remain 1');
    assert.equal(afterEqualAttempt.current.name, 'Fee', 'Name must not have changed');
    assert.equal(afterEqualAttempt.history?.length, 1, 'History must only have 1 version');

    // 3. Characterization: Anterior effectiveFrom rejected with FeeCatalogueValidationError (no partial mutation)
    const anteriorDateUpdate = {
      ...input,
      name: 'Anterior Date Update',
      amount: '11.00',
      effectiveFrom: new Date(baseDate.getTime() - 3600000).toISOString(), // 1 hour earlier than v1
      expectedVersion: 1,
    };
    await assert.rejects(
      () => repo.update(actor, first.result.id, anteriorDateUpdate, 'update-anterior-date'),
      (err: unknown) => err instanceof FeeCatalogueValidationError,
      'Update with anterior effectiveFrom must fail with FeeCatalogueValidationError',
    );

    // Confirm no partial mutation after anterior date rejection
    const afterAnteriorAttempt = await repo.get(actor, first.result.id, true);
    assert.equal(afterAnteriorAttempt.currentVersion, 1, 'Version must remain 1');
    assert.equal(afterAnteriorAttempt.current.name, 'Fee', 'Name must not have changed');
    assert.equal(afterAnteriorAttempt.history?.length, 1, 'History must only have 1 version');

    // 4. Positive update with strictly posterior effectiveFrom succeeds
    const posteriorEffective = new Date(baseDate.getTime() + 86400000).toISOString();
    const validUpdate = {
      ...input,
      name: 'Changed',
      amount: '11',
      effectiveFrom: posteriorEffective,
      expectedVersion: 1,
    };
    const updateResult = await repo.update(actor, first.result.id, validUpdate, 'update-1');
    assert.equal(updateResult.result.currentVersion, 2);
    assert.equal(updateResult.result.current.name, 'Changed');
    assert.equal(updateResult.result.current.effectiveFrom, posteriorEffective);

    // Verify history and interval correctness in DB
    const itemWithHistory = await repo.get(actor, first.result.id, true);
    assert.equal(itemWithHistory.history?.length, 2);
    const v1History = itemWithHistory.history?.find((v) => v.version === 1);
    const v2History = itemWithHistory.history?.find((v) => v.version === 2);
    assert.ok(v1History, 'v1 must exist in history');
    assert.ok(v2History, 'v2 must exist in history');
    assert.equal(v1History.effectiveTo, posteriorEffective, 'v1 effectiveTo must be set to v2 effectiveFrom');
    assert.equal(v2History.effectiveTo, null, 'v2 effectiveTo must be null');
    assert.ok(new Date(v1History.effectiveFrom).getTime() < new Date(v1History.effectiveTo).getTime(), 'v1 interval must be positive');

    // 5. Direct PostgreSQL CHECK constraint verification: effective_interval refuses zero/negative intervals
    await assert.rejects(
      () =>
        c.query(
          `INSERT INTO finance_fee_catalogue_versions(institution_id, item_id, version, name, kind, amount, currency, effective_from, effective_to, created_by_person_id) VALUES($1, $2, 99, 'Bad Interval', 'fee', 10, 'EUR', '2026-09-01 00:00:00+00', '2026-09-01 00:00:00+00', $3)`,
          [institution, first.result.id, person],
        ),
      /finance_fee_catalogue_versions_effective_interval/,
      'PostgreSQL CHECK constraint must refuse effective_from == effective_to',
    );

    await repo.setStatus(actor, first.result.id, 'inactive', 'off');
    assert.equal((await repo.get(actor, first.result.id)).status, 'inactive');

    assert.equal((await c.query(`SELECT count(*)::int value FROM finance_journal_transactions`)).rows[0].value, 0);
    assert.equal((await c.query(`SELECT count(*)::int value FROM finance_position_projection`)).rows[0].value, 0);

    console.log('Finance fee catalogue PostgreSQL repository: PASS');
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
