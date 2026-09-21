import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { PostgresFinancialDocumentRepository } from '../src/modules/finance/financial-document-service.ts';
import { createSyntheticUatFiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';
import { FinancialDocumentArtifactService } from '../src/modules/finance/financial-document-artifact-service.ts';

test('issued document, V2 snapshot, payment provenance and private artifact survive PostgreSQL pool restart', async () => {
  await verifyApprovedTestConnection();
  const schema = `finance_receipt_restart_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const institutionId = randomUUID(); const foreignInstitutionId = randomUUID(); const seriesId = randomUUID();
  const poolOptions = { connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` };
  let pool = new pg.Pool(poolOptions);
  try {
    const client = await pool.connect();
    let paymentId: string;
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
      const personId = randomUUID(), recipientId = randomUUID(), accountId = randomUUID(), journalId = randomUUID(); paymentId = randomUUID();
      await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Restart evidence','restart-evidence','active'),($2,'Foreign','restart-foreign','active')", [institutionId, foreignInstitutionId]);
      await client.query("INSERT INTO people(id,name) VALUES($1,'Payer'),($2,'Recipient')", [personId, recipientId]);
      await client.query("INSERT INTO institution_legal_profiles(institution_id,version,legal_name,tax_identifier,registered_address,effective_from) VALUES($1,1,'Restart evidence school','PT999999990',$2,now()-interval '1 day')", [institutionId, { countryCode: 'PT', line1: 'Rua 1' }]);
      await client.query("INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now(),'NEXUS_TEST','EUR','Europe/Lisbon','v1','[\"EUR\"]')", [institutionId]);
      await client.query("INSERT INTO finance_fiscal_configuration_versions(institution_id,version,adapter_key,effective_from) VALUES($1,1,'core',now())", [institutionId]);
      await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code,next_sequence_number) VALUES($1,$2,'RST',1)", [seriesId, institutionId]);
      await client.query("INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'RST-01','Restart account')", [accountId, institutionId]);
      await client.query("INSERT INTO finance_financial_account_parties(institution_id,financial_account_id,person_id,role) VALUES($1,$2,$3,'primary_debtor')", [institutionId, accountId, recipientId]);
      await client.query("INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES($1,$2,'confirmed','EUR',10,$3,'foundation_value_received',$4,1,now())", [journalId, institutionId, `restart-${paymentId}`, personId]);
      await client.query("INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,financial_account_id,source_type,method,amount,currency,status,allocation_status,payer_person_id,effective_at,financial_profile_version,actor_person_id) VALUES($1,$2,'PAY-RESTART',$3,$4,'manual_offline','cash',10,'EUR','confirmed','unapplied',$5,now(),1,$5)", [paymentId, institutionId, journalId, accountId, personId]);
    } finally { client.release(); }
    const repository = new PostgresFinancialDocumentRepository(pool, createSyntheticUatFiscalAdapterRegistry());
    const issued = await repository.issue({ institutionId, sourceInstitutionId: institutionId, sourceType: 'payment', sourceId: paymentId!, seriesId, documentType: 'receipt', idempotencyKey: 'restart-evidence-1' });
    const artifact = await new FinancialDocumentArtifactService(pool).generate({ institutionId, documentId: issued.id, renderVersion: 'renderer-1', templateVersion: 'template-1' });
    const before = await pool.query<{ documentary_snapshot: unknown; source_id: string; sequence_number: string; content_hash: string }>("SELECT d.documentary_snapshot,s.source_id,d.sequence_number,a.content_hash FROM finance_financial_documents d JOIN finance_financial_document_sources s ON s.document_id=d.id AND s.institution_id=d.institution_id JOIN finance_financial_document_artifacts a ON a.document_id=d.id AND a.institution_id=d.institution_id WHERE d.institution_id=$1 AND d.id=$2", [institutionId, issued.id]);
    await pool.end();
    pool = new pg.Pool(poolOptions);
    const after = await pool.query<{ documentary_snapshot: unknown; source_id: string; sequence_number: string; content_hash: string }>("SELECT d.documentary_snapshot,s.source_id,d.sequence_number,a.content_hash FROM finance_financial_documents d JOIN finance_financial_document_sources s ON s.document_id=d.id AND s.institution_id=d.institution_id JOIN finance_financial_document_artifacts a ON a.document_id=d.id AND a.institution_id=d.institution_id WHERE d.institution_id=$1 AND d.id=$2", [institutionId, issued.id]);
    assert.deepEqual(after.rows[0], before.rows[0], 'restart must read the exact persisted document, source, number, snapshot and artifact provenance');
    assert.equal((after.rows[0]!.documentary_snapshot as { snapshotVersion?: number }).snapshotVersion, 2);
    const bytes = await new FinancialDocumentArtifactService(pool).retrieve({ institutionId, artifactId: artifact.id });
    assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-');
    await assert.rejects(() => new FinancialDocumentArtifactService(pool).retrieve({ institutionId: foreignInstitutionId, artifactId: artifact.id }), /NOT_FOUND/);
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined);
    await pool.end();
  }
});
