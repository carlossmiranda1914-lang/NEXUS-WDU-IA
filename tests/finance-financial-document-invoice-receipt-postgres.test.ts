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

async function seed(client: pg.PoolClient, institutionId: string, options: { allocation?: boolean; confirmed?: boolean; currency?: string; obligationAmount?: string; paymentAmount?: string; allocationAmount?: string } = {}) {
  const person = randomUUID(), account = randomUUID(), feeType = randomUUID(), fee = randomUUID(), obligation = randomUUID(), payment = randomUUID(), journal = randomUUID(), allocationJournal = randomUUID(), series = randomUUID(); const currency = options.currency ?? 'EUR';
  const obligationAmount = options.obligationAmount ?? '10', paymentAmount = options.paymentAmount ?? '10', allocationAmount = options.allocationAmount ?? '10'; let allocationId: string | null = null;
  await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Invoice receipt',$2,'active')", [institutionId, `invoice-receipt-${institutionId}`]);
  await client.query("INSERT INTO people(id,name) VALUES($1,'Payer')", [person]);
  await client.query("INSERT INTO institution_legal_profiles(institution_id,version,legal_name,tax_identifier,registered_address,effective_from) VALUES($1,1,'Issuer','NIF',$2,now()-interval '1 day')", [institutionId, { countryCode: 'NEXUS_TEST', line1: 'Rua 1' }]);
  await client.query("INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now()-interval '1 day','NEXUS_TEST',$2,'Europe/Lisbon','v1',$3)", [institutionId, currency, JSON.stringify([currency])]);
  await client.query("INSERT INTO finance_fiscal_configuration_versions(institution_id,version,adapter_key,effective_from) VALUES($1,1,'core',now()-interval '1 day')", [institutionId]);
  await client.query("INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'A','Account')", [account, institutionId]);
  await client.query("INSERT INTO finance_financial_account_parties(institution_id,financial_account_id,person_id,role) VALUES($1,$2,$3,'primary_debtor')", [institutionId, account, person]);
  await client.query("INSERT INTO finance_fee_types(id,institution_id,source,display_name,code_prefix) VALUES($1,$2,'institution_custom','Fee','FEE')", [feeType, institutionId]);
  await client.query("INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'FEE-1',1,$4)", [fee, institutionId, feeType, person]);
  await client.query("INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'Fee','fee',$4,$5,now()-interval '1 day',$6)", [institutionId, fee, feeType, obligationAmount, currency, person]);
  await client.query("INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,status,financial_profile_version,created_by_person_id,idempotency_key,due_at) VALUES($1,$2,$3,$4,1,'manual_finance','OBR-1',$5,$6,'open',1,$7,'obr',now()+interval '10 days')", [obligation, institutionId, account, fee, obligationAmount, currency, person]);
  await client.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,$3,$4,$5,'pay','foundation_value_received',$6,1,$7)", [journal, institutionId, options.confirmed === false ? 'prepared' : 'confirmed', currency, paymentAmount, person, options.confirmed === false ? null : new Date()]);
  await client.query("INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,financial_account_id,source_type,method,amount,currency,status,allocation_status,payer_person_id,effective_at,financial_profile_version,actor_person_id) VALUES($1,$2,'PAG-1',$3,$4,'manual_offline','cash',$5,$6,$7,'unapplied',$8,now(),1,$8)", [payment, institutionId, journal, account, paymentAmount, currency, options.confirmed === false ? 'pending' : 'confirmed', person]);
  if (options.allocation !== false) {
    await client.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed',$3,$4,'allocation','payment_allocation',$5,1,now())", [allocationJournal, institutionId, currency, allocationAmount, person]);
    allocationId = randomUUID();
    await client.query("INSERT INTO finance_allocations(id,institution_id,financial_account_id,payment_id,obligation_id,journal_transaction_id,amount,currency,effective_at,actor_person_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now(),$9)", [allocationId, institutionId, account, payment, obligation, allocationJournal, allocationAmount, currency, person]);
  }
  await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,document_type,status,effective_from,next_sequence_number) VALUES($1,$2,'FR','invoice_receipt','active',now()-interval '1 day',1)", [series, institutionId]);
  return { obligation, payment, series, person, allocationId, account, feeType };
}

