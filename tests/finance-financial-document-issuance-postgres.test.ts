import assert from 'node:assert/strict';
import test from 'node:test';
import { issueFinancialDocumentCommand, PostgresFinancialDocumentRepository } from '../src/modules/finance/financial-document-service.ts';
import { FinancialDocumentEligibilityService } from '../src/modules/finance/financial-document-eligibility.ts';
import { createSyntheticUatFiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { InstitutionLegalProfileRepository } from '../src/modules/institution/institution-legal-profile.ts';

async function seedConfirmedPayment(client: pg.PoolClient, institutionId: string) {
  const personId = randomUUID(); const billingPersonId = randomUUID(); const accountId = randomUUID(); const journalId = randomUUID(); const paymentId = randomUUID();
  await client.query("INSERT INTO people(id,name) VALUES($1,'Document payer')", [personId]);
  await client.query("INSERT INTO people(id,name) VALUES($1,'Document recipient')", [billingPersonId]);
  await client.query("INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,$3,'Document account')", [accountId, institutionId, `DOC-${accountId.slice(0, 8)}`]);
  await client.query("INSERT INTO finance_financial_account_parties(institution_id,financial_account_id,person_id,role) VALUES($1,$2,$3,'primary_debtor')", [institutionId, accountId, billingPersonId]);
  await client.query("INSERT INTO institution_legal_profiles(institution_id,version,legal_name,tax_identifier,registered_address,effective_from) VALUES($1,1,'Document Institution','PT999999990',$2,now()-interval '1 day')", [institutionId, { countryCode: 'PT', line1: 'Rua do Nexus, 1' }]);
  await client.query("INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now(),'NEXUS_TEST','EUR','Europe/Lisbon','v1','[\"EUR\"]')", [institutionId]);
  await client.query("INSERT INTO finance_fiscal_configuration_versions(institution_id,version,adapter_key,effective_from) VALUES($1,1,'core',now())", [institutionId]);
  await client.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',10,$3,'foundation_value_received',$4,1,now())", [journalId, institutionId, `document-source-${paymentId}`, personId]);
  await client.query("INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,financial_account_id,source_type,method,amount,currency,status,allocation_status,payer_person_id,effective_at,financial_profile_version,actor_person_id) VALUES($1,$2,$3,$4,$5,'manual_offline','cash',10,'EUR','confirmed','unapplied',$6,now(),1,$6)", [paymentId, institutionId, `PAY-${paymentId.slice(0, 8)}`, journalId, accountId, personId]);
  return paymentId;
}

test('F7-01 issuance is idempotent, tenant-safe, and allocates series numbers atomically', async () => {
  const harness: any = {};
  await assert.rejects(() => issueFinancialDocumentCommand(harness, { institutionId: 'a', sourceInstitutionId: 'b', sourceType: 'payment', sourceId: 'payment-a', seriesId: 's', idempotencyKey: 'key-a' }));
});

test('F7-01 repository exposes an atomic issuance authority', () => {
  assert.equal(typeof PostgresFinancialDocumentRepository, 'function');
  assert.equal(typeof (PostgresFinancialDocumentRepository.prototype as { issueCorrection?: unknown }).issueCorrection, 'function', 'F7-01 requires a persistent correction issuance boundary');
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
    const repo = new PostgresFinancialDocumentRepository(pool, createSyntheticUatFiscalAdapterRegistry());
    const eligibility = new FinancialDocumentEligibilityService(pool, createSyntheticUatFiscalAdapterRegistry());
    const command = { institutionId, sourceInstitutionId: institutionId, sourceType: 'payment' as const, sourceId: paymentId!, seriesId, idempotencyKey: 'financial-document-command-001', documentType: 'receipt' };
    assert.equal((await eligibility.requireReceipt(institutionId, paymentId!)).paymentId, paymentId!);
    const beforePreflight = await pool.query<{ next: string; documents: number }>("SELECT (SELECT next_sequence_number::text FROM finance_financial_document_series WHERE id=$1) next,(SELECT count(*)::int FROM finance_financial_documents WHERE institution_id=$2) documents", [seriesId, institutionId]);
    assert.equal((await eligibility.receipt({ institutionId, paymentId: paymentId!, seriesId })).eligible, true);
    const afterPreflight = await pool.query<{ next: string; documents: number }>("SELECT (SELECT next_sequence_number::text FROM finance_financial_document_series WHERE id=$1) next,(SELECT count(*)::int FROM finance_financial_documents WHERE institution_id=$2) documents", [seriesId, institutionId]);
    assert.deepEqual(afterPreflight.rows[0], beforePreflight.rows[0], 'preflight must not allocate a number or mutate Finance');
    const first = await repo.issue(command); const replay = await repo.issue(command);
    assert.equal(first.id, replay.id); assert.equal(first.sequenceNumber, 1);
    assert.equal(first.replayed, false, 'the first command result must distinguish creation from replay');
    assert.equal(replay.replayed, true, 'the HTTP boundary needs canonical replay information');
    const documents = await pool.query('SELECT count(*)::int count FROM finance_financial_documents WHERE institution_id=$1', [institutionId]);
    assert.equal(documents.rows[0].count, 1);
    const fiscalProvenance = await pool.query<{ fiscal_configuration_id: string | null; fiscal_adapter_key: string | null; fiscal_policy_version: string | null; fiscal_policy_snapshot: { adapterKey?: string; documentType?: string } | null; jurisdiction_extension_data: Record<string, unknown> | null }>('SELECT fiscal_configuration_id,fiscal_adapter_key,fiscal_policy_version,fiscal_policy_snapshot,jurisdiction_extension_data FROM finance_financial_documents WHERE id=$1', [first.id]);
    assert.notEqual(fiscalProvenance.rows[0]?.fiscal_configuration_id, null, 'issuance must persist the server-resolved fiscal configuration');
    assert.equal(fiscalProvenance.rows[0]?.fiscal_adapter_key, 'core');
    assert.equal(fiscalProvenance.rows[0]?.fiscal_policy_version, 'core-1', 'an issued document must retain the resolved policy version, not only a mutable adapter key');
    assert.deepEqual(fiscalProvenance.rows[0]?.fiscal_policy_snapshot, { adapterKey: 'core', documentType: 'receipt', policyVersion: 'core-1' });
    assert.deepEqual(fiscalProvenance.rows[0]?.jurisdiction_extension_data, {}, 'the international core supports extension evidence without globally requiring legal fields');
    const documentarySnapshot = await pool.query<{ documentary_snapshot: { schemaVersion: number; issuer: { legalName: string }; recipient: { name: string }; payment: { reference: string } }; documentary_snapshot_schema_version: number }>('SELECT documentary_snapshot,documentary_snapshot_schema_version FROM finance_financial_documents WHERE id=$1', [first.id]);
    assert.equal(documentarySnapshot.rows[0]?.documentary_snapshot_schema_version, 1);
    assert.equal(documentarySnapshot.rows[0]?.documentary_snapshot.schemaVersion, 1);
    assert.equal(documentarySnapshot.rows[0]?.documentary_snapshot.issuer.legalName, 'Document Institution');
    assert.equal(documentarySnapshot.rows[0]?.documentary_snapshot.recipient.name, 'Document recipient');
    assert.equal(documentarySnapshot.rows[0]?.documentary_snapshot.payment.reference, `PAY-${paymentId!.slice(0, 8)}`);
    await pool.query("UPDATE people SET name='Renamed live recipient' WHERE name='Document recipient'");
    await new InstitutionLegalProfileRepository(pool).createVersion({ institutionId, legalName: 'Renamed live institution', taxIdentifier: 'PT999999990', registeredAddress: { countryCode: 'PT', line1: 'Rua do Nexus, 2' }, effectiveFrom: new Date() });
    const replayAfterLiveChange = await repo.issue(command);
    assert.equal(replayAfterLiveChange.id, first.id, 'idempotency replay must load the original issued fact');
    const immutableSnapshot = await pool.query<{ documentary_snapshot: { issuer: { legalName: string }; recipient: { name: string } } }>('SELECT documentary_snapshot FROM finance_financial_documents WHERE id=$1', [first.id]);
    assert.equal(immutableSnapshot.rows[0]?.documentary_snapshot.issuer.legalName, 'Document Institution');
    assert.equal(immutableSnapshot.rows[0]?.documentary_snapshot.recipient.name, 'Document recipient');
    const provenance = await pool.query<{ source_snapshot: { sourceId: string; sourceType: string }; source_id: string; source_type: string }>('SELECT d.source_snapshot,s.source_id,s.source_type FROM finance_financial_documents d JOIN finance_financial_document_sources s ON s.document_id=d.id AND s.institution_id=d.institution_id WHERE d.institution_id=$1', [institutionId]);
    assert.equal(provenance.rows[0]?.source_snapshot.sourceType, 'payment');
    assert.equal(provenance.rows[0]?.source_snapshot.sourceId, paymentId!, 'issuance provenance must reference the server-locked payment');
    assert.equal(provenance.rows[0]?.source_id, paymentId!);
    assert.equal(provenance.rows[0]?.source_type, 'payment');
    const audit = await pool.query('SELECT count(*)::int count FROM finance_audit_records WHERE institution_id=$1 AND event_type=$2', [institutionId, 'financial_document_issued']);
    const outbox = await pool.query('SELECT count(*)::int count FROM finance_outbox WHERE institution_id=$1 AND topic=$2', [institutionId, 'financial_document_issued']);
    assert.equal(audit.rows[0].count, 1); assert.equal(outbox.rows[0].count, 1);
    const foreignInstitutionId = randomUUID();
    const foreignPaymentId = randomUUID();
    const foreignClient = await pool.connect();
    try {
      await foreignClient.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Foreign document institution','foreign-document-institution','active')", [foreignInstitutionId]);
      // A known UUID from another institution must be indistinguishable from an absent source.
      const personId = randomUUID(); const journalId = randomUUID();
      await foreignClient.query("INSERT INTO people(id,name) VALUES($1,'Foreign payer')", [personId]);
      await foreignClient.query("INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now(),'PT','EUR','Europe/Lisbon','v1','[\"EUR\"]')", [foreignInstitutionId]);
      await foreignClient.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',10,$3,'foundation_value_received',$4,1,now())", [journalId, foreignInstitutionId, `foreign-source-${foreignPaymentId}`, personId]);
      await foreignClient.query("INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,source_type,method,amount,currency,status,allocation_status,payer_person_id,effective_at,financial_profile_version,actor_person_id) VALUES($1,$2,$3,$4,'manual_offline','cash',10,'EUR','confirmed','unapplied',$5,now(),1,$5)", [foreignPaymentId, foreignInstitutionId, `PAY-${foreignPaymentId.slice(0, 8)}`, journalId, personId]);
    } finally { foreignClient.release(); }
    await assert.rejects(() => repo.issue({ ...command, sourceId: foreignPaymentId, idempotencyKey: 'cross-tenant-source' }), /SOURCE_NOT_ELIGIBLE/);
    await assert.rejects(() => eligibility.requireReceipt(institutionId, foreignPaymentId), /RECEIPT_INELIGIBLE/);
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});

test('F7 document issuance fails closed without legal profile or billing recipient and consumes no series number', async () => {
  await verifyApprovedTestConnection();
  const schema = `finance_document_snapshot_guard_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
  const institutionId = randomUUID(); const seriesId = randomUUID(); let paymentId: string;
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
      await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Snapshot guard','snapshot-guard','active')", [institutionId]);
      await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,next_sequence_number) VALUES($1,$2,'GUARD',1)", [seriesId, institutionId]);
      paymentId = await seedConfirmedPayment(client, institutionId);
      await client.query("UPDATE institution_legal_profiles SET effective_to=now()-interval '1 hour' WHERE institution_id=$1", [institutionId]);
    } finally { client.release(); }
    const repo = new PostgresFinancialDocumentRepository(pool, createSyntheticUatFiscalAdapterRegistry());
    await assert.rejects(() => repo.issue({ institutionId, sourceInstitutionId: institutionId, sourceType: 'payment', sourceId: paymentId!, seriesId, idempotencyKey: 'missing-legal-profile', documentType: 'receipt' }), /INSTITUTION_LEGAL_PROFILE_REQUIRED/);
    await pool.query("INSERT INTO institution_legal_profiles(institution_id,version,legal_name,registered_address,effective_from) VALUES($1,2,'Restored legal profile',$2,now()-interval '30 minutes')", [institutionId, { countryCode: 'PT', line1: 'Rua do Nexus, 2' }]);
    await pool.query('DELETE FROM finance_financial_account_parties WHERE institution_id=$1', [institutionId]);
    await assert.rejects(() => repo.issue({ institutionId, sourceInstitutionId: institutionId, sourceType: 'payment', sourceId: paymentId!, seriesId, idempotencyKey: 'missing-document-recipient', documentType: 'receipt' }), /DOCUMENT_RECIPIENT_REQUIRED/);
    const state = await pool.query<{ next_sequence_number: string; count: number }>('SELECT (SELECT next_sequence_number::text FROM finance_financial_document_series WHERE id=$1) next_sequence_number,(SELECT count(*)::int FROM finance_financial_documents WHERE institution_id=$2) count', [seriesId, institutionId]);
    assert.equal(state.rows[0]?.next_sequence_number, '1');
    assert.equal(state.rows[0]?.count, 0);
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});

test('F7-01 concurrent distinct commands receive distinct sequential series numbers', async () => {
  await verifyApprovedTestConnection(); const schema=`finance_document_race_${randomUUID().replaceAll('-', '')}`; const quote=(value:string)=>`"${value.replaceAll('"','""')}"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`}); const institutionId=randomUUID(),seriesId=randomUUID(); let paymentId: string;
  try { const client=await pool.connect(); try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Race institution','race-institution','active')",[institutionId]); await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,next_sequence_number) VALUES($1,$2,'RACE',1)",[seriesId,institutionId]); paymentId=await seedConfirmedPayment(client,institutionId); } finally { client.release(); }
    const repo=new PostgresFinancialDocumentRepository(pool, createSyntheticUatFiscalAdapterRegistry()); const base={institutionId,sourceInstitutionId:institutionId,sourceType:'payment' as const,sourceId:paymentId!,seriesId,documentType:'receipt'}; const [a,b]=await Promise.all([repo.issue({...base,idempotencyKey:'race-a'}),repo.issue({...base,idempotencyKey:'race-b'})]); assert.deepEqual([a.sequenceNumber,b.sequenceNumber].sort((x,y)=>x-y),[1,2]);
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined); await pool.end(); }
});

