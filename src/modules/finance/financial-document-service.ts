import { validateDocumentSourceInstitution } from './financial-document-model.ts';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { createCanonicalFinanceFingerprint, executeIdempotentFinanceCommand } from './finance-command.ts';
import { FiscalAdapterRegistry, type FiscalAdapter } from './fiscal-adapter-registry.ts';

// F7-02 intentionally provides only a synthetic adapter. Production
// jurisdictions must be explicitly registered before they can issue.
const builtInFiscalAdapters: readonly FiscalAdapter[] = [{ key: 'core', supportedJurisdictions: ['NEXUS_TEST'] }];

export type FinancialDocumentIssuanceCommand = {
  institutionId: string;
  sourceInstitutionId: string;
  sourceType: 'payment';
  sourceId: string;
  seriesId: string;
  idempotencyKey: string;
};

export type FinancialDocumentCorrectionCommand = {
  institutionId: string;
  originalDocumentId: string;
  seriesId: string;
  documentType: string;
  idempotencyKey: string;
};

/** F7-01 command boundary: all source ownership is rejected before any numbering mutation. */
export async function issueFinancialDocumentCommand(_dependencies: unknown, command: FinancialDocumentIssuanceCommand): Promise<never> {
  validateDocumentSourceInstitution(command.institutionId, command.sourceInstitutionId);
  throw new Error('FINANCIAL_DOCUMENT_ISSUANCE_REPOSITORY_REQUIRED');
}

export class PostgresFinancialDocumentRepository {
  constructor(private readonly pool: Pool, private readonly fiscalAdapters = new FiscalAdapterRegistry(builtInFiscalAdapters)) {}

