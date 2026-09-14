import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import express from 'express';
import http from 'node:http';
import { once } from 'node:events';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { PostgresFinancialDocumentRepository } from '../src/modules/finance/financial-document-service.ts';
import { createSyntheticUatFiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';
import { registerFinancialDocumentRoutes } from '../src/modules/finance/financial-document-http.ts';

async function seed(client: pg.PoolClient, institutionId: string) {
  const person=randomUUID(), account=randomUUID(), feeType=randomUUID(), fee=randomUUID(), obligation=randomUUID(), payment=randomUUID(), paymentJournal=randomUUID(), allocationJournal=randomUUID(), receiptSeries=randomUUID(), invoiceReceiptSeries=randomUUID(), creditNoteSeries=randomUUID();
  await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Credit note',$2,'active')",[institutionId,`credit-note-${institutionId}`]);
  await client.query("INSERT INTO people(id,name) VALUES($1,'Payer')",[person]);
  await client.query("INSERT INTO institution_legal_profiles(institution_id,version,legal_name,tax_identifier,registered_address,effective_from) VALUES($1,1,'Issuer','NIF',$2,now()-interval '1 day')",[institutionId,{countryCode:'NEXUS_TEST',line1:'Rua 1'}]);
  await client.query("INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now()-interval '1 day','NEXUS_TEST','EUR','Europe/Lisbon','v1','[\"EUR\"]')",[institutionId]);
  await client.query("INSERT INTO finance_fiscal_configuration_versions(institution_id,version,adapter_key,effective_from) VALUES($1,1,'core',now()-interval '1 day')",[institutionId]);
  await client.query("INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'A','Account')",[account,institutionId]);
  await client.query("INSERT INTO finance_financial_account_parties(institution_id,financial_account_id,person_id,role) VALUES($1,$2,$3,'primary_debtor')",[institutionId,account,person]);
  await client.query("INSERT INTO finance_fee_types(id,institution_id,source,display_name,code_prefix) VALUES($1,$2,'institution_custom','Fee','FEE')",[feeType,institutionId]);
  await client.query("INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'FEE-1',1,$4)",[fee,institutionId,feeType,person]);
  await client.query("INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'Fee','fee',100,'EUR',now()-interval '1 day',$4)",[institutionId,fee,feeType,person]);
  await client.query("INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,status,financial_profile_version,created_by_person_id,idempotency_key,due_at) VALUES($1,$2,$3,$4,1,'manual_finance','OBR-1',100,'EUR','open',1,$5,'obr',now()+interval '10 days')",[obligation,institutionId,account,fee,person]);
  await client.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',40,'pay','foundation_value_received',$3,1,now())",[paymentJournal,institutionId,person]);
  await client.query("INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,financial_account_id,source_type,method,amount,currency,status,allocation_status,payer_person_id,effective_at,financial_profile_version,actor_person_id) VALUES($1,$2,'PAG-1',$3,$4,'manual_offline','cash',40,'EUR','confirmed','unapplied',$5,now(),1,$5)",[payment,institutionId,paymentJournal,account,person]);
  await client.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',40,'allocation','payment_allocation',$3,1,now())",[allocationJournal,institutionId,person]);
  await client.query("INSERT INTO finance_allocations(id,institution_id,financial_account_id,payment_id,obligation_id,journal_transaction_id,amount,currency,effective_at,actor_person_id) VALUES($1,$2,$3,$4,$5,$6,40,'EUR',now(),$7)",[randomUUID(),institutionId,account,payment,obligation,allocationJournal,person]);
  await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,document_type,status,effective_from,next_sequence_number) VALUES($1,$2,'REC','receipt','active',now()-interval '1 day',1),($3,$2,'FR','invoice_receipt','active',now()-interval '1 day',1),($4,$2,'NC','credit_note','active',now()-interval '1 day',1)",[receiptSeries,institutionId,invoiceReceiptSeries,creditNoteSeries]);
  return { payment, obligation, receiptSeries, invoiceReceiptSeries, creditNoteSeries };
}

