import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresObligationAdjustmentRepository } from '../src/modules/finance/obligation-adjustment-repository.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_adjustment_debit_basis_${randomUUID().replaceAll('-', '')}`;
const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quoteIdentifier(schema)},public` });
const institutionId = randomUUID();
const otherInstitutionId = randomUUID();
const personId = randomUUID();
const accountId = randomUUID();
const feeTypeId = randomUUID();
const feeId = randomUUID();
const actor = { personId, personName: 'Debit basis actor', identityEmail: null, membershipId: randomUUID(), institutionId, institutionName: 'Debit basis', institutionSlug: 'debit-basis', role: 'financial' as const };
const repo = new PostgresObligationAdjustmentRepository(pool);

async function createObligation(amount = '100') {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,status,financial_profile_version,created_by_person_id,idempotency_key)
     VALUES($1,$2,$3,$4,1,'manual_finance',$5,$6,'EUR','open',1,$7,$8)`,
    [id, institutionId, accountId, feeId, `debit-basis-${id}`, amount, personId, `obligation-${id}`],
  );
  return id;
}
const record = (obligationId: string, direction: 'increase' | 'decrease', amount: string, key: string, basisType?: 'general' | 'debit_event') =>
  repo.recordAdjustment(actor, { obligationId, direction, amount, currency: 'EUR', reason: 'Factual debit event basis', ...(basisType === undefined ? {} : { basisType }) }, key);

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
    await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES($1,'Debit basis','debit-basis','active'),($2,'Other','other','active')`, [institutionId, otherInstitutionId]);
    await client.query(`INSERT INTO people(id,name) VALUES($1,'Actor')`, [personId]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR"]')`, [institutionId]);
    await client.query(`INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'DEBIT-1','Debit basis')`, [accountId, institutionId]);
    await client.query(`INSERT INTO finance_fee_types(id,institution_id,source,display_name,code_prefix) VALUES($1,$2,'institution_custom','Debit basis','DBT')`, [feeTypeId, institutionId]);
    await client.query(`INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'DBT-1',1,$4)`, [feeId, institutionId, feeTypeId, personId]);
    await client.query(`INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'Debit basis','fee','100','EUR',now(),$4)`, [institutionId, feeId, feeTypeId, personId]);
  } finally { client.release(); }

  const obligationId = await createObligation();
  const general = await record(obligationId, 'increase', '10.00', 'general');
  assert.equal(general.adjustment.basisType, 'general');
  const debitEvent = await record(obligationId, 'increase', '0.10', 'debit-event', 'debit_event');
  assert.equal(debitEvent.adjustment.basisType, 'debit_event');
  assert.equal((await pool.query(`SELECT basis_type FROM finance_obligation_adjustments WHERE id=$1`, [debitEvent.adjustment.id])).rows[0]?.basis_type, 'debit_event');
  await assert.rejects(() => record(obligationId, 'decrease', '1.00', 'debit-decrease', 'debit_event'), /debit/i);
  const replay = await record(obligationId, 'increase', '0.20', 'replay', 'debit_event');
  const replayAgain = await record(obligationId, 'increase', '0.20', 'replay', 'debit_event');
  assert.equal(replayAgain.replayed, true);
  assert.equal(replayAgain.adjustment.id, replay.adjustment.id);
  await assert.rejects(() => record(obligationId, 'increase', '0.20', 'replay', 'general'), /fingerprint/i);
  const freshRepository = new PostgresObligationAdjustmentRepository(pool);
  assert.equal((await freshRepository.getById(institutionId, debitEvent.adjustment.id)).basisType, 'debit_event');
  await assert.rejects(() => freshRepository.getById(otherInstitutionId, debitEvent.adjustment.id), /not found/i);
  assert.equal((await pool.query(`SELECT count(*)::int AS count FROM finance_audit_records WHERE institution_id=$1 AND transaction_id=$2 AND event_type='JOURNAL_CONFIRMED'`, [institutionId, debitEvent.adjustment.journalTransactionId])).rows[0]?.count, 1);
  assert.equal((await pool.query(`SELECT count(*)::int AS count FROM finance_outbox WHERE institution_id=$1 AND transaction_id=$2 AND topic='finance.journal.confirmed'`, [institutionId, debitEvent.adjustment.journalTransactionId])).rows[0]?.count, 1);
  assert.equal((await pool.query(`SELECT source_ref FROM finance_journal_entries WHERE institution_id=$1 AND transaction_id=$2`, [institutionId, debitEvent.adjustment.journalTransactionId])).rows[0]?.source_ref, obligationId);
  assert.equal((await pool.query(`SELECT count(*)::int AS count FROM finance_journal_transactions WHERE institution_id=$1 AND journal_type='obligation_adjustment'`, [institutionId])).rows[0]?.count, 3);
  console.log('FINANCE_OBLIGATION_ADJUSTMENT_DEBIT_EVENT_POSTGRES=PASS');
} finally {
  const client = await pool.connect().catch(() => undefined);
  if (client) { try { await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`); } finally { client.release(); } }
  await pool.end();
}
