import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { PostgresFinancialDocumentRepository } from '../src/modules/finance/financial-document-service.ts';
import { createSyntheticUatFiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';

const q = (value: string) => `"${value.replaceAll('"', '""')}"`;
async function seed(client: pg.PoolClient, institutionId: string, basis = 'debit_event') {
  const person=randomUUID(), account=randomUUID(), feeType=randomUUID(), fee=randomUUID(), obligation=randomUUID(), adjustment=randomUUID(), journal=randomUUID(), series=randomUUID();
  await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Debit',$2,'active')",[institutionId,`debit-${institutionId}`]);
  await client.query("INSERT INTO people(id,name) VALUES($1,'Operator')",[person]);
  await client.query("INSERT INTO institution_legal_profiles(institution_id,version,legal_name,tax_identifier,registered_address,effective_from) VALUES($1,1,'Issuer','NIF',$2,now()-interval '1 day')",[institutionId,{countryCode:'NEXUS_TEST',line1:'Rua 1'}]);
  await client.query("INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now()-interval '1 day','NEXUS_TEST','EUR','Europe/Lisbon','v1','[\"EUR\"]')",[institutionId]);
  await client.query("INSERT INTO finance_fiscal_configuration_versions(institution_id,version,adapter_key,effective_from) VALUES($1,1,'core',now()-interval '1 day')",[institutionId]);
  await client.query("INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'A','Account')",[account,institutionId]);
  await client.query("INSERT INTO finance_financial_account_parties(institution_id,financial_account_id,person_id,role) VALUES($1,$2,$3,'primary_debtor')",[institutionId,account,person]);
  await client.query("INSERT INTO finance_fee_types(id,institution_id,source,display_name,code_prefix) VALUES($1,$2,'institution_custom','Fee','FEE')",[feeType,institutionId]);
  await client.query("INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'FEE-1',1,$4)",[fee,institutionId,feeType,person]);
  await client.query("INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'Fee','fee',100,'EUR',now()-interval '1 day',$4)",[institutionId,fee,feeType,person]);
  await client.query("INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,status,financial_profile_version,created_by_person_id,idempotency_key,due_at) VALUES($1,$2,$3,$4,1,'manual_finance','OBR-1',100,'EUR','open',1,$5,'obr',now()+interval '1 day')",[obligation,institutionId,account,fee,person]);
  await client.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',40,'debit-event','obligation_adjustment',$3,1,now())",[journal,institutionId,person]);
  await client.query("INSERT INTO finance_obligation_adjustments(id,institution_id,financial_account_id,obligation_id,direction,amount,currency,reason,basis_type,journal_transaction_id,effective_at,actor_kind,actor_person_id) VALUES($1,$2,$3,$4,'increase',40,'EUR','Evento factual',$5,$6,now(),'human',$7)",[adjustment,institutionId,account,obligation,basis,journal,person]);
  await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,document_type,status,effective_from,next_sequence_number) VALUES($1,$2,'ND','debit_note','active',now()-interval '1 day',1)",[series,institutionId]);
  return { adjustment, series, account, obligation, person };
}

