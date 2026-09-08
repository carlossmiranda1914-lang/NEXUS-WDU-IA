import { validateDocumentSourceInstitution } from './financial-document-model.ts';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { createCanonicalFinanceFingerprint, executeIdempotentFinanceCommand } from './finance-command.ts';

export type FinancialDocumentIssuanceCommand = { institutionId: string; sourceInstitutionId: string; seriesId: string; idempotencyKey: string };

/** F7-01 command boundary: all source ownership is rejected before any numbering mutation. */
export async function issueFinancialDocumentCommand(_dependencies: unknown, command: FinancialDocumentIssuanceCommand): Promise<never> {
  validateDocumentSourceInstitution(command.institutionId, command.sourceInstitutionId);
  throw new Error('FINANCIAL_DOCUMENT_ISSUANCE_REPOSITORY_REQUIRED');
}

export class PostgresFinancialDocumentRepository {
  constructor(private readonly pool: Pool) {}

  async issue(command: FinancialDocumentIssuanceCommand & { documentType: string; sourceSnapshot: Record<string, unknown> }) {
    validateDocumentSourceInstitution(command.institutionId, command.sourceInstitutionId);
    return (await executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: { institutionId: command.institutionId, operationNamespace: 'financial_document_issuance', idempotencyKey: command.idempotencyKey, canonicalFingerprint: createCanonicalFinanceFingerprint(command) },
      execute: async client => {
      const series = await client.query<{ next_sequence_number: string }>(
        'SELECT next_sequence_number FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2 FOR UPDATE',
        [command.institutionId, command.seriesId],
      );
      if (!series.rows[0]) throw new Error('FINANCIAL_DOCUMENT_SERIES_NOT_FOUND');
      const sequenceNumber = Number(series.rows[0].next_sequence_number);
      const id = randomUUID();
      await client.query('UPDATE finance_financial_document_series SET next_sequence_number=$3 WHERE institution_id=$1 AND id=$2', [command.institutionId, command.seriesId, sequenceNumber + 1]);
      await client.query("INSERT INTO finance_financial_documents(id,institution_id,document_type,status,series_id,sequence_number,source_snapshot,issued_at) VALUES($1,$2,$3,'issued',$4,$5,$6,now())", [id, command.institutionId, command.documentType, command.seriesId, sequenceNumber, command.sourceSnapshot]);
      await client.query('INSERT INTO finance_financial_document_sources(institution_id,document_id,source_type,source_id,snapshot) VALUES($1,$2,$3,$4,$5)', [command.institutionId, id, 'finance_source', command.seriesId, command.sourceSnapshot]);
      await client.query("INSERT INTO finance_audit_records(institution_id,event_type,metadata) VALUES($1,'financial_document_issued',$2)", [command.institutionId, { documentId: id, seriesId: command.seriesId, sequenceNumber }]);
      await client.query("INSERT INTO finance_outbox(institution_id,topic,aggregate_id,payload) VALUES($1,'financial_document_issued',$2,$3)", [command.institutionId, id, { documentId: id, seriesId: command.seriesId, sequenceNumber }]);
      return { resultRef: id, result: { id, sequenceNumber } };
      },
      loadResult: async (client, id) => { const row = await client.query<{ sequence_number: string }>('SELECT sequence_number FROM finance_financial_documents WHERE institution_id=$1 AND id=$2', [command.institutionId, id]); if (!row.rows[0]) throw new Error('FINANCIAL_DOCUMENT_RESULT_MISSING'); return { id, sequenceNumber: Number(row.rows[0].sequence_number) }; },
    })).result;
  }
}