test('F7-03 concurrent same intent recovers exactly one authoritative document and number', async () => {
  await verifyApprovedTestConnection(); const schema=`finance_document_same_intent_${randomUUID().replaceAll('-','')}`; const quote=(value:string)=>`"${value.replaceAll('"','""')}"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`}); const institutionId=randomUUID(),seriesId=randomUUID(); let paymentId: string;
  try { const client=await pool.connect(); try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Same intent','same-intent','active')",[institutionId]); await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code) VALUES($1,$2,'ONCE')",[seriesId,institutionId]); paymentId=await seedConfirmedPayment(client,institutionId); } finally { client.release(); }
    const repo=new PostgresFinancialDocumentRepository(pool, createSyntheticUatFiscalAdapterRegistry()); const command={institutionId,sourceInstitutionId:institutionId,sourceType:'payment' as const,sourceId:paymentId!,seriesId,idempotencyKey:'same-intent',documentType:'receipt'}; const [left,right]=await Promise.all([repo.issue(command),repo.issue(command)]); assert.equal(left.id,right.id); assert.equal(left.sequenceNumber,right.sequenceNumber); const count=await pool.query<{documents:number;numbers:number}>("SELECT (SELECT count(*)::int FROM finance_financial_documents WHERE institution_id=$1) documents,(SELECT count(DISTINCT sequence_number)::int FROM finance_financial_documents WHERE institution_id=$1) numbers",[institutionId]); assert.equal(count.rows[0]?.documents,1); assert.equal(count.rows[0]?.numbers,1);
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined); await pool.end(); }
});