async function seedAdditionalValidRelationship(client: pg.PoolClient, institutionId: string, fixture: { account: string; feeType: string; person: string }) {
  const fee = randomUUID(), obligation = randomUUID(), payment = randomUUID(), paymentJournal = randomUUID(), allocationJournal = randomUUID(), allocationId = randomUUID();
  await client.query("INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'FEE-2',1,$4)", [fee, institutionId, fixture.feeType, fixture.person]);
  await client.query("INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'Fee 2','fee',10,'EUR',now()-interval '1 day',$4)", [institutionId, fee, fixture.feeType, fixture.person]);
  await client.query("INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,status,financial_profile_version,created_by_person_id,idempotency_key,due_at) VALUES($1,$2,$3,$4,1,'manual_finance','OBR-2',10,'EUR','open',1,$5,'obr-2',now()+interval '10 days')", [obligation, institutionId, fixture.account, fee, fixture.person]);
  await client.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',10,'pay-2','foundation_value_received',$3,1,now())", [paymentJournal, institutionId, fixture.person]);
  await client.query("INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,financial_account_id,source_type,method,amount,currency,status,allocation_status,payer_person_id,effective_at,financial_profile_version,actor_person_id) VALUES($1,$2,'PAG-2',$3,$4,'manual_offline','cash',10,'EUR','confirmed','unapplied',$5,now(),1,$5)", [payment, institutionId, paymentJournal, fixture.account, fixture.person]);
  await client.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',10,'allocation-2','payment_allocation',$3,1,now())", [allocationJournal, institutionId, fixture.person]);
  await client.query("INSERT INTO finance_allocations(id,institution_id,financial_account_id,payment_id,obligation_id,journal_transaction_id,amount,currency,effective_at,actor_person_id) VALUES($1,$2,$3,$4,$5,$6,10,'EUR',now(),$7)", [allocationId, institutionId, fixture.account, payment, obligation, allocationJournal, fixture.person]);
  return { obligation, payment };
}

