import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { registerFinanceAllocationRoutes } from '../src/modules/finance/allocation-http.ts';
import { AllocationApiClient } from '../src/modules/finance/allocation-client.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const schema = `finance_allocation_http_${randomUUID().replaceAll('-', '')}`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const institutionA=randomUUID(), institutionB=randomUUID(), adminA=randomUUID(), teacherA=randomUUID(), adminB=randomUUID(), payer=randomUUID();
const accountA=randomUUID(), accountA2=randomUUID(), accountB=randomUUID(), effectiveAt='2026-09-06T10:00:00.000Z';
let feeItemId=''; let server: http.Server | undefined;
const tokenMap: Record<string, any>={
  adminA:{institutionId:institutionA,personId:adminA,personName:'Admin A',identityEmail:null,membershipId:randomUUID(),institutionName:'A',institutionSlug:'a',role:'institution_admin'},
  teacherA:{institutionId:institutionA,personId:teacherA,personName:'Teacher A',identityEmail:null,membershipId:randomUUID(),institutionName:'A',institutionSlug:'a',role:'teacher'},
  adminB:{institutionId:institutionB,personId:adminB,personName:'Admin B',identityEmail:null,membershipId:randomUUID(),institutionName:'B',institutionSlug:'b',role:'institution_admin'},
};
const auth: any=(req:any,_res:any,next:any)=>{const value=req.header('Authorization'); const token=value?.startsWith('Bearer ')?value.slice(7):''; if(tokenMap[token]) req.institutionalContext=tokenMap[token]; next();};
async function seedPayment(institutionId:string, accountId:string|null, personId:string, amount='150', currency='EUR') { const id=randomUUID(), journalId=randomUUID(); await pool.query(`INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed',$3,$4,$5,'foundation_value_received',$6,1,now())`,[journalId,institutionId,currency,amount,`pay-${id}`,personId]); await pool.query(`INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,source_type,method,amount,currency,status,allocation_status,financial_account_id,payer_person_id,effective_at,financial_profile_version,actor_person_id) VALUES($1,$2,$3,$4,'manual_offline','cash',$5,$6,'confirmed','unapplied',$7,$8,$9,1,$8)`,[id,institutionId,`PAY-${id.slice(0,8)}`,journalId,amount,currency,accountId,personId,effectiveAt]); return id; }
async function seedObligation(accountId:string, amount='100', currency='EUR', status='open') { const id=randomUUID(); await pool.query(`INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,status,financial_profile_version,created_by_person_id,idempotency_key) VALUES($1,$2,$3,$4,1,'manual_finance',$5,$6,$7,$8,1,$9,$10)`,[id,institutionA,accountId,feeItemId,`http-${id}`,amount,currency,status,adminA,`ob-${id}`]); return id; }

