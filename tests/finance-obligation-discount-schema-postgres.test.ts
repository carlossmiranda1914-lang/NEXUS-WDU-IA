import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { PostgresJournalRepository } from '../src/modules/finance/journal-repository.ts';
import { Money } from '../src/modules/finance/money.ts';

await verifyApprovedTestConnection();
const schema = `finance_discount_fact_schema_${randomUUID().replaceAll('-', '')}`;
const q = (v: string) => `"${v.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${q(schema)},public` });

try {
  const c = await pool.connect();
  try {
    await c.query(`CREATE SCHEMA ${q(schema)}`);
    await runMigrations(c, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));

    const instA = randomUUID();
    const instB = randomUUID();
    const personId = randomUUID();
    const accountId = randomUUID();
    const obligationId = randomUUID();
    const policyId = randomUUID();
    const versionId = randomUUID();
    const discountId = randomUUID();
    const revocationId = randomUUID();

    await c.query(`INSERT INTO institutions(id, name, slug, status) VALUES ($1, 'Inst A', 'inst-a', 'active'), ($2, 'Inst B', 'inst-b', 'active')`, [instA, instB]);
    await c.query(`INSERT INTO people(id, name) VALUES ($1, 'Person')`, [personId]);
    await c.query(`INSERT INTO finance_profile_versions(institution_id, version, effective_from, primary_jurisdiction, functional_currency, financial_timezone, monetary_policy_version, enabled_currencies) VALUES ($1, 1, now(), 'PT', 'EUR', 'Europe/Lisbon', 'v1', '["EUR"]')`, [instA]);
    await c.query(`INSERT INTO finance_financial_accounts(id, institution_id, account_number, name) VALUES ($1, $2, 'ACC-1', 'Account 1')`, [accountId, instA]);
    await c.query(`INSERT INTO finance_fee_types(id, institution_id, source, display_name, code_prefix) VALUES ($1, $2, 'institution_custom', 'Type', 'TYP')`, [randomUUID(), instA]);
    const feeId = randomUUID();
    await c.query(`INSERT INTO finance_fee_catalogue_items(id, institution_id, fee_type_id, code, current_version, created_by_person_id) VALUES ($1, $2, (SELECT id FROM finance_fee_types WHERE institution_id = $2 LIMIT 1), 'FEE-1', 1, $3)`, [feeId, instA, personId]);
    await c.query(`INSERT INTO finance_fee_catalogue_versions(institution_id, item_id, fee_type_id, version, name, kind, amount, currency, effective_from, created_by_person_id) VALUES ($1, $2, (SELECT id FROM finance_fee_types WHERE institution_id = $1 LIMIT 1), 1, 'Fee 1', 'fee', '100', 'EUR', now(), $3)`, [instA, feeId, personId]);
    await c.query(`INSERT INTO finance_obligations(id, institution_id, financial_account_id, fee_catalogue_item_id, fee_catalogue_version, source_type, source_ref, amount, currency, status, financial_profile_version, created_by_person_id, idempotency_key) VALUES ($1, $2, $3, $4, 1, 'manual_finance', 'ref', '100', 'EUR', 'open', 1, $5, 'ob-key-1')`, [obligationId, instA, accountId, feeId, personId]);

    await c.query(`INSERT INTO finance_discount_policies(id, institution_id, code, status) VALUES ($1, $2, 'BOLSA-20', 'active')`, [policyId, instA]);
    await c.query(`INSERT INTO finance_discount_policy_versions(id, institution_id, policy_id, version, name, calculation_mode, value, currency, effective_from, effective_to) VALUES ($1, $2, $3, 1, 'Bolsa 20%', 'percentage', '20.00', NULL, now(), NULL)`, [versionId, instA, policyId]);

    // 1. Journal validation for obligation_discount
    const journalRepo = new PostgresJournalRepository(c);
    const actor = { personId, personName: 'Actor', identityEmail: null, membershipId: randomUUID(), institutionId: instA, institutionName: 'Inst A', institutionSlug: 'inst-a', role: 'financial' as const };
    
    const journalTx = await journalRepo.confirmInTransaction(c, {
      institutionId: instA,
      commandId: randomUUID(),
      journalType: 'obligation_discount',
      effectiveAt: new Date(),
      financialProfileVersion: 1,
      actorPersonId: personId,
      actorKind: 'human',
      entries: [
        {
          positionType: 'obligation_discount_applied',
          money: Money.parse('20.00', 'EUR'),
          sourceRef: obligationId,
        },
      ],
    });
    assert.ok(journalTx.transactionId);

    // 2. Insert applied discount fact
    await c.query(
      `INSERT INTO finance_obligation_discounts (
         id, institution_id, financial_account_id, obligation_id, policy_id, policy_version_id,
         policy_code, policy_name, policy_version, calculation_mode, policy_value, amount, currency,
         reason, journal_transaction_id, applied_at, actor_kind, actor_person_id
       ) VALUES ($1, $2, $3, $4, $5, $6, 'BOLSA-20', 'Bolsa 20%', 1, 'percentage', '20.00', '20.00', 'EUR', 'Merit scholarship', $7, now(), 'human', $8)`,
      [discountId, instA, accountId, obligationId, policyId, versionId, journalTx.transactionId, personId]
    );

    // Verify discount row is append-only / immutable (no status column)
    const discountColRes = await c.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'finance_obligation_discounts'`,
      [schema]
    );
    const discountCols = new Set(discountColRes.rows.map(r => r.column_name));
    assert.equal(discountCols.has('status'), false, 'finance_obligation_discounts MUST NOT have a status column');

    // 3. Insert revocation fact
    const revocationJournalTx = await journalRepo.confirmInTransaction(c, {
      institutionId: instA,
      commandId: randomUUID(),
      journalType: 'obligation_discount',
      effectiveAt: new Date(),
      financialProfileVersion: 1,
      actorPersonId: personId,
      actorKind: 'human',
      entries: [
        {
          positionType: 'obligation_discount_revoked',
          money: Money.parse('20.00', 'EUR'),
          sourceRef: obligationId,
        },
      ],
    });

    await c.query(
      `INSERT INTO finance_obligation_discount_revocations (
         id, institution_id, financial_account_id, obligation_id, original_discount_id,
         amount, currency, reason, journal_transaction_id, revoked_at, actor_kind, actor_person_id
       ) VALUES ($1, $2, $3, $4, $5, '20.00', 'EUR', 'Loss of scholarship', $6, now(), 'human', $7)`,
      [revocationId, instA, accountId, obligationId, discountId, revocationJournalTx.transactionId, personId]
    );

    // 4. Duplicate revocation on same discount fact is blocked by UNIQUE (institution_id, original_discount_id)
    await assert.rejects(
      () =>
        c.query(
          `INSERT INTO finance_obligation_discount_revocations (
             id, institution_id, financial_account_id, obligation_id, original_discount_id,
             amount, currency, reason, journal_transaction_id, revoked_at, actor_kind, actor_person_id
           ) VALUES ($1, $2, $3, $4, $5, '20.00', 'EUR', 'Second revocation', $6, now(), 'human', $7)`,
          [randomUUID(), instA, accountId, obligationId, discountId, revocationJournalTx.transactionId, personId]
        ),
      /unique|uq_discount_single_revocation/i
    );

    // 5. Cross-tenant Journal composite FK failure: instB attempting to reference instA journal transaction
    await assert.rejects(
      () =>
        c.query(
          `INSERT INTO finance_obligation_discounts (
             id, institution_id, financial_account_id, obligation_id, policy_id, policy_version_id,
             policy_code, policy_name, policy_version, calculation_mode, policy_value, amount, currency,
             reason, journal_transaction_id, applied_at, actor_kind, actor_person_id
           ) VALUES ($1, $2, $3, $4, $5, $6, 'BOLSA-20', 'Bolsa 20%', 1, 'percentage', '20.00', '20.00', 'EUR', 'Cross tenant', $7, now(), 'human', $8)`,
          [randomUUID(), instB, accountId, obligationId, policyId, versionId, journalTx.transactionId, personId]
        ),
      /foreign key|fk_obligation_discounts_journal/i
    );

    console.log('Finance obligation discount schema postgres: PASS');
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
