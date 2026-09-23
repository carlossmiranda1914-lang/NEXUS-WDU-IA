import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import http from 'node:http';
import { once } from 'node:events';
import { registerFinancialDocumentRoutes } from '../src/modules/finance/financial-document-http.ts';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
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

test('Task 9 HTTP authorized issuance creates a debit note from a persisted debit_event', async () => {
  await verifyApprovedTestConnection();
  const schema=`debit_note_http_${randomUUID().replaceAll('-','')}`;
  const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${q(schema)},public`});
  const institutionId=randomUUID();
  const foreignInstitutionId=randomUUID();
  const generalInstitutionId=randomUUID();
  let server: http.Server | undefined;
  try {
    const client=await pool.connect(); let fixture: Awaited<ReturnType<typeof seed>>; let foreign: Awaited<ReturnType<typeof seed>>; let general: Awaited<ReturnType<typeof seed>>;
    try {
      await client.query(`CREATE SCHEMA ${q(schema)}`);
      await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations')));
      fixture=await seed(client,institutionId);
      foreign=await seed(client,foreignInstitutionId);
      general=await seed(client,generalInstitutionId,'general');
    } finally { client.release(); }
    const app=express();
    app.use(express.json());
    const auth:any=(req:any,_res:any,next:any)=>{
      if(req.header('Authorization')==='Bearer financial') req.institutionalContext={institutionId,role:'financial'};
      if(req.header('Authorization')==='Bearer director') req.institutionalContext={institutionId,role:'director'};
      if(req.header('Authorization')==='Bearer financial-b') req.institutionalContext={institutionId:foreignInstitutionId,role:'financial'};
      if(req.header('Authorization')==='Bearer financial-general') req.institutionalContext={institutionId:generalInstitutionId,role:'financial'};
      next();
    };
    registerFinancialDocumentRoutes(app,pool,auth,createSyntheticUatFiscalAdapterRegistry());
    server=http.createServer(app); server.listen(0,'127.0.0.1'); await once(server,'listening');
    const request=(authorization:string,adjustmentId:string,seriesId:string,idempotencyKey:string)=>fetch(`http://127.0.0.1:${(server.address() as any).port}/api/finance/debit-notes`,{
      method:'POST',
      headers:{Authorization:authorization,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},
      body:JSON.stringify({adjustmentId,seriesId}),
    });
    const unauthorized=await request('Bearer director',fixture!.adjustment,fixture!.series,'unauthorized-role');
    assert.equal(unauthorized.status,403,await unauthorized.text());
    const crossTenant=await request('Bearer financial',foreign!.adjustment,foreign!.series,'cross-tenant');
    const crossTenantBody=await crossTenant.text();
    assert.equal(crossTenant.status,404,crossTenantBody);
    assert.equal(crossTenantBody.includes(foreignInstitutionId),false);
    assert.equal(crossTenantBody.includes(foreign!.adjustment),false);
    const generalSource=await request('Bearer financial-general',general!.adjustment,general!.series,'general-source');
    assert.equal(generalSource.status,404,await generalSource.text());
    const invalidSource=await request('Bearer financial',randomUUID(),fixture!.series,'invalid-source');
    assert.equal(invalidSource.status,404,await invalidSource.text());
    const response=await request('Bearer financial',fixture!.adjustment,fixture!.series,'authorized-debit-note');
    const responseBody=await response.text();
    assert.equal(response.status,201,responseBody);
    const issued=JSON.parse(responseBody);
    assert.equal(issued.documentType,'debit_note',responseBody);
    assert.ok(issued.id);
    const replay=await request('Bearer financial',fixture!.adjustment,fixture!.series,'authorized-debit-note');
    const replayBody=await replay.text();
    assert.equal(replay.status,200,replayBody);
    const replayed=JSON.parse(replayBody);
    assert.equal(replayed.id,issued.id);
    assert.equal(replayed.replayed,true);
    const documentCount=await pool.query<{count:number}>("SELECT count(*)::int AS count FROM finance_financial_documents WHERE institution_id=$1 AND document_type='debit_note'",[institutionId]);
    assert.equal(documentCount.rows[0]?.count,1);
    const conflict=await request('Bearer financial',randomUUID(),fixture!.series,'authorized-debit-note');
    assert.equal(conflict.status,409,await conflict.text());
    const persisted=await pool.query<{institution_id:string;document_type:string;source_id:string}>(
      "SELECT d.institution_id,d.document_type,s.source_id FROM finance_financial_documents d JOIN finance_financial_document_sources s ON s.institution_id=d.institution_id AND s.document_id=d.id WHERE d.id=$1",
      [issued.id],
    );
    assert.deepEqual(persisted.rows,[{institution_id:institutionId,document_type:'debit_note',source_id:fixture!.adjustment}]);
  } finally {
    await new Promise<void>(resolve=>server?.close(()=>resolve()) ?? resolve());
    await pool.query(`DROP SCHEMA IF EXISTS ${q(schema)} CASCADE`).catch(()=>undefined);
    await pool.end();
  }
});
console.log('FINANCE_FINANCIAL_DOCUMENT_DEBIT_NOTE_HTTP=PASS');

