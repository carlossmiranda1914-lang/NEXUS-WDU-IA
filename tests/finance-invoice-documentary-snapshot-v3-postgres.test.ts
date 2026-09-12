import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { composeInvoiceDocumentarySnapshotV3, decodeDocumentarySnapshot } from '../src/modules/finance/documentary-snapshot.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

test('PostgreSQL preserves a V3 invoice snapshot exactly and scopes its obligation source to the owning institution', async () => {
  await verifyApprovedTestConnection();
  const schema = `finance_invoice_v3_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
  const institutionId = randomUUID(); const foreignInstitutionId = randomUUID(); const seriesId = randomUUID(); const documentId = randomUUID(); const obligationId = randomUUID();
  const snapshot = composeInvoiceDocumentarySnapshotV3({
    issuedAt: new Date('2026-09-12T10:00:00.000Z'), dueAt: new Date('2026-10-12T00:00:00.000Z'),
    issuer: { legalName: 'Invoice School', taxIdentifier: 'AO500000001', address: { countryCode: 'AO', line1: 'Rua da Escola, 1' } }, recipient: { name: 'Invoice recipient', authorityId: 'person-1' },
    obligation: { authorityId: obligationId, reference: 'OBR-0001', amount: '100.00', currency: 'AOA', dueAt: '2026-10-12T00:00:00.000Z' },
    line: { description: 'Propina', quantity: '1', unitPrice: '100', discount: '0', tax: '0' }, taxTreatment: 'not_applicable', legalMentions: [], jurisdictionCode: 'NEXUS_TEST', policyVersion: 'core-1', financialProfileVersion: 1, fiscalConfigurationVersion: 1, seriesId, adapterKey: 'core',
  });
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
      await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Invoice School','invoice-school','active'),($2,'Foreign','invoice-foreign','active')", [institutionId, foreignInstitutionId]);
      await client.query("INSERT INTO finance_financial_document_series(id,institution_id,code) VALUES($1,$2,'FT')", [seriesId, institutionId]);
      const before = await client.query<{ payments: number; allocations: number; obligations: number }>("SELECT (SELECT count(*)::int FROM finance_payments) payments,(SELECT count(*)::int FROM finance_allocations) allocations,(SELECT count(*)::int FROM finance_obligations) obligations");
      await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,series_id,sequence_number,source_snapshot,documentary_snapshot,documentary_snapshot_schema_version,fiscal_policy_version,fiscal_policy_snapshot,jurisdiction_extension_data,issued_at) VALUES($1,$2,'invoice','issued',$3,1,$4,$5,3,'core-1',$6,$7,$8)", [documentId, institutionId, seriesId, { obligationReference: 'OBR-0001' }, snapshot, { adapterKey: 'core', documentType: 'invoice', policyVersion: 'core-1' }, {}, snapshot.document.issuedAt]);
      await client.query("INSERT INTO finance_financial_document_sources(institution_id,document_id,source_type,source_id,snapshot) VALUES($1,$2,'obligation',$3,$4)", [institutionId, documentId, obligationId, { obligationReference: 'OBR-0001' }]);
      const stored = await client.query<{ documentary_snapshot: unknown; documentary_snapshot_schema_version: number }>('SELECT documentary_snapshot,documentary_snapshot_schema_version FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [institutionId, documentId]);
      assert.equal(stored.rows[0]?.documentary_snapshot_schema_version, 3);
      assert.deepEqual(decodeDocumentarySnapshot(stored.rows[0]?.documentary_snapshot), { snapshotVersion: 3, snapshot });
      assert.equal((await client.query('SELECT 1 FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [foreignInstitutionId, documentId])).rowCount, 0);
      assert.equal((await client.query('SELECT 1 FROM finance_financial_document_sources WHERE institution_id=$1 AND document_id=$2 AND source_type=\'obligation\'', [foreignInstitutionId, documentId])).rowCount, 0);
      const after = await client.query<{ payments: number; allocations: number; obligations: number }>("SELECT (SELECT count(*)::int FROM finance_payments) payments,(SELECT count(*)::int FROM finance_allocations) allocations,(SELECT count(*)::int FROM finance_obligations) obligations");
      assert.deepEqual(after.rows[0], before.rows[0], 'V3 storage never creates or mutates payment, allocation, or obligation facts');
    } finally { client.release(); }
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined);
    await pool.end();
  }
});
