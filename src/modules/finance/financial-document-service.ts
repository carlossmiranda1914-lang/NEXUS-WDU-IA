import { validateDocumentSourceInstitution } from './financial-document-model.ts';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

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
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
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
      await client.query('COMMIT');
      return { id, sequenceNumber };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