test('P01 PostgreSQL credit note is bounded, immutable, tenant-safe and idempotent', async () => {
  await verifyApprovedTestConnection(); const schema=`credit_note_${randomUUID().replaceAll('-','')}`, quote=(v:string)=>`\"${v.replaceAll('\"','\"\"')}\"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`}); const institutionId=randomUUID();
  try {
    const client=await pool.connect(); let fixture: Awaited<ReturnType<typeof seed>>; try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); fixture=await seed(client,institutionId); } finally { client.release(); }
    const repo=new PostgresFinancialDocumentRepository(pool,createSyntheticUatFiscalAdapterRegistry());
    const ineligibleOriginal=await repo.issue({institutionId,sourceInstitutionId:institutionId,sourceType:'payment',sourceId:fixture!.payment,seriesId:fixture!.receiptSeries,idempotencyKey:'receipt-original',documentType:'receipt'});
    await assert.rejects(()=>repo.issueCreditNote({institutionId,originalDocumentId:ineligibleOriginal.id,seriesId:fixture!.creditNoteSeries,amount:'1',currency:'EUR',idempotencyKey:'ineligible-original'}),/CREDIT_NOTE_ORIGINAL_INELIGIBLE/);
    const original=await repo.issueInvoiceReceipt({institutionId,sourceInstitutionId:institutionId,sourceType:'payment',paymentId:fixture!.payment,obligationId:fixture!.obligation,seriesId:fixture!.invoiceReceiptSeries,idempotencyKey:'original'});
    const before=await pool.query<{snapshot:unknown;source:unknown;payments:number;allocations:number}>('SELECT (SELECT documentary_snapshot FROM finance_financial_documents WHERE institution_id=$1 AND id=$2) snapshot,(SELECT source_snapshot FROM finance_financial_documents WHERE institution_id=$1 AND id=$2) source,(SELECT count(*)::int FROM finance_payments WHERE institution_id=$1) payments,(SELECT count(*)::int FROM finance_allocations WHERE institution_id=$1) allocations',[institutionId,original.id]);
    const command={institutionId,originalDocumentId:original.id,seriesId:fixture!.creditNoteSeries,amount:'0.3',currency:'EUR',idempotencyKey:'credit-note'};
    const issued=await repo.issueCreditNote(command), replay=await repo.issueCreditNote(command); assert.equal(issued.id,replay.id); assert.equal(issued.sequenceNumber,1); assert.equal(replay.replayed,true);
    const after=await pool.query<{document_type:string;corrects_document_id:string;snapshot:any;source:unknown;payments:number;allocations:number;audit:number;outbox:number;next:string}>("SELECT (SELECT document_type FROM finance_financial_documents WHERE id=$2) document_type,(SELECT corrects_document_id FROM finance_financial_documents WHERE id=$2) corrects_document_id,(SELECT documentary_snapshot FROM finance_financial_documents WHERE id=$2) snapshot,(SELECT source_snapshot FROM finance_financial_documents WHERE id=$4) source,(SELECT count(*)::int FROM finance_payments WHERE institution_id=$1) payments,(SELECT count(*)::int FROM finance_allocations WHERE institution_id=$1) allocations,(SELECT count(*)::int FROM finance_audit_records WHERE institution_id=$1 AND event_type='financial_document_corrected') audit,(SELECT count(*)::int FROM finance_outbox WHERE institution_id=$1 AND topic='financial_document_corrected') outbox,(SELECT next_sequence_number::text FROM finance_financial_document_series WHERE id=$3) next",[institutionId,issued.id,fixture!.creditNoteSeries,original.id]);
    assert.equal(after.rows[0]?.document_type,'credit_note'); assert.equal(after.rows[0]?.corrects_document_id,original.id); assert.equal(after.rows[0]?.snapshot.snapshotVersion,5); assert.equal(after.rows[0]?.snapshot.correction.amount,'0.3'); assert.deepEqual(after.rows[0]?.source,before.rows[0]?.source); assert.equal(after.rows[0]?.payments,before.rows[0]?.payments); assert.equal(after.rows[0]?.allocations,before.rows[0]?.allocations); assert.equal(after.rows[0]?.audit,1); assert.equal(after.rows[0]?.outbox,1); assert.equal(after.rows[0]?.next,'2');
    const unchanged=await pool.query<{snapshot:unknown}>('SELECT documentary_snapshot snapshot FROM finance_financial_documents WHERE institution_id=$1 AND id=$2',[institutionId,original.id]); assert.deepEqual(unchanged.rows[0]?.snapshot,before.rows[0]?.snapshot);
    await assert.rejects(()=>repo.issueCreditNote({...command,idempotencyKey:'aggregate-over',amount:'99.8'}),/CREDIT_NOTE_AMOUNT_EXCEEDS_ORIGINAL/);
    await assert.rejects(()=>repo.issueCreditNote({...command,idempotencyKey:'over',amount:'100.01'}),/CREDIT_NOTE_AMOUNT_EXCEEDS_ORIGINAL/);
    await assert.rejects(()=>repo.issueCreditNote({...command,idempotencyKey:'wrong-currency',currency:'USD'}),/CREDIT_NOTE_CURRENCY_MISMATCH/);
    await assert.rejects(()=>repo.issueCreditNote({...command,institutionId:randomUUID(),idempotencyKey:'foreign'}),/FINANCIAL_DOCUMENT_ORIGINAL_NOT_FOUND/);
    await assert.rejects(()=>repo.issueCreditNote({...command,amount:'0.4'}),/fingerprint conflict/);
    const rejected=await pool.query<{next:string}>('SELECT next_sequence_number::text next FROM finance_financial_document_series WHERE id=$1',[fixture!.creditNoteSeries]); assert.equal(rejected.rows[0]?.next,'2');
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined); await pool.end(); }
});

