import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { resolveInvoiceEligibility, resolveReceiptEligibility } from '../src/modules/finance/financial-document-eligibility.ts';
import { resolveInvoiceBillableSource } from '../src/modules/finance/invoice-billable-source.ts';
import { PostgresFinancialDocumentRepository } from '../src/modules/finance/financial-document-service.ts';
import { registerFinancialDocumentRoutes } from '../src/modules/finance/financial-document-http.ts';
import { createSyntheticUatFiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

async function seedInvoiceFixture(client: pg.PoolClient, institutionId: string) {
  const issuer = randomUUID(), debtor = randomUUID(), account = randomUUID(), feeType = randomUUID(), fee = randomUUID(), obligation = randomUUID(), series = randomUUID();
  await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Invoice institution','invoice-institution','active')", [institutionId]);
  await client.query("INSERT INTO people(id,name) VALUES($1,'Invoice actor'),($2,'Invoice debtor')", [issuer, debtor]);
  await client.query("INSERT INTO institution_legal_profiles(institution_id,version,legal_name,tax_identifier,registered_address,effective_from) VALUES($1,1,'Invoice Institution','AO500000001',$2,now()-interval '1 day')", [institutionId, { countryCode: 'NEXUS_TEST', line1: 'Rua da Escola, 1' }]);
  await client.query("INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now()-interval '1 day','NEXUS_TEST','AOA','Africa/Luanda','v1','[\"AOA\"]')", [institutionId]);
  await client.query("INSERT INTO finance_fiscal_configuration_versions(institution_id,version,adapter_key,effective_from) VALUES($1,1,'core',now()-interval '1 day')", [institutionId]);
  await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,document_type,status,effective_from,next_sequence_number) VALUES($1,$2,'FT','invoice','active',now()-interval '1 day',1)", [series, institutionId]);
  await client.query("INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'INV-001','Invoice account')", [account, institutionId]);
  await client.query("INSERT INTO finance_financial_account_parties(institution_id,financial_account_id,person_id,role) VALUES($1,$2,$3,'primary_debtor')", [institutionId, account, debtor]);
  await client.query("INSERT INTO finance_fee_types(id,institution_id,source,display_name,code_prefix) VALUES($1,$2,'institution_custom','Propina','PROP')", [feeType, institutionId]);
  await client.query("INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'PROP-1',1,$4)", [fee, institutionId, feeType, issuer]);
  await client.query("INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'Propina setembro','fee',100,'AOA',now()-interval '1 day',$4)", [institutionId, fee, feeType, issuer]);
  await client.query("INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,due_at,status,financial_profile_version,created_by_person_id,idempotency_key) VALUES($1,$2,$3,$4,1,'manual_finance','OBR-0001',100,'AOA',now()+interval '30 days','open',1,$5,'invoice-obligation')", [obligation, institutionId, account, fee, issuer]);
  return { obligation, series };
}

