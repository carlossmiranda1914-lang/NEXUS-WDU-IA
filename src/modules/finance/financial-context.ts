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
  resolveEffective(institutionId: string, at: Date): Promise<InstitutionFinancialProfileVersion | null>;
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