test('P01 credit-note HTTP derives institution and correction permission server-side', async () => {
  await verifyApprovedTestConnection(); const schema=`credit_note_http_${randomUUID().replaceAll('-','')}`, quote=(v:string)=>`\"${v.replaceAll('\"','\"\"')}\"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`}); const institutionId=randomUUID(); let server: http.Server | undefined;
  try {
    const client=await pool.connect(); let fixture: Awaited<ReturnType<typeof seed>>; try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); fixture=await seed(client,institutionId); } finally { client.release(); }
    const repo=new PostgresFinancialDocumentRepository(pool,createSyntheticUatFiscalAdapterRegistry()); const original=await repo.issueInvoiceReceipt({institutionId,sourceInstitutionId:institutionId,sourceType:'payment',paymentId:fixture!.payment,obligationId:fixture!.obligation,seriesId:fixture!.invoiceReceiptSeries,idempotencyKey:'original'});
    const app=express(); app.use(express.json()); const auth:any=(req:any,_res:any,next:any)=>{ if(req.header('Authorization')==='Bearer admin') req.institutionalContext={institutionId,role:'institution_admin'}; if(req.header('Authorization')==='Bearer readonly') req.institutionalContext={institutionId,role:'director'}; if(req.header('Authorization')==='Bearer foreign') req.institutionalContext={institutionId:randomUUID(),role:'institution_admin'}; next(); };
    registerFinancialDocumentRoutes(app,pool,auth,createSyntheticUatFiscalAdapterRegistry()); server=http.createServer(app); server.listen(0,'127.0.0.1'); await once(server,'listening'); const base=`http://127.0.0.1:${(server.address() as any).port}/api/finance/documents/${original.id}/credit-note`;
    const payload={seriesId:fixture!.creditNoteSeries,amount:'10',currency:'EUR',institutionId:randomUUID()};
    const readonly=await fetch(base,{method:'POST',headers:{Authorization:'Bearer readonly','Content-Type':'application/json','Idempotency-Key':'readonly'},body:JSON.stringify(payload)}); assert.equal(readonly.status,403);
    const foreign=await fetch(base,{method:'POST',headers:{Authorization:'Bearer foreign','Content-Type':'application/json','Idempotency-Key':'foreign'},body:JSON.stringify(payload)}); assert.equal(foreign.status,404);
    const readiness=await fetch(`${base}-readiness`,{headers:{Authorization:'Bearer admin'}}); assert.equal(readiness.status,200); assert.deepEqual(await readiness.json(),{status:'ELIGIBLE',seriesId:fixture!.creditNoteSeries,currency:'EUR',maximumAmount:'100'});
    const foreignReadiness=await fetch(`${base}-readiness`,{headers:{Authorization:'Bearer foreign'}}); assert.equal(foreignReadiness.status,404);
    const issued=await fetch(base,{method:'POST',headers:{Authorization:'Bearer admin','Content-Type':'application/json','Idempotency-Key':'admin'},body:JSON.stringify(payload)}); assert.equal(issued.status,201); const body=await issued.json(); assert.equal(body.sequenceNumber,1);
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>(resolve => server!.close(() => resolve()));
    }
    await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined);
    await pool.end();
  }
});
