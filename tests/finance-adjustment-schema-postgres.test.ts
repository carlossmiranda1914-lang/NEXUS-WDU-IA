import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_adjustment_schema_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const rejects = async (action: () => Promise<unknown>, label: string) => assert.rejects(action, undefined, label);

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);
    await runMigrations(client, await discoverMigrations(migrations));
    const table = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name='finance_obligation_adjustments'`, [schema]);
    assert.equal(table.rowCount, 1, 'canonical immutable adjustment fact must exist');
    const institution = randomUUID(), account = randomUUID(), person = randomUUID(), feeType = randomUUID(), fee = randomUUID(), obligation = randomUUID(), journal = randomUUID(), adjustment = randomUUID();
    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES($1,'Adjustment','adjustment','active')`, [institution]);
    await client.query(`INSERT INTO people(id,name) VALUES($1,'Actor')`, [person]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR"]')`, [institution]);
    await client.query(`INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'ADJ-1','Adjustment')`, [account, institution]);
    await client.query(`INSERT INTO finance_fee_types(id,institution_id,canonical_key,source,display_name,code_prefix) VALUES($1,$2,'other','nexus_base','Other','ADJ')`, [feeType, institution]);
    await client.query(`INSERT INTO finance_fee_catalogue_items(id,institution_id,code,status,current_version,created_by_person_id,fee_type_id) VALUES($1,$2,'ADJ-1','active',1,$3,$4)`, [fee, institution, person, feeType]);
    await client.query(`INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,version,name,kind,amount,currency,effective_from,created_by_person_id,fee_type_id) VALUES($1,$2,1,'Adjustment fee','other','100','EUR',now(),$3,$4)`, [institution, fee, person, feeType]);
    await client.query(`INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,financial_profile_version,created_by_person_id,idempotency_key) VALUES($1,$2,$3,$4,1,'manual_finance','adjustment','100','EUR',1,$5,'obligation')`, [obligation,institution,account,fee,person]);
    await client.query(`INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR','10','adjustment-journal','obligation_adjustment',$3,1,now())`, [journal,institution,person]);
    await client.query(`INSERT INTO finance_obligation_adjustments(id,institution_id,financial_account_id,obligation_id,direction,amount,currency,reason,journal_transaction_id,actor_person_id) VALUES($1,$2,$3,$4,'increase','10','EUR','Correction',$5,$6)`, [adjustment,institution,account,obligation,journal,person]);
    await rejects(() => client.query(`INSERT INTO finance_obligation_adjustments(institution_id,financial_account_id,obligation_id,direction,amount,currency,reason,journal_transaction_id,actor_person_id) VALUES($1,$2,$3,'increase','0','EUR','Zero',$4,$5)`, [institution,account,obligation,journal,person]), 'zero Money must reject');
    await rejects(() => client.query(`INSERT INTO finance_obligation_adjustments(institution_id,financial_account_id,obligation_id,direction,amount,currency,reason,journal_transaction_id,actor_person_id) VALUES($1,$2,$3,'increase','1','EUR',repeat('x',501),$4,$5)`, [institution,account,obligation,journal,person]), 'reason over 500 must reject');
    await rejects(() => client.query(`UPDATE finance_obligation_adjustments SET reason='mutated' WHERE id=$1`, [adjustment]), 'adjustment fact must reject UPDATE');
    await rejects(() => client.query(`DELETE FROM finance_obligation_adjustments WHERE id=$1`, [adjustment]), 'adjustment fact must reject DELETE');
    await rejects(() => client.query(`INSERT INTO finance_journal_transactions(institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,'confirmed','EUR','1','unsupported','not_a_finance_type',$2,1,now())`, [institution,person]), 'unsupported journal type must reject');
    console.log('Finance Adjustment Schema PostgreSQL: PASS');
  } finally { client.release(); }
} finally {
  const client = await pool.connect().catch(() => undefined);
  if (client) { try { await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`); } finally { client.release(); } }
  await pool.end();
}
