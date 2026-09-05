import type { Pool } from 'pg';
import { canonicalCurrencyRegistry } from './currency-registry.ts';

export interface InstitutionFinancialProfileVersion {
  institutionId: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  primaryJurisdiction: string;
  functionalCurrency: string;
  financialTimezone: string;
  monetaryPolicyVersion: string;
  enabledCurrencies: readonly string[];
}

export interface FinancialProfileStore {
  resolveEffective(institutionId: string, at?: Date): Promise<InstitutionFinancialProfileVersion | null>;
}

export interface FinancialContext {
  institutionId: string;
  financialProfileVersion: number;
  functionalCurrency: string;
  enabledCurrencies: readonly string[];
  financialTimezone: string;
}

export class PostgresFinancialProfileStore implements FinancialProfileStore {
  constructor(private readonly pool: Pool | import('pg').PoolClient) {}

  async resolveEffective(institutionId: string, at: Date = new Date()): Promise<InstitutionFinancialProfileVersion | null> {
    const res = await this.pool.query<{
      institution_id: string;
      version: number;
      effective_from: string | Date;
      effective_to: string | Date | null;
      primary_jurisdiction: string;
      functional_currency: string;
      financial_timezone: string;
      monetary_policy_version: string;
      enabled_currencies: string[] | string;
    }>(
      `SELECT institution_id, version, effective_from, effective_to, primary_jurisdiction,
              functional_currency, financial_timezone, monetary_policy_version, enabled_currencies
       FROM finance_profile_versions
       WHERE institution_id = $1 AND effective_from <= $2 AND (effective_to IS NULL OR effective_to > $2)
       ORDER BY version DESC LIMIT 1`,
      [institutionId, at]
    );

    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      institutionId: String(r.institution_id),
      version: Number(r.version),
      effectiveFrom: r.effective_from instanceof Date ? r.effective_from.toISOString() : String(r.effective_from),
      effectiveTo: r.effective_to ? (r.effective_to instanceof Date ? r.effective_to.toISOString() : String(r.effective_to)) : null,
      primaryJurisdiction: String(r.primary_jurisdiction),
      functionalCurrency: String(r.functional_currency),
      financialTimezone: String(r.financial_timezone),
      monetaryPolicyVersion: String(r.monetary_policy_version),
      enabledCurrencies: Array.isArray(r.enabled_currencies) ? r.enabled_currencies : JSON.parse(String(r.enabled_currencies)),
    };
  }
}

export async function requireFinancialContext(input: {
  institutionalContext: { institutionId: string; personId: string; role: string };
  effectiveAt: Date;
  store: FinancialProfileStore;
  requiredCurrency?: string;
}): Promise<InstitutionFinancialProfileVersion> {
  const { institutionalContext, effectiveAt, store, requiredCurrency } = input;
  if (!(effectiveAt instanceof Date) || Number.isNaN(effectiveAt.getTime())) throw new Error('Financial effective time is invalid');

  const profile = await store.resolveEffective(institutionalContext.institutionId, effectiveAt);
  if (!profile) throw new Error('No effective financial profile is available');
  if (profile.institutionId !== institutionalContext.institutionId) throw new Error('Financial profile institution does not match resolved context');

  const effectiveFrom = parseEffectiveTime(profile.effectiveFrom, 'effectiveFrom');
  const effectiveTo = profile.effectiveTo === null ? null : parseEffectiveTime(profile.effectiveTo, 'effectiveTo');
  if (effectiveFrom > effectiveAt || (effectiveTo !== null && effectiveAt >= effectiveTo)) {
    throw new Error('Financial profile is not effective at the requested time');
  }

  canonicalCurrencyRegistry.require(profile.functionalCurrency);
  for (const currency of profile.enabledCurrencies) canonicalCurrencyRegistry.require(currency);
  if (requiredCurrency !== undefined) {
    canonicalCurrencyRegistry.require(requiredCurrency);
    if (!profile.enabledCurrencies.includes(requiredCurrency)) throw new Error('Required currency is not enabled for this financial profile');
  }
  return profile;
}

function parseEffectiveTime(value: string, field: 'effectiveFrom' | 'effectiveTo'): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Financial profile ${field} is invalid`);
  return parsed;
}