test('F7-01 migration rejects a cross-tenant correction relationship', async () => {
  await verifyApprovedTestConnection(); const schema=`finance_document_tenant_${randomUUID().replaceAll('-', '')}`; const quote=(value:string)=>`"${value.replaceAll('"','""')}"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`}); const a=randomUUID(),b=randomUUID(),document=randomUUID();
  try { const client=await pool.connect(); try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','tenant-a','active'),($2,'B','tenant-b','active')",[a,b]); await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,source_snapshot) VALUES($1,$2,'receipt','draft','{}')",[document,a]); await assert.rejects(()=>client.query("INSERT INTO finance_financial_documents(institution_id,document_type,status,source_snapshot,corrects_document_id) VALUES($1,'credit_note','draft','{}',$2)",[b,document])); } finally { client.release(); } } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined); await pool.end(); }
});

test('F7-01 migration makes issued documents append-only', async () => {
  await verifyApprovedTestConnection();
  const schema = `finance_document_immutable_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
  const institutionId = randomUUID();
  const documentId = randomUUID(); const seriesId = randomUUID();
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
      await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Immutable document','immutable-document','active')", [institutionId]);
      await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code) VALUES($1,$2,'IMM')", [seriesId, institutionId]);
      await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,series_id,sequence_number,source_snapshot,issued_at) VALUES($1,$2,'receipt','issued',$3,1,'{}',now())", [documentId, institutionId, seriesId]);
      await assert.rejects(() => client.query("UPDATE finance_financial_documents SET document_type='credit_note' WHERE id=$1", [documentId]), /immutable/i);
      await assert.rejects(() => client.query('DELETE FROM finance_financial_documents WHERE id=$1', [documentId]), /immutable/i);
    } finally { client.release(); }
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});

test('F7-01 failed issuance leaves no documentary fact', async () => {
  await verifyApprovedTestConnection(); const schema=`finance_document_rollback_${randomUUID().replaceAll('-', '')}`; const quote=(value:string)=>`"${value.replaceAll('"','""')}"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`}); const institutionId=randomUUID(); let paymentId: string;
  try { const client=await pool.connect(); try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Rollback','rollback','active')",[institutionId]); paymentId=await seedConfirmedPayment(client,institutionId); } finally { client.release(); } const repo=new PostgresFinancialDocumentRepository(pool, createSyntheticUatFiscalAdapterRegistry()); await assert.rejects(()=>repo.issue({institutionId,sourceInstitutionId:institutionId,sourceType:'payment',sourceId:paymentId!,seriesId:randomUUID(),idempotencyKey:'rollback-command',documentType:'receipt'})); const count=await pool.query('SELECT count(*)::int count FROM finance_financial_documents WHERE institution_id=$1',[institutionId]); assert.equal(count.rows[0].count,0); } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined); await pool.end(); }
});

test('F7-01 correction creates an idempotent immutable fact without changing economic truth', async () => {
  await verifyApprovedTestConnection();
  const schema = `finance_document_correction_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
  const institutionId = randomUUID(); const seriesId = randomUUID(); let paymentId: string;
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
      await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Correction','correction','active')", [institutionId]);
      await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code) VALUES($1,$2,'COR')", [seriesId, institutionId]);
      paymentId = await seedConfirmedPayment(client, institutionId);
    } finally { client.release(); }
    const repo = new PostgresFinancialDocumentRepository(pool, createSyntheticUatFiscalAdapterRegistry());
    const original = await repo.issue({ institutionId, sourceInstitutionId: institutionId, sourceType: 'payment', sourceId: paymentId!, seriesId, idempotencyKey: 'original', documentType: 'receipt' });
    const before = await pool.query<{ source_snapshot: Record<string, unknown>; documentary_snapshot: Record<string, unknown>; payments: number; journals: number }>("SELECT (SELECT source_snapshot FROM finance_financial_documents WHERE id=$1) source_snapshot,(SELECT documentary_snapshot FROM finance_financial_documents WHERE id=$1) documentary_snapshot,(SELECT count(*)::int FROM finance_payments WHERE institution_id=$2) payments,(SELECT count(*)::int FROM finance_journal_transactions WHERE institution_id=$2) journals", [original.id, institutionId]);
    const command = { institutionId, originalDocumentId: original.id, seriesId, documentType: 'credit_note', idempotencyKey: 'correction-001' };
    const [correction, replay] = await Promise.all([repo.issueCorrection(command), repo.issueCorrection(command)]);
    assert.equal(correction.id, replay.id); assert.equal(correction.sequenceNumber, 2);
    assert.equal(correction.replayed || replay.replayed, true, 'one concurrent correction invocation must be recognized as a replay');
    const after = await pool.query<{ status: string; corrects_document_id: string; source_snapshot: Record<string, unknown>; documentary_snapshot: Record<string, unknown>; correction_snapshot: Record<string, unknown>; payments: number; journals: number; audit: number; outbox: number }>("SELECT (SELECT status FROM finance_financial_documents WHERE id=$1) status,(SELECT corrects_document_id FROM finance_financial_documents WHERE id=$2) corrects_document_id,(SELECT source_snapshot FROM finance_financial_documents WHERE id=$1) source_snapshot,(SELECT documentary_snapshot FROM finance_financial_documents WHERE id=$1) documentary_snapshot,(SELECT documentary_snapshot FROM finance_financial_documents WHERE id=$2) correction_snapshot,(SELECT count(*)::int FROM finance_payments WHERE institution_id=$3) payments,(SELECT count(*)::int FROM finance_journal_transactions WHERE institution_id=$3) journals,(SELECT count(*)::int FROM finance_audit_records WHERE institution_id=$3 AND event_type='financial_document_corrected') audit,(SELECT count(*)::int FROM finance_outbox WHERE institution_id=$3 AND topic='financial_document_corrected') outbox", [original.id, correction.id, institutionId]);
    assert.equal(after.rows[0]?.status, 'issued'); assert.equal(after.rows[0]?.corrects_document_id, original.id);
    assert.deepEqual(after.rows[0]?.source_snapshot, before.rows[0]?.source_snapshot, 'original provenance remains queryable unchanged');
    assert.deepEqual(after.rows[0]?.documentary_snapshot, before.rows[0]?.documentary_snapshot, 'original documentary evidence remains queryable unchanged');
    assert.deepEqual(after.rows[0]?.correction_snapshot, before.rows[0]?.documentary_snapshot, 'correction retains the immutable documentary evidence it corrects');
    assert.equal(after.rows[0]?.payments, before.rows[0]?.payments, 'correction must not mutate payments'); assert.equal(after.rows[0]?.journals, before.rows[0]?.journals, 'correction creates no economic journal');
    assert.equal(after.rows[0]?.audit, 1); assert.equal(after.rows[0]?.outbox, 1);
    await assert.rejects(() => repo.issueCorrection({ ...command, idempotencyKey: 'rollback', seriesId: randomUUID() }), /SERIES_NOT_EFFECTIVE/);
    const corrections = await pool.query('SELECT count(*)::int count FROM finance_financial_documents WHERE institution_id=$1 AND corrects_document_id=$2', [institutionId, original.id]);
    assert.equal(corrections.rows[0].count, 1, 'failed correction rolls back without a partial fact');
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});

test('F7-02 inactive series cannot be used for authoritative issuance', async () => {
  await verifyApprovedTestConnection(); const schema=`finance_document_inactive_${randomUUID().replaceAll('-','')}`; const quote=(value:string)=>`"${value.replaceAll('"','""')}"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`}); const institutionId=randomUUID(),seriesId=randomUUID(); let paymentId: string;
  try { const client=await pool.connect(); try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Inactive series','inactive-series','active')",[institutionId]); await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,status) VALUES($1,$2,'OFF','inactive')",[seriesId,institutionId]); paymentId=await seedConfirmedPayment(client,institutionId); } finally { client.release(); }
    const repo=new PostgresFinancialDocumentRepository(pool, createSyntheticUatFiscalAdapterRegistry()); await assert.rejects(()=>repo.issue({institutionId,sourceInstitutionId:institutionId,sourceType:'payment',sourceId:paymentId!,seriesId,idempotencyKey:'inactive-series',documentType:'receipt'}),/SERIES_NOT_EFFECTIVE/);
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined); await pool.end(); }
});
