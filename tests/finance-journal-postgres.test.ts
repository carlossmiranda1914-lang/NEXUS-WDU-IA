import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { Money } from '../src/modules/finance/money.ts';
import { PostgresJournalRepository } from '../src/modules/finance/journal-repository.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_journal_${randomUUID().replaceAll('-', '')}`;
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const institution = '00000000-0000-0000-0000-000000000101';
const foreignInstitution = '00000000-0000-0000-0000-000000000102';
const actor = '00000000-0000-0000-0000-000000000111';

async function count(client: pg.PoolClient, commandId: string) {
  const r = await client.query(`SELECT count(*)::int AS value FROM finance_journal_transactions WHERE command_id=$1`, [commandId]);
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
    const repository = new PostgresJournalRepository();
    const result = await repository.confirm(client, input);
    assert.ok(result.transactionId);
    assert.ok(await repository.getConfirmed(institution, result.transactionId));
    assert.equal(await repository.getConfirmed(foreignInstitution, result.transactionId), null);
    const prepared = randomUUID();
    await client.query(`INSERT INTO finance_journal_transactions (id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version) VALUES ($1,$2,'prepared','EUR','1','prepared','foundation_value_received',$3,1)`, [prepared, institution, actor]);
    assert.equal(await repository.getConfirmed(institution, prepared), null);
    await assert.rejects(() => repository.confirm(client, { ...input, commandId: 'mixed', entries: [...input.entries, { positionType: 'received_value', money: Money.parse('1', 'USD'), sourceRef: 'bad' }] }));
    await assert.rejects(() => repository.confirm(client, { ...input, commandId: 'foreign-profile', institutionId: foreignInstitution }));
    await assert.rejects(() => repository.confirm(client, { ...input, commandId: 'bad-position', entries: [{ ...input.entries[0], positionType: 'bad' as any }] }));
    for (const point of ['after_transaction', 'after_entries', 'after_audit', 'after_outbox'] as const) {
      const commandId = `rollback-${point}`;
      await assert.rejects(() => new PostgresJournalRepository(point).confirm(client, { ...input, commandId }));
      assert.equal(await count(client, commandId), 0, `${point} must leave no transaction authority`);
    }
    console.log('Finance Journal PostgreSQL: PASS');
  } finally { client.release(); }
} finally { const c = await pool.connect().catch(() => undefined); if (c) { try { await c.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); } finally { c.release(); } } await pool.end(); }