  async issue(command: FinancialDocumentIssuanceCommand & { documentType: string }) {
    validateDocumentSourceInstitution(command.institutionId, command.sourceInstitutionId);
    return (await executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: { institutionId: command.institutionId, operationNamespace: 'financial_document_issuance', idempotencyKey: command.idempotencyKey, canonicalFingerprint: createCanonicalFinanceFingerprint(command) },
      execute: async client => {
      // Lock the authoritative Finance source first, then the institution series.
      // The document snapshot is built from this server-side row, never caller input.
      const source = await client.query<{ id: string; amount: string; currency: string; payment_reference: string; effective_at: Date; journal_transaction_id: string; financial_profile_version: number }>(
        'SELECT id,amount::text,currency,payment_reference,effective_at,journal_transaction_id,financial_profile_version FROM finance_payments WHERE institution_id=$1 AND id=$2 FOR UPDATE',
        [command.institutionId, command.sourceId],
      );
      if (!source.rows[0]) throw new Error('FINANCIAL_DOCUMENT_SOURCE_NOT_FOUND');
      const sourceRow = source.rows[0];
      const fiscalConfiguration = await client.query<{ id: string; adapter_key: string }>(
        "SELECT id,adapter_key FROM finance_fiscal_configuration_versions WHERE institution_id=$1 AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY version DESC LIMIT 1 FOR SHARE",
        [command.institutionId],
      );
      if (!fiscalConfiguration.rows[0]) throw new Error('FISCAL_CONFIGURATION_NOT_EFFECTIVE');
      const financialProfile = await client.query<{ primary_jurisdiction: string }>(
        'SELECT primary_jurisdiction FROM finance_profile_versions WHERE institution_id=$1 AND version=$2',
        [command.institutionId, sourceRow.financial_profile_version],
      );
      if (!financialProfile.rows[0]) throw new Error('FINANCIAL_PROFILE_NOT_FOUND');
      this.fiscalAdapters.select(
        { primaryJurisdiction: financialProfile.rows[0].primary_jurisdiction },
        { adapterKey: fiscalConfiguration.rows[0].adapter_key },
      );
      const sourceSnapshot = {
        sourceType: command.sourceType,
        sourceId: sourceRow.id,
        paymentReference: sourceRow.payment_reference,
        journalTransactionId: sourceRow.journal_transaction_id,
        amount: sourceRow.amount,
        currency: sourceRow.currency,
        effectiveAt: sourceRow.effective_at.toISOString(),
        financialProfileVersion: sourceRow.financial_profile_version,
      };
      const series = await client.query<{ next_sequence_number: string }>(
        "SELECT next_sequence_number FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2 AND status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) FOR UPDATE",
        [command.institutionId, command.seriesId],
      );
      if (!series.rows[0]) throw new Error('FINANCIAL_DOCUMENT_SERIES_NOT_EFFECTIVE');
      const sequenceNumber = Number(series.rows[0].next_sequence_number);
      const id = randomUUID();
      await client.query('UPDATE finance_financial_document_series SET next_sequence_number=$3 WHERE institution_id=$1 AND id=$2', [command.institutionId, command.seriesId, sequenceNumber + 1]);
      await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,series_id,sequence_number,source_snapshot,fiscal_configuration_id,fiscal_adapter_key,issued_at) VALUES($1,$2,$3,'issued',$4,$5,$6,$7,$8,now())", [id, command.institutionId, command.documentType, command.seriesId, sequenceNumber, sourceSnapshot, fiscalConfiguration.rows[0].id, fiscalConfiguration.rows[0].adapter_key]);
      await client.query('INSERT INTO finance_financial_document_sources(institution_id,document_id,source_type,source_id,snapshot) VALUES($1,$2,$3,$4,$5)', [command.institutionId, id, command.sourceType, command.sourceId, sourceSnapshot]);
      await client.query("INSERT INTO finance_audit_records(institution_id,event_type,metadata) VALUES($1,'financial_document_issued',$2)", [command.institutionId, { documentId: id, seriesId: command.seriesId, sequenceNumber }]);
      await client.query("INSERT INTO finance_outbox(institution_id,topic,aggregate_id,payload) VALUES($1,'financial_document_issued',$2,$3)", [command.institutionId, id, { documentId: id, seriesId: command.seriesId, sequenceNumber }]);
      return { resultRef: id, result: { id, sequenceNumber } };
      },
      loadResult: async (client, id) => { const row = await client.query<{ sequence_number: string }>('SELECT sequence_number FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [command.institutionId, id]); if (!row.rows[0]) throw new Error('FINANCIAL_DOCUMENT_RESULT_MISSING'); return { id, sequenceNumber: Number(row.rows[0].sequence_number) }; },
    })).result;
  }

  async issueCorrection(command: FinancialDocumentCorrectionCommand) {
    return (await executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: { institutionId: command.institutionId, operationNamespace: 'financial_document_correction', idempotencyKey: command.idempotencyKey, canonicalFingerprint: createCanonicalFinanceFingerprint(command) },
      execute: async client => {
        // Lock the original fact and its provenance before the new series counter.
        const original = await client.query<{ id: string; source_snapshot: Record<string, unknown>; fiscal_configuration_id: string | null; fiscal_adapter_key: string | null }>(
          "SELECT id,source_snapshot,fiscal_configuration_id,fiscal_adapter_key FROM finance_financial_documents WHERE institution_id=$1 AND id=$2 AND status='issued' FOR UPDATE",
          [command.institutionId, command.originalDocumentId],
        );
        if (!original.rows[0]) throw new Error('FINANCIAL_DOCUMENT_ORIGINAL_NOT_FOUND');
        const originalSources = await client.query<{ source_type: string; source_id: string; snapshot: Record<string, unknown> }>(
          'SELECT source_type,source_id,snapshot FROM finance_financial_document_sources WHERE institution_id=$1 AND document_id=$2 FOR UPDATE',
          [command.institutionId, command.originalDocumentId],
        );
        if (originalSources.rows.length === 0) throw new Error('FINANCIAL_DOCUMENT_ORIGINAL_PROVENANCE_MISSING');
        const series = await client.query<{ next_sequence_number: string }>(
          "SELECT next_sequence_number FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2 AND status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) FOR UPDATE",
          [command.institutionId, command.seriesId],
        );
        if (!series.rows[0]) throw new Error('FINANCIAL_DOCUMENT_SERIES_NOT_EFFECTIVE');
        const sequenceNumber = Number(series.rows[0].next_sequence_number);
        const id = randomUUID();
        await client.query('UPDATE finance_financial_document_series SET next_sequence_number=$3 WHERE institution_id=$1 AND id=$2', [command.institutionId, command.seriesId, sequenceNumber + 1]);
        await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,series_id,sequence_number,source_snapshot,corrects_document_id,fiscal_configuration_id,fiscal_adapter_key,issued_at) VALUES($1,$2,$3,'issued',$4,$5,$6,$7,$8,$9,now())", [id, command.institutionId, command.documentType, command.seriesId, sequenceNumber, original.rows[0].source_snapshot, command.originalDocumentId, original.rows[0].fiscal_configuration_id, original.rows[0].fiscal_adapter_key]);
        for (const source of originalSources.rows) {
          await client.query('INSERT INTO finance_financial_document_sources(institution_id,document_id,source_type,source_id,snapshot) VALUES($1,$2,$3,$4,$5)', [command.institutionId, id, source.source_type, source.source_id, source.snapshot]);
        }
        await client.query("INSERT INTO finance_audit_records(institution_id,event_type,metadata) VALUES($1,'financial_document_corrected',$2)", [command.institutionId, { documentId: id, originalDocumentId: command.originalDocumentId, seriesId: command.seriesId, sequenceNumber }]);
        await client.query("INSERT INTO finance_outbox(institution_id,topic,aggregate_id,payload) VALUES($1,'financial_document_corrected',$2,$3)", [command.institutionId, id, { documentId: id, originalDocumentId: command.originalDocumentId, seriesId: command.seriesId, sequenceNumber }]);
        return { resultRef: id, result: { id, sequenceNumber, originalDocumentId: command.originalDocumentId } };
      },
      loadResult: async (client, id) => {
        const row = await client.query<{ sequence_number: string; corrects_document_id: string }>('SELECT sequence_number,corrects_document_id FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [command.institutionId, id]);
        if (!row.rows[0]) throw new Error('FINANCIAL_DOCUMENT_CORRECTION_RESULT_MISSING');
        return { id, sequenceNumber: Number(row.rows[0].sequence_number), originalDocumentId: row.rows[0].corrects_document_id };
      },
    })).result;
  }
}
