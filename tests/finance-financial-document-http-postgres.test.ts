import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { registerFinancialDocumentRoutes } from '../src/modules/finance/financial-document-http.ts';

test('F7-04 fiscal configuration HTTP replays one canonical mutation', async () => {
  await verifyApprovedTestConnection(); const schema=`finance_document_http_${randomUUID().replaceAll('-','')}`; const quote=(v:string)=>`"${v.replaceAll('"','""')}"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`}); const institutionId=randomUUID(); let server: http.Server | undefined;
  try { const client=await pool.connect(); try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'HTTP','f7-http','active')",[institutionId]); } finally {client.release();}
    const app=express(); app.use(express.json()); const auth:any=(req:any,_res:any,next:any)=>{if(req.header('Authorization')==='Bearer admin')req.institutionalContext={institutionId,role:'institution_admin'};next();}; registerFinancialDocumentRoutes(app,pool,auth); server=http.createServer(app); server.listen(0,'127.0.0.1'); await once(server,'listening'); const base=`http://127.0.0.1:${(server.address() as any).port}/api/finance`; const body={version:1,adapterKey:'core',operationalConfiguration:{},effectiveFrom:'2026-01-01T00:00:00.000Z'}; const post=()=>fetch(`${base}/fiscal-configurations`,{method:'POST',headers:{Authorization:'Bearer admin','Content-Type':'application/json','Idempotency-Key':'fiscal-replay'},body:JSON.stringify(body)}); assert.equal((await post()).status,201); assert.equal((await post()).status,200); assert.equal((await pool.query('SELECT count(*)::int count FROM finance_fiscal_configuration_versions WHERE institution_id=$1',[institutionId])).rows[0]?.count,1); const seriesBody={code:'HTTP',documentType:'receipt',effectiveFrom:'2026-01-01T00:00:00.000Z'}; const postSeries=()=>fetch(`${base}/document-series`,{method:'POST',headers:{Authorization:'Bearer admin','Content-Type':'application/json','Idempotency-Key':'series-replay'},body:JSON.stringify(seriesBody)}); assert.equal((await postSeries()).status,201); assert.equal((await postSeries()).status,200); const series=(await pool.query<{id:string}>('SELECT id FROM finance_financial_document_series WHERE institution_id=$1',[institutionId])).rows[0]!; await pool.query("INSERT INTO finance_financial_documents(institution_id,document_type,status,series_id,sequence_number,source_snapshot,issued_at) VALUES($1,'receipt','issued',$2,1,'{\"sourceType\":\"payment\"}',now())",[institutionId,series.id]); const list=await fetch(`${base}/documents?limit=1`,{headers:{Authorization:'Bearer admin'}}); assert.equal(list.status,200); assert.equal((await list.json()).items.length,1); const detail=await fetch(`${base}/documents/${(await pool.query<{id:string}>('SELECT id FROM finance_financial_documents WHERE institution_id=$1',[institutionId])).rows[0]!.id}`,{headers:{Authorization:'Bearer admin'}}); assert.equal(detail.status,200);
  } finally {server?.close();await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined);await pool.end();}
});

test('F7-04 HTTP delegates issuance and correction to the PostgreSQL authority', async () => {
  await verifyApprovedTestConnection();
  const schema = `finance_document_http_issue_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
  const institutionId = randomUUID(); const seriesId = randomUUID(); const personId = randomUUID(); const journalId = randomUUID(); const paymentId = randomUUID(); let server: http.Server | undefined;
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
      await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'HTTP issuance','f7-http-issue','active')", [institutionId]);
      await client.query("INSERT INTO people(id,name) VALUES($1,'HTTP payer')", [personId]);
      await client.query("INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now(),'NEXUS_TEST','EUR','Europe/Lisbon','v1','[\"EUR\"]')", [institutionId]);
      await client.query("INSERT INTO finance_fiscal_configuration_versions(institution_id,version,adapter_key,effective_from) VALUES($1,1,'core',now())", [institutionId]);
      await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,next_sequence_number) VALUES($1,$2,'HTTP',1)", [seriesId, institutionId]);
      await client.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',10,$3,'foundation_value_received',$4,1,now())", [journalId, institutionId, `http-source-${paymentId}`, personId]);
      await client.query("INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,source_type,method,amount,currency,status,allocation_status,payer_person_id,effective_at,financial_profile_version,actor_person_id) VALUES($1,$2,$3,$4,'manual_offline','cash',10,'EUR','confirmed','unapplied',$5,now(),1,$5)", [paymentId, institutionId, `PAY-${paymentId.slice(0, 8)}`, journalId, personId]);
    } finally { client.release(); }
    const app = express(); app.use(express.json()); const auth: any = (req: any, _res: any, next: any) => { if (req.header('Authorization') === 'Bearer admin') req.institutionalContext = { institutionId, role: 'institution_admin' }; next(); };
    registerFinancialDocumentRoutes(app, pool, auth); server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${(server.address() as any).port}/api/finance`;
    const issue = () => fetch(`${base}/documents/issue`, { method: 'POST', headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json', 'Idempotency-Key': 'http-issue' }, body: JSON.stringify({ sourceId: paymentId, seriesId, documentType: 'receipt', institutionId: randomUUID(), amount: 999 }) });
    const first = await issue(); assert.equal(first.status, 201); const original = await first.json(); const replay = await issue(); assert.equal(replay.status, 200); assert.equal((await replay.json()).id, original.id);
    const correction = () => fetch(`${base}/documents/${original.id}/corrections`, { method: 'POST', headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json', 'Idempotency-Key': 'http-correction' }, body: JSON.stringify({ seriesId, documentType: 'credit_note', institutionId: randomUUID() }) });
    assert.equal((await correction()).status, 201); assert.equal((await correction()).status, 200);
    const persisted = await pool.query<{ documents: number; corrections: number; payments: number; journals: number }>("SELECT (SELECT count(*)::int FROM finance_financial_documents WHERE institution_id=$1) documents,(SELECT count(*)::int FROM finance_financial_documents WHERE institution_id=$1 AND corrects_document_id=$2) corrections,(SELECT count(*)::int FROM finance_payments WHERE institution_id=$1) payments,(SELECT count(*)::int FROM finance_journal_transactions WHERE institution_id=$1) journals", [institutionId, original.id]);
    assert.deepEqual(persisted.rows[0], { documents: 2, corrections: 1, payments: 1, journals: 1 });
  } finally { server?.close(); await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});