try {
  const client=await pool.connect(); try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations')));
    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','a','active'),($2,'B','b','active')`,[institutionA,institutionB]); await client.query(`INSERT INTO people(id,name) VALUES($1,'Admin A'),($2,'Teacher A'),($3,'Admin B'),($4,'Payer')`,[adminA,teacherA,adminB,payer]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR","USD"]'),($2,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR"]')`,[institutionA,institutionB]);
    await client.query(`INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'CTA-A','A'),($3,$2,'CTA-A2','A2'),($4,$5,'CTA-B','B')`,[accountA,institutionA,accountA2,accountB,institutionB]);
    const feeType=randomUUID(); feeItemId=randomUUID(); await client.query(`INSERT INTO finance_fee_types(id,institution_id,source,display_name,code_prefix) VALUES($1,$2,'institution_custom','HTTP fee','HTTP')`,[feeType,institutionA]); await client.query(`INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'HTTP-000001',1,$4)`,[feeItemId,institutionA,feeType,adminA]); await client.query(`INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'HTTP fee','fee',100,'EUR',now(),$4)`,[institutionA,feeItemId,feeType,adminA]);
  } finally {client.release();}
  const app=express(); app.use(express.json()); registerFinanceAllocationRoutes(app,pool,auth); server=http.createServer(app); server.listen(0,'127.0.0.1'); await once(server,'listening'); const base=`http://127.0.0.1:${(server.address() as any).port}`;
  const request=async(token:string|undefined,route:string,options:any={})=>{const headers:Record<string,string>={'Content-Type':'application/json',...(options.headers||{})};if(token)headers.Authorization=`Bearer ${token}`;const response=await fetch(base+route,{method:options.method||'GET',headers,body:options.body?JSON.stringify(options.body):undefined});return {status:response.status,body:await response.json().catch(()=>({}))};};
  const realClient = new AllocationApiClient({ getToken: async () => 'adminA', fetcher: (input, init) => fetch(`${base}${String(input)}`, init) });
  const clientPayment = await seedPayment(institutionA, accountA, adminA); const clientObligation = await seedObligation(accountA, '50');
  const clientConfirmation = await realClient.confirm({ paymentId: clientPayment, effectiveAt, lines: [{ obligationId: clientObligation, amount: '50.00', currency: 'EUR' }] }, 'real-client-confirm');
  assert.equal(clientConfirmation.replayed, false); assert.equal(clientConfirmation.allocations.length, 1);
  assert.equal((await pool.query(`SELECT count(*)::int count FROM finance_allocations WHERE institution_id=$1 AND payment_id=$2`, [institutionA, clientPayment])).rows[0].count, 1);
  const clientReversal = await realClient.reverse(clientConfirmation.allocations[0]!.id, { amount: '20.00', currency: 'EUR', reason: 'Real client correction', effectiveAt }, 'real-client-reverse');
  assert.equal(clientReversal.replayed, false); assert.equal((await pool.query(`SELECT count(*)::int count FROM finance_allocation_reversals WHERE institution_id=$1`, [institutionA])).rows[0].count, 1);
  const p=await seedPayment(institutionA,accountA,adminA); const a=await seedObligation(accountA,'100'), b=await seedObligation(accountA,'30'); const body={paymentId:p,effectiveAt,lines:[{obligationId:a,amount:'100.00',currency:'EUR'},{obligationId:b,amount:'20.00',currency:'EUR'}]};
  const created=await request('adminA','/api/finance/allocations',{method:'POST',headers:{'Idempotency-Key':'http-main'},body}); assert.equal(created.status,201); assert.equal(created.body.allocations.length,2);
  const replay=await request('adminA','/api/finance/allocations',{method:'POST',headers:{'Idempotency-Key':'http-main'},body}); assert.equal(replay.status,200); assert.equal(replay.body.replayed,true);
  const conflict=await request('adminA','/api/finance/allocations',{method:'POST',headers:{'Idempotency-Key':'http-main'},body:{...body,lines:[{obligationId:b,amount:'10',currency:'EUR'}]}}); assert.equal(conflict.status,409);
  assert.equal((await pool.query(`SELECT count(*)::int count FROM finance_allocations WHERE institution_id=$1 AND payment_id=$2`,[institutionA,p])).rows[0].count,2);
  assert.equal((await request('teacherA','/api/finance/allocations',{method:'POST',headers:{'Idempotency-Key':'role-denial'},body})).status,403);
  assert.equal((await request('adminA','/api/finance/allocations',{method:'POST',headers:{'Idempotency-Key':'missing'}})).status,422);
  const foreign=await seedPayment(institutionB,accountB,adminB); const foreignResult=await request('adminA','/api/finance/allocations',{method:'POST',headers:{'Idempotency-Key':'foreign'},body:{...body,paymentId:foreign}}); assert.equal(foreignResult.status,409); assert.equal(JSON.stringify(foreignResult.body).includes(foreign),false);
  const crossAccount=await seedObligation(accountA2); assert.equal((await request('adminA','/api/finance/allocations',{method:'POST',headers:{'Idempotency-Key':'cross-account'},body:{paymentId:await seedPayment(institutionA,accountA,adminA),effectiveAt,lines:[{obligationId:crossAccount,amount:'1',currency:'EUR'}]}})).status,409);
  const crossCurrency=await seedObligation(accountA,'10','USD'); assert.equal((await request('adminA','/api/finance/allocations',{method:'POST',headers:{'Idempotency-Key':'cross-currency'},body:{paymentId:await seedPayment(institutionA,accountA,adminA),effectiveAt,lines:[{obligationId:crossCurrency,amount:'1',currency:'USD'}]}})).status,409);
  const unconfirmed=await seedPayment(institutionA,null,adminA,'10'); assert.equal((await request('adminA','/api/finance/allocations',{method:'POST',headers:{'Idempotency-Key':'unconfirmed'},body:{paymentId:unconfirmed,effectiveAt,lines:[{obligationId:await seedObligation(accountA),amount:'1',currency:'EUR'}]}})).status,409);
  const closed=await seedObligation(accountA,'10','EUR','cancelled'); assert.equal((await request('adminA','/api/finance/allocations',{method:'POST',headers:{'Idempotency-Key':'closed'},body:{paymentId:await seedPayment(institutionA,accountA,adminA),effectiveAt,lines:[{obligationId:closed,amount:'1',currency:'EUR'}]}})).status,409);
  const allocationId=created.body.allocations.find((item:any)=>item.money.amount==='100')!.id; const reversal={amount:'30.00',currency:'EUR',reason:'HTTP correction',effectiveAt}; const reversed=await request('adminA',`/api/finance/allocations/${allocationId}/reversals`,{method:'POST',headers:{'Idempotency-Key':'reverse-main'},body:reversal}); assert.equal(reversed.status,201); const reverseReplay=await request('adminA',`/api/finance/allocations/${allocationId}/reversals`,{method:'POST',headers:{'Idempotency-Key':'reverse-main'},body:reversal}); assert.equal(reverseReplay.status,200); assert.equal((await request('adminA',`/api/finance/allocations/${allocationId}/reversals`,{method:'POST',headers:{'Idempotency-Key':'reverse-over'},body:{...reversal,amount:'80'}})).status,409);
  console.log('TASK5_HTTP_POSTGRES=PASS REAL_CLIENT_CONFIRM_HTTP_POSTGRES=PASS REAL_CLIENT_REVERSAL_HTTP_POSTGRES=PASS AUTHORIZED_ALLOCATION_HTTP=PASS IDEMPOTENT_REPLAY_HTTP=PASS FINGERPRINT_CONFLICT_HTTP=PASS ROLE_DENIAL_HTTP=PASS TENANT_NON_DISCLOSURE_HTTP=PASS CROSS_ACCOUNT_HTTP=PASS CROSS_CURRENCY_HTTP=PASS INVALID_LIFECYCLE_HTTP=PASS REVERSAL_HTTP=PASS OVER_REVERSAL_HTTP=PASS');
} finally { if(server)server.close(); const client=await pool.connect().catch(()=>undefined);if(client){try{await client.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);}finally{client.release();}}await pool.end(); }
