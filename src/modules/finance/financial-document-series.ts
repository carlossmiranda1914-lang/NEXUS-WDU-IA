import type { Pool, PoolClient } from 'pg';

export type EffectiveFinancialDocumentSeries = Readonly<{ id: string; institutionId: string; code: string; documentType: string; fiscalConfigurationId: string | null }>;

export class PostgresFinancialDocumentSeriesStore {
  constructor(private readonly pool: Pick<Pool | PoolClient, 'query'>) {}

  async requireEffective(institutionId: string, seriesId: string, documentType: string, at: Date = new Date()): Promise<EffectiveFinancialDocumentSeries> {
    const result = await this.pool.query<{ id: string; institution_id: string; code: string; document_type: string; fiscal_configuration_id: string | null }>(
      `SELECT id,institution_id,code,document_type,fiscal_configuration_id
       FROM finance_financial_document_series
       WHERE institution_id=$1 AND id=$2 AND document_type=$3 AND status='active'
         AND effective_from<=$4 AND (effective_to IS NULL OR effective_to>$4)`,
      [institutionId, seriesId, documentType, at],
    );
    const row = result.rows[0];
    if (!row) throw new Error('FINANCIAL_DOCUMENT_SERIES_NOT_EFFECTIVE');
    return Object.freeze({ id: row.id, institutionId: row.institution_id, code: row.code, documentType: row.document_type, fiscalConfigurationId: row.fiscal_configuration_id });
  }

  async findEffective(institutionId: string, documentType: string, at: Date = new Date()): Promise<EffectiveFinancialDocumentSeries | null> {
    const result = await this.pool.query<{ id: string; institution_id: string; code: string; document_type: string; fiscal_configuration_id: string | null }>(
      `SELECT id,institution_id,code,document_type,fiscal_configuration_id
       FROM finance_financial_document_series
       WHERE institution_id=$1 AND document_type=$2 AND status='active'
         AND effective_from<=$3 AND (effective_to IS NULL OR effective_to>$3)
       ORDER BY code LIMIT 1`,
      [institutionId, documentType, at],
    );
    const row = result.rows[0];
    return row ? Object.freeze({ id: row.id, institutionId: row.institution_id, code: row.code, documentType: row.document_type, fiscalConfigurationId: row.fiscal_configuration_id }) : null;
  }
}