test('Factura-Recibo PostgreSQL issuance is relationship-bound, idempotent, and tenant-safe', async () => {
  await verifyApprovedTestConnection(); const schema = `invoice_receipt_${randomUUID().replaceAll('-', '')}`, quote = (v: string) => `"${v.replaceAll('"', '""')}"`; const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` }); const institutionId = randomUUID();
  try { const client = await pool.connect(); let fixture: any; try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations'))); fixture = await seed(client, institutionId); } finally { client.release(); }
    const repo = new PostgresFinancialDocumentRepository(pool, createSyntheticUatFiscalAdapterRegistry()); const command = { institutionId, sourceInstitutionId: institutionId, sourceType: 'payment' as const, paymentId: fixture.payment, obligationId: fixture.obligation, seriesId: fixture.series, idempotencyKey: 'invoice-receipt-1' };
    const first = await repo.issueInvoiceReceipt(command), replay = await repo.issueInvoiceReceipt(command); assert.equal(first.id, replay.id); assert.equal(first.sequenceNumber, 1); assert.equal(replay.replayed, true);
    await assert.rejects(
      () => repo.issue({ institutionId, sourceInstitutionId: institutionId, sourceType: 'payment', sourceId: fixture.payment, seriesId: fixture.series, documentType: 'invoice_receipt', idempotencyKey: 'generic-invoice-receipt' }),
      /FINANCIAL_DOCUMENT_INVOICE_RECEIPT_COMMAND_REQUIRED/,
    );
    const persisted = await pool.query<{document_type:string;documentary_snapshot:any}>('SELECT document_type,documentary_snapshot FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [institutionId, first.id]); assert.equal(persisted.rows[0]?.document_type, 'invoice_receipt'); assert.equal(persisted.rows[0]?.documentary_snapshot.snapshotVersion, 4); assert.equal(persisted.rows[0]?.documentary_snapshot.obligation.reference, 'OBR-1'); assert.equal(persisted.rows[0]?.documentary_snapshot.payment.reference, 'PAG-1');
    const foreign = randomUUID(); await assert.rejects(() => repo.issueInvoiceReceipt({ ...command, institutionId: foreign, sourceInstitutionId: foreign, idempotencyKey: 'foreign' }), /SOURCE_NOT_ELIGIBLE/);
    const noAllocationInstitution = randomUUID(); const c = await pool.connect(); let noAllocation: any; try { noAllocation = await seed(c, noAllocationInstitution, { allocation: false }); } finally { c.release(); }
    await assert.rejects(() => repo.issueInvoiceReceipt({ institutionId: noAllocationInstitution, sourceInstitutionId: noAllocationInstitution, sourceType: 'payment', paymentId: noAllocation.payment, obligationId: noAllocation.obligation, seriesId: noAllocation.series, idempotencyKey: 'no-allocation' }), /ALLOCATION_REQUIRED/);

    // Payments are immutable confirmed facts in the persisted model; an absent
    // payment therefore proves the only representable non-confirmed boundary.
    await assert.rejects(() => repo.issueInvoiceReceipt({ ...command, paymentId: randomUUID(), idempotencyKey: 'non-confirmed-payment' }), /SOURCE_NOT_ELIGIBLE/);

    const reversedInstitution = randomUUID(); const reversedClient = await pool.connect(); let reversed: any; try {
      reversed = await seed(reversedClient, reversedInstitution);
      const reversalJournal = randomUUID();
      await reversedClient.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',10,'reverse','allocation_reversal',$3,1,now())", [reversalJournal, reversedInstitution, reversed.person]);
      await reversedClient.query("INSERT INTO finance_allocation_reversals(id,institution_id,original_allocation_id,amount,currency,reason,journal_transaction_id,effective_at,actor_person_id) VALUES($1,$2,$3,10,'EUR','reversed',$4,now(),$5)", [randomUUID(), reversedInstitution, reversed.allocationId, reversalJournal, reversed.person]);
    } finally { reversedClient.release(); }
    await assert.rejects(() => repo.issueInvoiceReceipt({ institutionId: reversedInstitution, sourceInstitutionId: reversedInstitution, sourceType: 'payment', paymentId: reversed.payment, obligationId: reversed.obligation, seriesId: reversed.series, idempotencyKey: 'reversed' }), /ALLOCATION_REQUIRED/);

    const currencyInstitution = randomUUID(); const currencyClient = await pool.connect(); let currencyMismatch: any; try {
      currencyMismatch = await seed(currencyClient, currencyInstitution);
      await currencyClient.query("UPDATE finance_obligations SET currency='USD' WHERE institution_id=$1 AND id=$2", [currencyInstitution, currencyMismatch.obligation]);
    } finally { currencyClient.release(); }
    await assert.rejects(() => repo.issueInvoiceReceipt({ institutionId: currencyInstitution, sourceInstitutionId: currencyInstitution, sourceType: 'payment', paymentId: currencyMismatch.payment, obligationId: currencyMismatch.obligation, seriesId: currencyMismatch.series, idempotencyKey: 'currency-mismatch' }), /INVOICE_CURRENCY_MISMATCH|INVOICE_RECEIPT_CURRENCY_RELATIONSHIP_INVALID/);

    const invalidAmountInstitution = randomUUID(); const invalidAmountClient = await pool.connect(); let invalidAmount: any; try { invalidAmount = await seed(invalidAmountClient, invalidAmountInstitution, { obligationAmount: '5', paymentAmount: '10', allocationAmount: '10' }); } finally { invalidAmountClient.release(); }
    await assert.rejects(() => repo.issueInvoiceReceipt({ institutionId: invalidAmountInstitution, sourceInstitutionId: invalidAmountInstitution, sourceType: 'payment', paymentId: invalidAmount.payment, obligationId: invalidAmount.obligation, seriesId: invalidAmount.series, idempotencyKey: 'invalid-amount' }), /DOCUMENTARY_SETTLEMENT_POSITION_INVALID|INVOICE_RECEIPT_AMOUNT_RELATIONSHIP_INVALID/);

    const concurrentInstitution = randomUUID(); const concurrentClient = await pool.connect(); let concurrentFirst: any, concurrentSecond: any; try {
      concurrentFirst = await seed(concurrentClient, concurrentInstitution);
      concurrentSecond = await seedAdditionalValidRelationship(concurrentClient, concurrentInstitution, concurrentFirst);
    } finally { concurrentClient.release(); }
    const concurrent = await Promise.all([
      repo.issueInvoiceReceipt({ institutionId: concurrentInstitution, sourceInstitutionId: concurrentInstitution, sourceType: 'payment', paymentId: concurrentFirst.payment, obligationId: concurrentFirst.obligation, seriesId: concurrentFirst.series, idempotencyKey: 'concurrent-1' }),
      repo.issueInvoiceReceipt({ institutionId: concurrentInstitution, sourceInstitutionId: concurrentInstitution, sourceType: 'payment', paymentId: concurrentSecond.payment, obligationId: concurrentSecond.obligation, seriesId: concurrentFirst.series, idempotencyKey: 'concurrent-2' }),
    ]);
    assert.deepEqual(concurrent.map(result => result.sequenceNumber).sort((left, right) => left - right), [1, 2]);
    const concurrentCount = await pool.query<{ count: string }>("SELECT count(*)::text count FROM finance_financial_documents WHERE institution_id=$1 AND document_type='invoice_receipt'", [concurrentInstitution]);
    assert.equal(concurrentCount.rows[0]?.count, '2');
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});

test('Factura-Recibo HTTP derives tenant and economic authority from the authenticated context', async () => {
  await verifyApprovedTestConnection(); const schema = `invoice_receipt_http_${randomUUID().replaceAll('-', '')}`, quote = (v: string) => `"${v.replaceAll('"', '""')}"`; const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` }); const institutionId = randomUUID(); let server: http.Server | undefined;
  try {
    const client = await pool.connect(); let fixture: any; try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations'))); fixture = await seed(client, institutionId); } finally { client.release(); }
    const app = express(); app.use(express.json()); const auth: any = (req: any, _res: any, next: any) => { if (req.header('Authorization') === 'Bearer admin') req.institutionalContext = { institutionId, role: 'institution_admin' }; if (req.header('Authorization') === 'Bearer readonly') req.institutionalContext = { institutionId, role: 'director' }; if (req.header('Authorization') === 'Bearer foreign') req.institutionalContext = { institutionId: randomUUID(), role: 'institution_admin' }; next(); };
    registerFinancialDocumentRoutes(app, pool, auth, createSyntheticUatFiscalAdapterRegistry()); server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const baseUrl = `http://127.0.0.1:${(server.address() as any).port}`; const url = `${baseUrl}/api/finance/documents/invoice-receipt`;
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer readonly', 'Idempotency-Key': 'readonly' } })).status, 403);
    const preview = await fetch(`${baseUrl}/api/finance/payments/${fixture.payment}/obligations/${fixture.obligation}/invoice-receipt-preview`, { headers: { Authorization: 'Bearer admin' } });
    assert.equal(preview.status, 200);
    const previewBody = await preview.json();
    assert.equal(previewBody.officialDocumentCreated, false);
    assert.equal(previewBody.definitiveNumberAllocated, false);
    assert.equal(previewBody.readiness.status, 'READY');
    assert.equal(previewBody.readiness.reasonCode, undefined);
    assert.equal(previewBody.sourceEligibility, 'ELIGIBLE');
    const countBeforeIssue = await pool.query<{ count: string }>('SELECT count(*)::text count FROM finance_financial_documents WHERE institution_id=$1', [institutionId]);
    assert.equal(countBeforeIssue.rows[0]?.count, '0');
    const payload = { paymentId: fixture.payment, obligationId: fixture.obligation, seriesId: fixture.series, institutionId: randomUUID(), adapterKey: 'angola-production', amount: '999', currency: 'USD', eligible: true };
    const issued = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer admin', 'Idempotency-Key': 'authorized', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); assert.equal(issued.status, 201); assert.equal((await issued.json()).sequenceNumber, 1);
    const foreign = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer foreign', 'Idempotency-Key': 'foreign', 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId: fixture.payment, obligationId: fixture.obligation, seriesId: fixture.series }) }); assert.equal(foreign.status, 404);
  } finally { server?.close(); await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});
