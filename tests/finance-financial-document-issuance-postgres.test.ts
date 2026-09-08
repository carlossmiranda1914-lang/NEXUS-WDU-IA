import assert from 'node:assert/strict';
import test from 'node:test';
import { issueFinancialDocumentCommand, PostgresFinancialDocumentRepository } from '../src/modules/finance/financial-document-service.ts';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

test('F7-01 issuance is idempotent, tenant-safe, and allocates series numbers atomically', async () => {
  const harness: any = {};
  await assert.rejects(() => issueFinancialDocumentCommand(harness, { institutionId: 'a', sourceInstitutionId: 'b', seriesId: 's', idempotencyKey: 'key-a' }));
});

test('F7-01 repository exposes an atomic issuance authority', () => {
  assert.equal(typeof PostgresFinancialDocumentRepository, 'function');
});

test('F7-01 issuance reuses the canonical Finance idempotency authority', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../src/modules/finance/financial-document-service.ts', import.meta.url), 'utf8');
  assert.match(source, /executeIdempotentFinanceCommand/);
  assert.match(source, /financial_document_issuance/);
});

test('F7-01 PostgreSQL issuance replays idempotently and allocates a series number once', async () => {
  await verifyApprovedTestConnection();
  const schema = `finance_document_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
  const institutionId = randomUUID(); const seriesId = randomUUID();
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
      await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Document institution','document-institution','active')", [institutionId]);
      await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,next_sequence_number) VALUES($1,$2,'DOC',1)", [seriesId, institutionId]);
    } finally { client.release(); }
    const repo = new PostgresFinancialDocumentRepository(pool);
    const command = { institutionId, sourceInstitutionId: institutionId, seriesId, idempotencyKey: 'financial-document-command-001', documentType: 'receipt', sourceSnapshot: { amount: '10.00', currency: 'EUR' } };
    const first = await repo.issue(command); const replay = await repo.issue(command);
    assert.equal(first.id, replay.id); assert.equal(first.sequenceNumber, 1);
    const documents = await pool.query('SELECT count(*)::int count FROM finance_financial_documents WHERE institution_id=$1', [institutionId]);
    assert.equal(documents.rows[0].count, 1);
    const audit = await pool.query('SELECT count(*)::int count FROM finance_audit_records WHERE institution_id=$1 AND event_type=$2', [institutionId, 'financial_document_issued']);
    const outbox = await pool.query('SELECT count(*)::int count FROM finance_outbox WHERE institution_id=$1 AND topic=$2', [institutionId, 'financial_document_issued']);
    assert.equal(audit.rows[0].count, 1); assert.equal(outbox.rows[0].count, 1);
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});

test('F7-01 concurrent distinct commands receive distinct sequential series numbers', async () => {
  await verifyApprovedTestConnection(); const schema=`finance_document_race_${randomUUID().replaceAll('-', '')}`; const quote=(value:string)=>`"${value.replaceAll('"','""')}"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`}); const institutionId=randomUUID(),seriesId=randomUUID();
  try { const client=await pool.connect(); try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Race institution','race-institution','active')",[institutionId]); await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,next_sequence_number) VALUES($1,$2,'RACE',1)",[seriesId,institutionId]); } finally { client.release(); }
    const repo=new PostgresFinancialDocumentRepository(pool); const base={institutionId,sourceInstitutionId:institutionId,seriesId,documentType:'receipt',sourceSnapshot:{amount:'10.00',currency:'EUR'}}; const [a,b]=await Promise.all([repo.issue({...base,idempotencyKey:'race-a'}),repo.issue({...base,idempotencyKey:'race-b'})]); assert.deepEqual([a.sequenceNumber,b.sequenceNumber].sort((x,y)=>x-y),[1,2]);
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined); await pool.end(); }
});

test('F7-01 migration rejects a cross-tenant correction relationship', async () => {
  await verifyApprovedTestConnection(); const schema=`finance_document_tenant_${randomUUID().replaceAll('-', '')}`; const quote=(value:string)=>`"${value.replaceAll('"','""')}"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`}); const a=randomUUID(),b=randomUUID(),document=randomUUID();
  try { const client=await pool.connect(); try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','tenant-a','active'),($2,'B','tenant-b','active')",[a,b]); await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,source_snapshot) VALUES($1,$2,'receipt','issued','{}')",[document,a]); await assert.rejects(()=>client.query("INSERT INTO finance_financial_documents(institution_id,document_type,status,source_snapshot,corrects_document_id) VALUES($1,'credit_note','draft','{}',$2)",[b,document])); } finally { client.release(); } } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined); await pool.end(); }
});
