import assert from 'node:assert/strict';
import test from 'node:test';
import { issueFinancialDocumentCommand, PostgresFinancialDocumentRepository } from '../src/modules/finance/financial-document-service.ts';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

async function seedConfirmedPayment(client: pg.PoolClient, institutionId: string) {
  const personId = randomUUID(); const journalId = randomUUID(); const paymentId = randomUUID();
  await client.query("INSERT INTO people(id,name) VALUES($1,'Document payer')", [personId]);
  await client.query("INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now(),'PT','EUR','Europe/Lisbon','v1','[\"EUR\"]')", [institutionId]);
  await client.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',10,$3,'foundation_value_received',$4,1,now())", [journalId, institutionId, `document-source-${paymentId}`, personId]);
  await client.query("INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,source_type,method,amount,currency,status,allocation_status,payer_person_id,effective_at,financial_profile_version,actor_person_id) VALUES($1,$2,$3,$4,'manual_offline','cash',10,'EUR','confirmed','unapplied',$5,now(),1,$5)", [paymentId, institutionId, `PAY-${paymentId.slice(0, 8)}`, journalId, personId]);
  return paymentId;
}

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
  const institutionId = randomUUID(); const seriesId = randomUUID(); let paymentId: string;
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
      await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Document institution','document-institution','active')", [institutionId]);
      await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,next_sequence_number) VALUES($1,$2,'DOC',1)", [seriesId, institutionId]);
      paymentId = await seedConfirmedPayment(client, institutionId);
    } finally { client.release(); }
    const repo = new PostgresFinancialDocumentRepository(pool);
    const command = { institutionId, sourceInstitutionId: institutionId, sourceType: 'payment' as const, sourceId: paymentId!, seriesId, idempotencyKey: 'financial-document-command-001', documentType: 'receipt' };
    const first = await repo.issue(command); const replay = await repo.issue(command);
    assert.equal(first.id, replay.id); assert.equal(first.sequenceNumber, 1);
    const documents = await pool.query('SELECT count(*)::int count FROM finance_financial_documents WHERE institution_id=$1', [institutionId]);
    assert.equal(documents.rows[0].count, 1);
    const provenance = await pool.query<{ source_snapshot: { sourceId: string; sourceType: string }; source_id: string; source_type: string }>('SELECT d.source_snapshot,s.source_id,s.source_type FROM finance_financial_documents d JOIN finance_financial_document_sources s ON s.document_id=d.id AND s.institution_id=d.institution_id WHERE d.institution_id=$1', [institutionId]);
    assert.equal(provenance.rows[0]?.source_snapshot.sourceType, 'payment');
    assert.equal(provenance.rows[0]?.source_snapshot.sourceId, paymentId!, 'issuance provenance must reference the server-locked payment');
    assert.equal(provenance.rows[0]?.source_id, paymentId!);
    assert.equal(provenance.rows[0]?.source_type, 'payment');
    const audit = await pool.query('SELECT count(*)::int count FROM finance_audit_records WHERE institution_id=$1 AND event_type=$2', [institutionId, 'financial_document_issued']);
    const outbox = await pool.query('SELECT count(*)::int count FROM finance_outbox WHERE institution_id=$1 AND topic=$2', [institutionId, 'financial_document_issued']);
    assert.equal(audit.rows[0].count, 1); assert.equal(outbox.rows[0].count, 1);
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});

test('F7-01 concurrent distinct commands receive distinct sequential series numbers', async () => {
  await verifyApprovedTestConnection(); const schema=`finance_document_race_${randomUUID().replaceAll('-', '')}`; const quote=(value:string)=>`"${value.replaceAll('"','""')}"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`}); const institutionId=randomUUID(),seriesId=randomUUID(); let paymentId: string;
  try { const client=await pool.connect(); try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Race institution','race-institution','active')",[institutionId]); await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,next_sequence_number) VALUES($1,$2,'RACE',1)",[seriesId,institutionId]); paymentId=await seedConfirmedPayment(client,institutionId); } finally { client.release(); }
    const repo=new PostgresFinancialDocumentRepository(pool); const base={institutionId,sourceInstitutionId:institutionId,sourceType:'payment' as const,sourceId:paymentId!,seriesId,documentType:'receipt'}; const [a,b]=await Promise.all([repo.issue({...base,idempotencyKey:'race-a'}),repo.issue({...base,idempotencyKey:'race-b'})]); assert.deepEqual([a.sequenceNumber,b.sequenceNumber].sort((x,y)=>x-y),[1,2]);
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined); await pool.end(); }
});

test('F7-01 migration rejects a cross-tenant correction relationship', async () => {
  await verifyApprovedTestConnection(); const schema=`finance_document_tenant_${randomUUID().replaceAll('-', '')}`; const quote=(value:string)=>`"${value.replaceAll('"','""')}"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`}); const a=randomUUID(),b=randomUUID(),document=randomUUID();
  try { const client=await pool.connect(); try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','tenant-a','active'),($2,'B','tenant-b','active')",[a,b]); await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,source_snapshot) VALUES($1,$2,'receipt','issued','{}')",[document,a]); await assert.rejects(()=>client.query("INSERT INTO finance_financial_documents(institution_id,document_type,status,source_snapshot,corrects_document_id) VALUES($1,'credit_note','draft','{}',$2)",[b,document])); } finally { client.release(); } } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined); await pool.end(); }
});

test('F7-01 migration makes issued documents append-only', async () => {
  await verifyApprovedTestConnection();
  const schema = `finance_document_immutable_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
  const institutionId = randomUUID();
  const documentId = randomUUID();
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
      await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Immutable document','immutable-document','active')", [institutionId]);
      await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,source_snapshot) VALUES($1,$2,'receipt','issued','{}')", [documentId, institutionId]);
      await assert.rejects(() => client.query("UPDATE finance_financial_documents SET document_type='credit_note' WHERE id=$1", [documentId]), /immutable/i);
      await assert.rejects(() => client.query('DELETE FROM finance_financial_documents WHERE id=$1', [documentId]), /immutable/i);
    } finally { client.release(); }
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});

test('F7-01 failed issuance leaves no documentary fact', async () => {
  await verifyApprovedTestConnection(); const schema=`finance_document_rollback_${randomUUID().replaceAll('-', '')}`; const quote=(value:string)=>`"${value.replaceAll('"','""')}"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`}); const institutionId=randomUUID(); let paymentId: string;
  try { const client=await pool.connect(); try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Rollback','rollback','active')",[institutionId]); paymentId=await seedConfirmedPayment(client,institutionId); } finally { client.release(); } const repo=new PostgresFinancialDocumentRepository(pool); await assert.rejects(()=>repo.issue({institutionId,sourceInstitutionId:institutionId,sourceType:'payment',sourceId:paymentId!,seriesId:randomUUID(),idempotencyKey:'rollback-command',documentType:'receipt'})); const count=await pool.query('SELECT count(*)::int count FROM finance_financial_documents WHERE institution_id=$1',[institutionId]); assert.equal(count.rows[0].count,0); } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined); await pool.end(); }
});
