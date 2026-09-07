import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresObligationAdjustmentRepository } from '../src/modules/finance/obligation-adjustment-repository.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema=`finance_adjustment_command_${randomUUID().replaceAll('-','')}`; const q=(v:string)=>`"${v.replaceAll('"','""')}"`;
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${q(schema)},public`});
const institutionId=randomUUID(), personId=randomUUID(), accountId=randomUUID(), feeTypeId=randomUUID(), feeId=randomUUID();
const actor={personId,personName:'Adjustment actor',identityEmail:null,membershipId:randomUUID(),institutionId,institutionName:'Adjustment',institutionSlug:'adjustment',role:'financial' as const};
const repo=new PostgresObligationAdjustmentRepository(pool);
async function obligation(amount='100'){const id=randomUUID();await pool.query(`INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,status,financial_profile_version,created_by_person_id,idempotency_key) VALUES($1,$2,$3,$4,1,'manual_finance',$5,$6,'EUR','open',1,$7,$8)`,[id,institutionId,accountId,feeId,`adjustment-${id}`,amount,personId,`obligation-${id}`]);return id}
const record=(obligationId:string,direction:'increase'|'decrease',amount:string,key:string,extra:Record<string,unknown>={})=>repo.recordAdjustment(actor,{obligationId,direction,amount,currency:'EUR',reason:'Corrective Finance adjustment',...extra},key);
try { const c=await pool.connect();try {await c.query(`CREATE SCHEMA ${q(schema)}`);await runMigrations(c,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations')));await c.query(`INSERT INTO institutions(id,name,slug,status) VALUES($1,'Adjustment','adjustment','active')`,[institutionId]);await c.query(`INSERT INTO people(id,name) VALUES($1,'Actor')`,[personId]);await c.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR"]')`,[institutionId]);await c.query(`INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'ADJ-1','Adjustment')`,[accountId,institutionId]);await c.query(`INSERT INTO finance_fee_types(id,institution_id,source,display_name,code_prefix) VALUES($1,$2,'institution_custom','Adjustment','ADJ')`,[feeTypeId,institutionId]);await c.query(`INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'ADJ-1',1,$4)`,[feeId,institutionId,feeTypeId,personId]);await c.query(`INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'Adjustment','fee','100','EUR',now(),$4)`,[institutionId,feeId,feeTypeId,personId])}finally{c.release()}
 const target=await obligation(); const up=await record(target,'increase','10','up');assert.equal(up.adjustment.direction,'increase');assert.equal(up.position.effectiveDue.canonicalAmount(),'110');const down=await record(target,'decrease','20','down');assert.equal(down.position.effectiveDue.canonicalAmount(),'90');assert.equal((await pool.query(`SELECT count(*)::int value FROM finance_journal_transactions WHERE institution_id=$1 AND journal_type='obligation_adjustment'`,[institutionId])).rows[0].value,2);
 const replay=await record(target,'decrease','20','down');assert.equal(replay.replayed,true);await assert.rejects(()=>record(target,'decrease','19','down'),/fingerprint/i);
 await assert.rejects(()=>record(target,'decrease','100','floor'),/below covered|cover/i);
 const compensation=await record(target,'decrease','5','comp',{compensatesAdjustmentId:up.adjustment.id});assert.equal(compensation.adjustment.compensatesAdjustmentId,up.adjustment.id);await assert.rejects(()=>record(target,'decrease','6','over',{compensatesAdjustmentId:up.adjustment.id}),/compensat/i);
 console.log('Finance Adjustment PostgreSQL: PASS');
} finally {const c=await pool.connect().catch(()=>undefined);if(c){try{await c.query(`DROP SCHEMA IF EXISTS ${q(schema)} CASCADE`)}finally{c.release()}}await pool.end()}
