import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { Money } from '../src/modules/finance/money.ts';
import { createJournalConfirmationFingerprint, executeIdempotentFinanceCommand } from '../src/modules/finance/finance-command.ts';
import { PostgresJournalRepository } from '../src/modules/finance/journal-repository.ts';
import { validateConfirmation } from '../src/modules/finance/journal-model.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_journal_${randomUUID().replaceAll('-', '')}`;
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const institution = '00000000-0000-0000-0000-000000000101';
const foreignInstitution = '00000000-0000-0000-0000-000000000102';
const actor = '00000000-0000-0000-0000-000000000111';

async function count(client: pg.PoolClient, commandId: string) {
  const r = await client.query(`SELECT count(*)::int AS value FROM finance_journal_transactions WHERE command_id=$1`, [commandId]);
  return r.rows[0].value as number;
}
async function commandCount(client: pg.PoolClient, commandId: string) {
  const r = await client.query(`SELECT count(*)::int AS value FROM finance_command_results WHERE idempotency_key=$1`, [commandId]);
  return r.rows[0].value as number;
}
try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`); await client.query(`SET search_path TO ${quote(schema)}, public`);
    await runMigrations(client, await discoverMigrations(migrations));
    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES ($1,'A','ja','active'),($2,'B','jb','active')`, [institution, foreignInstitution]);
    await client.query(`INSERT INTO people(id,name) VALUES ($1,'Actor')`, [actor]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES ($1,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR"]')`, [institution]);
    const input = { institutionId: institution, commandId: 'happy', journalType: 'foundation_value_received' as const, effectiveAt: new Date(), entries: [{ positionType: 'received_value' as const, money: Money.parse('10.00', 'EUR'), sourceRef: 'fixture' }], actorPersonId: actor, financialProfileVersion: 1 };
    const repository = new PostgresJournalRepository(client);
    const result = await executeIdempotentFinanceCommand({
      pool,
      identity: { institutionId: institution, operationNamespace: 'finance.journal.confirmation', idempotencyKey: input.commandId, canonicalFingerprint: createJournalConfirmationFingerprint({ institutionId: input.institutionId, journalType: input.journalType, effectiveAt: input.effectiveAt, entries: input.entries, actorPersonId: input.actorPersonId, financialProfileVersion: input.financialProfileVersion }) },
      execute: async (commandClient) => {
        const confirmed = await new PostgresJournalRepository(commandClient).confirmInTransaction(commandClient, input);
        return { resultRef: confirmed.transactionId, result: confirmed };
      },
      loadResult: async (commandClient, resultRef) => {
        const loaded = await commandClient.query(`SELECT id FROM finance_journal_transactions WHERE institution_id=$1 AND id=$2 AND status='confirmed'`, [institution, resultRef]);
        if (!loaded.rows[0]) throw new Error('Persisted Journal result is missing');
        return { transactionId: loaded.rows[0].id as string };
      },
    });
    assert.equal(result.replayed, false);
    assert.ok(result.result.transactionId);
    assert.equal(await commandCount(client, 'happy'), 1, 'confirmation must persist structural command-result linkage');
    assert.ok(await repository.getConfirmed(institution, result.result.transactionId));
    assert.equal(await repository.getConfirmed(foreignInstitution, result.result.transactionId), null);
    const genericReversal = { ...input, commandId: 'generic-reversal', journalType: 'foundation_reversal' as const, entries: [{ ...input.entries[0], positionType: 'reversed_value' as const }] };
    await assert.rejects(() => executeIdempotentFinanceCommand({ pool, identity: { institutionId: institution, operationNamespace: 'finance.journal.confirmation', idempotencyKey: genericReversal.commandId, canonicalFingerprint: createJournalConfirmationFingerprint({ institutionId: genericReversal.institutionId, journalType: genericReversal.journalType, effectiveAt: genericReversal.effectiveAt, entries: genericReversal.entries, actorPersonId: genericReversal.actorPersonId, financialProfileVersion: genericReversal.financialProfileVersion }) }, execute: async commandClient => { const confirmed = await new PostgresJournalRepository(commandClient).confirmInTransaction(commandClient, genericReversal); return { resultRef: confirmed.transactionId, result: confirmed }; }, loadResult: async (_commandClient, resultRef) => ({ transactionId: resultRef }) }), /reversal.*guarded/i);
    assert.equal(await count(client, genericReversal.commandId), 0, 'generic reversal creates no Journal authority'); assert.equal(await commandCount(client, genericReversal.commandId), 0, 'generic reversal creates no command-result authority');
    const prepared = randomUUID();
    await client.query(`INSERT INTO finance_journal_transactions (id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version) VALUES ($1,$2,'prepared','EUR','1','prepared','foundation_value_received',$3,1)`, [prepared, institution, actor]);
    assert.equal(await repository.getConfirmed(institution, prepared), null);
    assert.throws(() => validateConfirmation({ ...input, entries: [{ ...input.entries[0], money: Money.parse('0', 'EUR') }] }), /positive/i, 'foundation value received rejects zero');
    assert.throws(() => validateConfirmation({ ...input, entries: [{ ...input.entries[0], money: Money.parse('-1', 'EUR') }] }), /positive/i, 'foundation value received rejects negative money');
    await assert.rejects(() => repository.confirm(client, input), /idempotent/i, 'direct confirmation bypasses the canonical idempotency boundary');
    await assert.rejects(() => repository.confirm(client, { ...input, commandId: 'mixed', entries: [...input.entries, { positionType: 'received_value', money: Money.parse('1', 'USD'), sourceRef: 'bad' }] }));
    await assert.rejects(() => repository.confirm(client, { ...input, commandId: 'foreign-profile', institutionId: foreignInstitution }));
    await assert.rejects(() => repository.confirm(client, { ...input, commandId: 'bad-position', entries: [{ ...input.entries[0], positionType: 'bad' as any }] }));
    const reversal = { ...input, commandId: 'reversal', journalType: 'foundation_reversal' as const, entries: [{ ...input.entries[0], positionType: 'reversed_value' as const }] };
    await assert.rejects(() => repository.confirm(client, reversal), /idempotent/i, 'foundation reversals cannot bypass executeFoundationReversal');
    await assert.rejects(() => repository.confirm(client, { ...input, commandId: 'wrong-received-semantics', entries: [{ ...input.entries[0], positionType: 'reversed_value' as const }] }));
    await assert.rejects(() => repository.confirm(client, { ...input, commandId: 'wrong-semantics', journalType: 'foundation_reversal' }));
    for (const point of ['after_transaction', 'after_entries', 'after_audit', 'after_outbox'] as const) {
      const commandId = `rollback-${point}`;
      await assert.rejects(() => new PostgresJournalRepository(client, point).confirm(client, { ...input, commandId }));
      assert.equal(await count(client, commandId), 0, `${point} must leave no transaction authority`);
      assert.equal(await commandCount(client, commandId), 0, `${point} must leave no command-result linkage`);
    }
    console.log('Finance Journal PostgreSQL: PASS');
  } finally { client.release(); }
} finally { const c = await pool.connect().catch(() => undefined); if (c) { try { await c.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); } finally { c.release(); } } await pool.end(); }