test('invoice preflight is side-effect-free and authoritative issuance persists one immutable V3 invoice', async () => {
  await verifyApprovedTestConnection();
  const schema = `finance_invoice_issue_${randomUUID().replaceAll('-', '')}`; const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` }); const institutionId = randomUUID();
  try {
    const client = await pool.connect(); let fixture: { obligation: string; series: string };
    try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations'))); fixture = await seedInvoiceFixture(client, institutionId); } finally { client.release(); }
    const registry = createSyntheticUatFiscalAdapterRegistry();
    const before = await pool.query<{ next: string; payments: number; allocations: number }>("SELECT (SELECT next_sequence_number::text FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2) next,(SELECT count(*)::int FROM finance_payments WHERE institution_id=$1) payments,(SELECT count(*)::int FROM finance_allocations WHERE institution_id=$1) allocations", [institutionId, fixture!.series]);
    for (let i = 0; i < 20; i += 1) {
      const preview = await resolveInvoiceEligibility(pool, registry, { institutionId, obligationId: fixture!.obligation, seriesId: fixture!.series, documentType: 'invoice', at: new Date() });
      assert.equal(preview.eligible, true);
    }
    assert.deepEqual((await pool.query("SELECT (SELECT next_sequence_number::text FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2) next,(SELECT count(*)::int FROM finance_payments WHERE institution_id=$1) payments,(SELECT count(*)::int FROM finance_allocations WHERE institution_id=$1) allocations", [institutionId, fixture!.series])).rows[0], before.rows[0], 'twenty preflights cannot consume a number or mutate settlement');
    const repo = new PostgresFinancialDocumentRepository(pool, registry);
    const command = { institutionId, sourceInstitutionId: institutionId, sourceType: 'obligation' as const, obligationId: fixture!.obligation, seriesId: fixture!.series, idempotencyKey: 'invoice-command-001' };
    const first = await repo.issueInvoice(command); const replay = await repo.issueInvoice(command);
    assert.deepEqual(replay, { ...first, replayed: true }); assert.equal(first.sequenceNumber, 1);
    const issued = await pool.query<{ document_type: string; documentary_snapshot_schema_version: number; documentary_snapshot: any; source_snapshot: any }>('SELECT document_type,documentary_snapshot_schema_version,documentary_snapshot,source_snapshot FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [institutionId, first.id]);
    assert.equal(issued.rows[0]?.document_type, 'invoice'); assert.equal(issued.rows[0]?.documentary_snapshot_schema_version, 3); assert.deepEqual(issued.rows[0]?.documentary_snapshot.totals, { subtotal: '100', discountTotal: '0', taxTotal: '0', documentTotal: '100', currency: 'AOA' }); assert.equal(issued.rows[0]?.documentary_snapshot.obligation.reference, 'OBR-0001'); assert.equal(issued.rows[0]?.source_snapshot.sourceType, 'obligation');
    const sourceAuthority = await pool.query<{ financial_account_id: string; created_by_person_id: string }>('SELECT financial_account_id,created_by_person_id FROM finance_obligations WHERE institution_id=$1 AND id=$2', [institutionId, fixture!.obligation]); const adjustmentJournal = randomUUID();
    await pool.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','AOA',5,$3,'obligation_adjustment',$4,1,now())", [adjustmentJournal, institutionId, 'invoice-later-adjustment', sourceAuthority.rows[0]!.created_by_person_id]);
    await pool.query("INSERT INTO finance_obligation_adjustments(id,institution_id,financial_account_id,obligation_id,direction,amount,currency,reason,journal_transaction_id,actor_kind,actor_person_id) VALUES($1,$2,$3,$4,'increase',5,'AOA','Later authorized adjustment',$5,'human',$6)", [randomUUID(), institutionId, sourceAuthority.rows[0]!.financial_account_id, fixture!.obligation, adjustmentJournal, sourceAuthority.rows[0]!.created_by_person_id]);
    assert.deepEqual((await pool.query<{ documentary_snapshot: unknown }>('SELECT documentary_snapshot FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [institutionId, first.id])).rows[0]?.documentary_snapshot, issued.rows[0]?.documentary_snapshot, 'a later authoritative obligation adjustment cannot rewrite the issued invoice');
    const after = await pool.query<{ next: string; payments: number; allocations: number; documents: number }>("SELECT (SELECT next_sequence_number::text FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2) next,(SELECT count(*)::int FROM finance_payments WHERE institution_id=$1) payments,(SELECT count(*)::int FROM finance_allocations WHERE institution_id=$1) allocations,(SELECT count(*)::int FROM finance_financial_documents WHERE institution_id=$1) documents", [institutionId, fixture!.series]);
    assert.deepEqual(after.rows[0], { next: '2', payments: 0, allocations: 0, documents: 1 });
    const foreign = await resolveInvoiceEligibility(pool, registry, { institutionId: randomUUID(), obligationId: fixture!.obligation, seriesId: fixture!.series, documentType: 'invoice', at: new Date() }); assert.deepEqual(foreign, { eligible: false, reasonCode: 'INVOICE_SOURCE_NOT_ELIGIBLE' });
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});

test('invoice HTTP issuance ignores browser tenant authority and enforces authenticated capability', async () => {
  await verifyApprovedTestConnection();
  const schema = `finance_invoice_http_${randomUUID().replaceAll('-', '')}`; const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` }); const institutionId = randomUUID(); let server: http.Server | undefined;
  try {
    const client = await pool.connect(); let fixture: { obligation: string; series: string };
    try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations'))); fixture = await seedInvoiceFixture(client, institutionId); } finally { client.release(); }
    const app = express(); app.use(express.json()); const auth: any = (req: any, _res: any, next: any) => { if (req.header('Authorization') === 'Bearer financial') req.institutionalContext = { institutionId, role: 'financial' }; if (req.header('Authorization') === 'Bearer director') req.institutionalContext = { institutionId, role: 'director' }; if (req.header('Authorization') === 'Bearer foreign') req.institutionalContext = { institutionId: randomUUID(), role: 'financial' }; next(); };
    registerFinancialDocumentRoutes(app, pool, auth, createSyntheticUatFiscalAdapterRegistry()); server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const url = `http://127.0.0.1:${(server.address() as any).port}/api/finance/documents/invoice`;
    assert.equal((await fetch(url, { method: 'POST' })).status, 401, 'unauthenticated callers cannot emit');
    assert.equal((await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer no-context', 'Idempotency-Key': 'invoice-http-no-context' } })).status, 401, 'a session without institutional context cannot emit');
    assert.equal((await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer director', 'Idempotency-Key': 'invoice-http-read-only' } })).status, 403, 'a read-only financial role cannot emit');
    const response = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer financial', 'Idempotency-Key': 'invoice-http-001', 'Content-Type': 'application/json' }, body: JSON.stringify({ institutionId: 'forged', obligationId: fixture!.obligation, seriesId: fixture!.series }) });
    assert.equal(response.status, 201); const issued: any = await response.json(); assert.equal(issued.sequenceNumber, 1);
    const foreign = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer foreign', 'Idempotency-Key': 'invoice-http-foreign', 'Content-Type': 'application/json' }, body: JSON.stringify({ obligationId: fixture!.obligation, seriesId: fixture!.series }) }); assert.equal(foreign.status, 404);
    assert.equal((await pool.query('SELECT count(*)::int count FROM finance_financial_documents WHERE institution_id=$1', [institutionId])).rows[0]?.count, 1);
  } finally { server?.close(); await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});

test('invoice issuance serializes idempotency, isolates series and freezes billable source semantics', async () => {
  await verifyApprovedTestConnection();
  const schema = `finance_invoice_assurance_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
  const institutionId = randomUUID();
  try {
    const client = await pool.connect(); let fixture: { obligation: string; series: string };
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
      fixture = await seedInvoiceFixture(client, institutionId);
      await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,document_type,status,effective_from,next_sequence_number) VALUES($1,$2,'RC','receipt','active',now()-interval '1 day',1),($3,$2,'OFF','invoice','inactive',now()-interval '1 day',1),($4,$2,'FUT','invoice','active',now()+interval '1 day',1)", [randomUUID(), institutionId, randomUUID(), randomUUID()]);
    } finally { client.release(); }
    const registry = createSyntheticUatFiscalAdapterRegistry();
    const repo = new PostgresFinancialDocumentRepository(pool, registry);
    const command = { institutionId, sourceInstitutionId: institutionId, sourceType: 'obligation' as const, obligationId: fixture!.obligation, seriesId: fixture!.series, idempotencyKey: 'invoice-race-001' };

    const concurrent = await Promise.all(Array.from({ length: 12 }, () => repo.issueInvoice(command)));
    assert.equal(new Set(concurrent.map(result => result.id)).size, 1, 'same idempotency intent must produce one logical invoice');
    assert.equal(new Set(concurrent.map(result => result.sequenceNumber)).size, 1, 'same idempotency intent must retain one number');
    assert.equal((await pool.query('SELECT count(*)::int count FROM finance_financial_documents WHERE institution_id=$1', [institutionId])).rows[0]?.count, 1);
    assert.equal((await pool.query('SELECT next_sequence_number::text next FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2', [institutionId, fixture!.series])).rows[0]?.next, '2');

    const secondInvoiceSeries = randomUUID();
    await pool.query("INSERT INTO finance_financial_document_series(id,institution_id,code,document_type,status,effective_from,next_sequence_number) VALUES($1,$2,'FT2','invoice','active',now()-interval '1 day',1)", [secondInvoiceSeries, institutionId]);
    await assert.rejects(() => repo.issueInvoice({ ...command, seriesId: secondInvoiceSeries }), /Finance command fingerprint conflict/, 'a reused key with a distinct semantic request must fail closed');
    assert.equal((await pool.query('SELECT count(*)::int count FROM finance_financial_documents WHERE institution_id=$1', [institutionId])).rows[0]?.count, 1);

    const allSeries = await pool.query<{ id: string; document_type: string; status: string; effective_from: Date }>('SELECT id,document_type,status,effective_from FROM finance_financial_document_series WHERE institution_id=$1 ORDER BY code', [institutionId]);
    for (const series of allSeries.rows) {
      const eligibility = await resolveInvoiceEligibility(pool, registry, { institutionId, obligationId: fixture!.obligation, seriesId: series.id, documentType: 'invoice', at: new Date() });
      if (series.id === fixture!.series || series.id === secondInvoiceSeries) assert.equal(eligibility.eligible, true, 'an active effective invoice series is eligible');
      else assert.deepEqual(eligibility, { eligible: false, reasonCode: 'INVOICE_SERIES_NOT_EFFECTIVE' }, 'receipt, inactive, and future series cannot issue invoices');
    }
    const foreignInstitution = randomUUID();
    await pool.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Foreign invoice institution','foreign-invoice-institution','active')", [foreignInstitution]);
    const foreignSeries = randomUUID();
    await pool.query("INSERT INTO finance_financial_document_series(id,institution_id,code,document_type,status,effective_from,next_sequence_number) VALUES($1,$2,'FT','invoice','active',now()-interval '1 day',1)", [foreignSeries, foreignInstitution]);
    assert.deepEqual(await resolveInvoiceEligibility(pool, registry, { institutionId, obligationId: fixture!.obligation, seriesId: foreignSeries, documentType: 'invoice', at: new Date() }), { eligible: false, reasonCode: 'INVOICE_SERIES_NOT_EFFECTIVE' });

    const receiptSeries = allSeries.rows.find(series => series.document_type === 'receipt')!;
    const paymentJournal = randomUUID(), paymentId = randomUUID();
    await pool.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','AOA',40,$3,'foundation_value_received',$4,1,now())", [paymentJournal, institutionId, 'invoice-series-isolation-payment', (await pool.query<{ created_by_person_id: string }>('SELECT created_by_person_id FROM finance_obligations WHERE institution_id=$1 AND id=$2', [institutionId, fixture!.obligation])).rows[0]!.created_by_person_id]);
    await pool.query("INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,financial_account_id,source_type,method,amount,currency,status,allocation_status,effective_at,financial_profile_version,actor_person_id) SELECT $1,institution_id,'PAY-INVOICE-SERIES',$2,financial_account_id,'manual_offline','cash',40,'AOA','confirmed','unapplied',now(),financial_profile_version,created_by_person_id FROM finance_obligations WHERE institution_id=$3 AND id=$4", [paymentId, paymentJournal, institutionId, fixture!.obligation]);
    assert.deepEqual(await resolveReceiptEligibility(pool, registry, { institutionId, paymentId, seriesId: fixture!.series, documentType: 'receipt' }), { eligible: false, reasonCode: 'RECEIPT_SERIES_NOT_EFFECTIVE' }, 'an invoice series cannot issue a receipt');

    const source = await pool.query<{ financial_account_id: string; created_by_person_id: string }>('SELECT financial_account_id,created_by_person_id FROM finance_obligations WHERE institution_id=$1 AND id=$2', [institutionId, fixture!.obligation]);
    const addJournal = async (amount: string, commandId: string) => {
      const id = randomUUID();
      await pool.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','AOA',$3,$4,'obligation_adjustment',$5,1,now())", [id, institutionId, amount, commandId, source.rows[0]!.created_by_person_id]);
      return id;
    };
    const adjustmentJournal = await addJournal('20', 'invoice-edge-adjustment');
    await pool.query("INSERT INTO finance_obligation_adjustments(id,institution_id,financial_account_id,obligation_id,direction,amount,currency,reason,journal_transaction_id,actor_kind,actor_person_id) VALUES($1,$2,$3,$4,'increase',20,'AOA','Authorized increase',$5,'human',$6)", [randomUUID(), institutionId, source.rows[0]!.financial_account_id, fixture!.obligation, adjustmentJournal, source.rows[0]!.created_by_person_id]);
    let billable = await resolveInvoiceBillableSource(pool, { institutionId, obligationId: fixture!.obligation, at: new Date() });
    assert.deepEqual({ original: billable.originalAmount, adjustments: billable.adjustmentTotal, discount: billable.discountTotal, billable: billable.billableAmount }, { original: '100', adjustments: '20', discount: '0', billable: '120' });

    const policyId = randomUUID(), policyVersionId = randomUUID(), discountJournal = await addJournal('15', 'invoice-edge-discount'), discountId = randomUUID();
    await pool.query("INSERT INTO finance_discount_policies(id,institution_id,code) VALUES($1,$2,'INV-DISC')", [policyId, institutionId]);
    await pool.query("INSERT INTO finance_discount_policy_versions(id,institution_id,policy_id,version,name,calculation_mode,value,currency,effective_from) VALUES($1,$2,$3,1,'Invoice discount','fixed_amount',15,'AOA',now()-interval '1 day')", [policyVersionId, institutionId, policyId]);
    await pool.query("INSERT INTO finance_obligation_discounts(id,institution_id,financial_account_id,obligation_id,policy_id,policy_version_id,policy_code,policy_name,policy_version,calculation_mode,policy_value,amount,currency,reason,journal_transaction_id,actor_kind,actor_person_id) VALUES($1,$2,$3,$4,$5,$6,'INV-DISC','Invoice discount',1,'fixed_amount',15,15,'AOA','Authorized discount',$7,'human',$8)", [discountId, institutionId, source.rows[0]!.financial_account_id, fixture!.obligation, policyId, policyVersionId, discountJournal, source.rows[0]!.created_by_person_id]);
    billable = await resolveInvoiceBillableSource(pool, { institutionId, obligationId: fixture!.obligation, at: new Date() });
    assert.equal(billable.billableAmount, '105', 'effective discount reduces the invoice candidate');
    const revokeJournal = await addJournal('15', 'invoice-edge-revocation');
    await pool.query("INSERT INTO finance_obligation_discount_revocations(id,institution_id,financial_account_id,obligation_id,original_discount_id,amount,currency,reason,journal_transaction_id,actor_kind,actor_person_id) VALUES($1,$2,$3,$4,$5,15,'AOA','Authorized revocation',$6,'human',$7)", [randomUUID(), institutionId, source.rows[0]!.financial_account_id, fixture!.obligation, discountId, revokeJournal, source.rows[0]!.created_by_person_id]);
    billable = await resolveInvoiceBillableSource(pool, { institutionId, obligationId: fixture!.obligation, at: new Date() });
    assert.equal(billable.billableAmount, '120', 'revoked discounts cannot reduce the invoice candidate');
    assert.equal((await pool.query('SELECT count(*)::int count FROM finance_payments WHERE institution_id=$1', [institutionId])).rows[0]?.count, 1, 'an existing payment does not redefine the invoice billable amount');
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined);
    await pool.end();
  }
});
