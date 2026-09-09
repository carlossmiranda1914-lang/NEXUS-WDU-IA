import type { Pool, PoolClient } from 'pg';

export type EffectiveFiscalConfiguration = Readonly<{
  id: string;
  institutionId: string;
  version: number;
  adapterKey: string;
  operationalConfiguration: Readonly<Record<string, unknown>>;
  effectiveFrom: string;
  effectiveTo: string | null;
}>;

export class PostgresFiscalConfigurationStore {
  constructor(private readonly pool: Pick<Pool | PoolClient, 'query'>) {}

  async requireEffective(institutionId: string, at: Date = new Date()): Promise<EffectiveFiscalConfiguration> {
    const result = await this.pool.query<{
      id: string; institution_id: string; version: number; adapter_key: string;
      operational_configuration: Record<string, unknown>; effective_from: Date; effective_to: Date | null;
    }>(
      `SELECT id,institution_id,version,adapter_key,operational_configuration,effective_from,effective_to
       FROM finance_fiscal_configuration_versions
       WHERE institution_id=$1 AND effective_from <= $2 AND (effective_to IS NULL OR effective_to > $2)
       ORDER BY version DESC LIMIT 1`,
      [institutionId, at],
    );
    const row = result.rows[0];
    if (!row) throw new Error('FISCAL_CONFIGURATION_NOT_EFFECTIVE');
    return Object.freeze({
      id: row.id, institutionId: row.institution_id, version: Number(row.version), adapterKey: row.adapter_key,
      operationalConfiguration: Object.freeze({ ...row.operational_configuration }),
      effectiveFrom: row.effective_from.toISOString(), effectiveTo: row.effective_to?.toISOString() ?? null,
    });
  }
}