test('Task 9 directly issues a tenant-safe, idempotent debit note from one debit_event', async () => {
  await verifyApprovedTestConnection(); const schema=`debit_note_${randomUUID().replaceAll('-','')}`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${q(schema)},public`}); const institutionId=randomUUID();
  try { const client=await pool.connect(); let fixture: Awaited<ReturnType<typeof seed>>; try { await client.query(`CREATE SCHEMA ${q(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); fixture=await seed(client,institutionId); } finally { client.release(); }
    const repo=new PostgresFinancialDocumentRepository(pool,createSyntheticUatFiscalAdapterRegistry()); const command={institutionId,adjustmentId:fixture!.adjustment,seriesId:fixture!.series,idempotencyKey:'debit-note'}; const issued=await repo.issueDebitNote(command); const replay=await repo.issueDebitNote(command);
    assert.equal(issued.id,replay.id); assert.equal(replay.replayed,true); assert.equal(issued.sequenceNumber,1);
    const row=await pool.query<any>("SELECT d.document_type,d.documentary_snapshot,d.source_snapshot,(SELECT source_id FROM finance_financial_document_sources s WHERE s.institution_id=d.institution_id AND s.document_id=d.id) adjustment_id,(SELECT count(*)::int FROM finance_audit_records WHERE institution_id=$1 AND metadata->>'documentId'=d.id::text) audit,(SELECT count(*)::int FROM finance_outbox WHERE institution_id=$1 AND payload->>'documentId'=d.id::text) outbox FROM finance_financial_documents d WHERE d.institution_id=$1 AND d.id=$2",[institutionId,issued.id]);
    assert.equal(row.rows[0].document_type,'debit_note'); assert.equal(row.rows[0].documentary_snapshot.snapshotVersion,6); assert.equal(row.rows[0].documentary_snapshot.debitEvent.amount,'40.000000000000'); assert.equal(row.rows[0].documentary_snapshot.tax.amount,'0'); assert.equal(row.rows[0].adjustment_id,fixture!.adjustment); assert.equal(row.rows[0].audit,1); assert.equal(row.rows[0].outbox,1);
    const decrease=randomUUID(), decreaseJournal=randomUUID();
    await pool.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',1,'debit-decrease','obligation_adjustment',$3,1,now())",[decreaseJournal,institutionId,fixture!.person]);
    await pool.query("INSERT INTO finance_obligation_adjustments(id,institution_id,financial_account_id,obligation_id,direction,amount,currency,reason,basis_type,journal_transaction_id,effective_at,actor_kind,actor_person_id) VALUES($1,$2,$3,$4,'decrease',1,'EUR','Decréscimo',$5,$6,now(),'human',$7)",[decrease,institutionId,fixture!.account,fixture!.obligation,'general',decreaseJournal,fixture!.person]);
    await assert.rejects(()=>repo.issueDebitNote({institutionId,adjustmentId:decrease,seriesId:fixture!.series,idempotencyKey:'decrease'}),/DEBIT_NOTE_SOURCE_NOT_ELIGIBLE/);
    const second=randomUUID(), secondJournal=randomUUID();
    await pool.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',20,'debit-second','obligation_adjustment',$3,1,now())",[secondJournal,institutionId,fixture!.person]);
    await pool.query("INSERT INTO finance_obligation_adjustments(id,institution_id,financial_account_id,obligation_id,direction,amount,currency,reason,basis_type,journal_transaction_id,effective_at,actor_kind,actor_person_id) VALUES($1,$2,$3,$4,'increase',20,'EUR','Segundo evento',$5,$6,now(),'human',$7)",[second,institutionId,fixture!.account,fixture!.obligation,'debit_event',secondJournal,fixture!.person]);
    const secondIssued=await repo.issueDebitNote({institutionId,adjustmentId:second,seriesId:fixture!.series,idempotencyKey:'debit-note-second'});
    assert.notEqual(secondIssued.id,issued.id); assert.notEqual(secondIssued.sequenceNumber,issued.sequenceNumber);
    const numbers=await pool.query<{count:number;distinct_count:number}>("SELECT count(*)::int count,count(DISTINCT sequence_number)::int distinct_count FROM finance_financial_documents WHERE institution_id=$1 AND document_type='debit_note'",[institutionId]);
    assert.deepEqual(numbers.rows[0],{count:2,distinct_count:2});
    await assert.rejects(()=>repo.issueDebitNote({...command,idempotencyKey:'general',adjustmentId:randomUUID()}),/DEBIT_NOTE_SOURCE_NOT_ELIGIBLE/);
    await assert.rejects(()=>repo.issueDebitNote({...command,adjustmentId:randomUUID()}),/fingerprint conflict/);
    await assert.rejects(()=>repo.issueDebitNote({...command,institutionId:randomUUID(),idempotencyKey:'foreign'}),/DEBIT_NOTE_SOURCE_NOT_ELIGIBLE/);
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${q(schema)} CASCADE`).catch(()=>undefined); await pool.end(); }
});
console.log('FINANCE_FINANCIAL_DOCUMENT_DEBIT_NOTE_POSTGRES=PASS');
