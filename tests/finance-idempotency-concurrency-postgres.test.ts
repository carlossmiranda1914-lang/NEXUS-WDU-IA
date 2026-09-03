import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { createCanonicalFinanceFingerprint, createJournalConfirmationFingerprint, executeIdempotentFinanceCommand, type FinanceCommandIdentity } from '../src/modules/finance/finance-command.ts';
import { PostgresJournalRepository } from '../src/modules/finance/journal-repository.ts';
import type { ConfirmJournalInput } from '../src/modules/finance/journal-model.ts';
import { Money } from '../src/modules/finance/money.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_command_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const institutionId = '00000000-0000-0000-0000-000000000501';
const actorPersonId = '00000000-0000-0000-0000-000000000511';
const operationNamespace = 'finance.journal.confirmation';
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

function journalInput(amount: string, overrides: Partial<ConfirmJournalInput> = {}): ConfirmJournalInput {
  return {
    institutionId,
    commandId: 'not-fingerprint-content',
    journalType: 'foundation_value_received',
    effectiveAt: new Date('2026-09-03T00:00:00.000Z'),
    entries: [{ positionType: 'received_value', money: Money.parse(amount, 'EUR'), sourceRef: 'task-5-fixture' }],
    actorPersonId,
    financialProfileVersion: 1,
    ...overrides,
  };
}

function identity(key: string, amount: string): FinanceCommandIdentity {
  return {
    institutionId,
    operationNamespace,
    idempotencyKey: key,
    canonicalFingerprint: createJournalConfirmationFingerprint(journalInput(amount)),
  };
}

async function counts() {
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT (SELECT count(*)::int FROM finance_command_results) AS commands, (SELECT count(*)::int FROM finance_journal_transactions) AS journals`);
    return result.rows[0] as { commands: number; journals: number };
  } finally { client.release(); }
}

async function run(identityInput: FinanceCommandIdentity, amount = '1.00') {
  return executeIdempotentFinanceCommand({
    pool,
    identity: identityInput,
    execute: async (client) => {
      const journal = await new PostgresJournalRepository(client).confirmInTransaction(client, { ...journalInput(amount), commandId: identityInput.idempotencyKey });
      return { resultRef: journal.transactionId, result: { transactionId: journal.transactionId } };
    },
    loadResult: async (client, resultRef) => {
      const result = await client.query(`SELECT id FROM finance_journal_transactions WHERE institution_id=$1 AND id=$2 AND status='confirmed'`, [institutionId, resultRef]);
      if (!result.rows[0]) throw new Error('Persisted Journal result is missing');
      return { transactionId: result.rows[0].id as string };
    },
  });
}

try {
  const setup = await pool.connect();
  try {
    await setup.query(`CREATE SCHEMA ${quote(schema)}`);
    await runMigrations(setup, await discoverMigrations(migrations));
    await setup.query(`INSERT INTO institutions(id,name,slug,status) VALUES ($1,'Task 5','task-5','active')`, [institutionId]);
    await setup.query(`INSERT INTO people(id,name) VALUES ($1,'Task 5 actor')`, [actorPersonId]);
    await setup.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES ($1,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR"]')`, [institutionId]);
  } finally { setup.release(); }

  assert.equal(createCanonicalFinanceFingerprint({ money: Money.parse('1.0', 'EUR'), nested: { b: 'x', a: 'y' } }), createCanonicalFinanceFingerprint({ nested: { a: 'y', b: 'x' }, money: Money.parse('1.00', 'EUR') }), 'canonical fingerprint normalizes Money and object ordering');
  const canonicalJournal = journalInput('1.00');
  assert.equal(createJournalConfirmationFingerprint(canonicalJournal), createJournalConfirmationFingerprint({ ...canonicalJournal, effectiveAt: new Date('2026-09-03T00:00:00.000Z') }), 'the same instant has deterministic UTC fingerprint serialization');
  assert.notEqual(createJournalConfirmationFingerprint(canonicalJournal), createJournalConfirmationFingerprint({ ...canonicalJournal, effectiveAt: new Date('2026-09-03T00:00:01.000Z') }), 'effectiveAt is material fingerprint content');
  assert.notEqual(createJournalConfirmationFingerprint(canonicalJournal), createJournalConfirmationFingerprint({ ...canonicalJournal, reason: 'corrected rationale' }), 'reason is material fingerprint content');
  assert.notEqual(createJournalConfirmationFingerprint(canonicalJournal), createJournalConfirmationFingerprint({ ...canonicalJournal, reversesTransactionId: '00000000-0000-0000-0000-000000000599' }), 'reversal linkage is material fingerprint content');
  assert.notEqual(createJournalConfirmationFingerprint(canonicalJournal), createJournalConfirmationFingerprint({ ...canonicalJournal, entries: [{ ...canonicalJournal.entries[0], sourceRef: 'other-source' }] }), 'complete entry material is fingerprint content');
  assert.equal(createJournalConfirmationFingerprint(canonicalJournal), createJournalConfirmationFingerprint({ ...canonicalJournal, entries: [{ ...canonicalJournal.entries[0], money: Money.parse('1.0', 'EUR') }] }), 'lexically equivalent Money has the same Journal fingerprint');
  assert.notEqual(createCanonicalFinanceFingerprint({ effectiveAt: canonicalJournal.effectiveAt }), createCanonicalFinanceFingerprint({ effectiveAt: {} }), 'Date must not degrade to an empty object');
  assert.notEqual(identity('sensitivity', '1.00').canonicalFingerprint, identity('sensitivity', '2.00').canonicalFingerprint, 'material economic changes change the fingerprint');

  const sequentialIdentity = identity('sequential', '1.00');
  const first = await run(sequentialIdentity);
  const replay = await run(sequentialIdentity);
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.result.transactionId, first.result.transactionId);
  assert.deepEqual(await counts(), { commands: 1, journals: 1 });

  await assert.rejects(() => run(identity('sequential', '2.00'), '2.00'), /fingerprint/i);
  assert.deepEqual(await counts(), { commands: 1, journals: 1 });

  const sameConcurrent = identity('concurrent-same', '3.00');
  const sameResults = await Promise.all([run(sameConcurrent, '3.00'), run(sameConcurrent, '3.00')]);
  assert.deepEqual(sameResults.map((result) => result.replayed).sort(), [false, true]);
  assert.equal(sameResults[0].result.transactionId, sameResults[1].result.transactionId);
  assert.deepEqual(await counts(), { commands: 2, journals: 2 });

  const conflictResults = await Promise.allSettled([run(identity('concurrent-conflict', '4.00'), '4.00'), run(identity('concurrent-conflict', '5.00'), '5.00')]);
  assert.equal(conflictResults.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(conflictResults.filter((result) => result.status === 'rejected').length, 1);
  assert.deepEqual(await counts(), { commands: 3, journals: 3 });

  await Promise.all([run(identity('distinct-a', '6.00'), '6.00'), run(identity('distinct-b', '6.00'), '6.00')]);
  assert.deepEqual(await counts(), { commands: 5, journals: 5 });

  const lostIdentity = identity('lost-response', '7.00');
  await run(lostIdentity, '7.00');
  const recovered = await run(lostIdentity, '7.00');
  assert.equal(recovered.replayed, true);
  assert.deepEqual(await counts(), { commands: 6, journals: 6 });
  console.log('Finance idempotency and concurrency PostgreSQL: PASS');
} finally {
  const cleanup = await pool.connect().catch(() => undefined);
  if (cleanup) { try { await cleanup.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); } finally { cleanup.release(); } }
  await pool.end();
}
