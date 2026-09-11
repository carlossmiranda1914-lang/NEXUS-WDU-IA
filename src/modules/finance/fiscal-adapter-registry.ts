export type FiscalAdapter = Readonly<{
  key: string;
  supportedJurisdictions: readonly string[];
  /** A policy pack is explicit evidence, not a claim that its fields are globally mandatory. */
  policy: Readonly<{
    version: string;
    supportedDocumentTypes: readonly string[];
    /** Explicit document evidence; absence is never silently replaced by defaults. */
    documentary?: Readonly<Record<string, Readonly<{ taxTreatment: string; legalMentions: readonly string[] }>>>;
  }>;
}>;

export type ResolvedDocumentaryPolicy = Readonly<{ taxTreatment: string; legalMentions: readonly string[] }>;

/** A document type is eligible only when its versioned adapter policy carries all documentary evidence. */
export function resolveDocumentaryPolicy(adapter: FiscalAdapter, documentType: string): ResolvedDocumentaryPolicy {
  if (!adapter.policy.supportedDocumentTypes.includes(documentType)) throw new Error('DOCUMENT_TYPE_UNSUPPORTED');
  const policy = adapter.policy.documentary?.[documentType];
  if (!policy) throw new Error('DOCUMENTARY_POLICY_REQUIRED');
  if (typeof policy.taxTreatment !== 'string' || policy.taxTreatment.trim().length === 0) throw new Error('DOCUMENTARY_POLICY_TAX_TREATMENT_REQUIRED');
  if (!Array.isArray(policy.legalMentions)) throw new Error('DOCUMENTARY_POLICY_LEGAL_MENTIONS_REQUIRED');
  if (policy.legalMentions.some(mention => typeof mention !== 'string' || mention.trim().length === 0)) throw new Error('DOCUMENTARY_POLICY_LEGAL_MENTIONS_INVALID');
  return Object.freeze({ taxTreatment: policy.taxTreatment, legalMentions: Object.freeze([...policy.legalMentions]) });
}

export class FiscalAdapterRegistry {
  constructor(private readonly adapters: readonly FiscalAdapter[]) {}

  select(
    financialProfile: { primaryJurisdiction: string },
    fiscalConfiguration: { adapterKey: string },
  ): FiscalAdapter {
    const adapter = this.adapters.find((candidate) => candidate.supportedJurisdictions.includes(financialProfile.primaryJurisdiction));
    if (!adapter) throw new Error('FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION');
    if (adapter.key !== fiscalConfiguration.adapterKey) throw new Error('FISCAL_CONFIGURATION_ADAPTER_MISMATCH');
    return adapter;
  }

  has(adapterKey: string): boolean {
    return this.adapters.some((adapter) => adapter.key === adapterKey);
  }

  supportsJurisdiction(jurisdiction: string): boolean {
    return this.adapters.some((adapter) => adapter.supportedJurisdictions.includes(jurisdiction));
  }

  resolveForJurisdiction(jurisdiction: string): FiscalAdapter {
    const matches = this.adapters.filter((adapter) => adapter.supportedJurisdictions.includes(jurisdiction));
    if (matches.length !== 1) throw new Error('FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION');
    return matches[0]!;
  }
}

/** No jurisdiction has been approved for production fiscal operation yet. */
export const productionFiscalAdapterRegistry = new FiscalAdapterRegistry([]);

const syntheticUatAdapter: FiscalAdapter = {
  key: 'core',
  supportedJurisdictions: ['NEXUS_TEST'],
  policy: {
    version: 'core-1', supportedDocumentTypes: ['receipt', 'credit_note'],
    documentary: {
      receipt: { taxTreatment: 'not_applicable', legalMentions: [] },
      credit_note: { taxTreatment: 'not_applicable', legalMentions: [] },
    },
  },
};

/**
 * Test/UAT-only composition.  It is selected by server bootstrap, never by a
 * browser request, institution profile, or fiscal-configuration payload.
 */
export const createSyntheticUatFiscalAdapterRegistry = () => new FiscalAdapterRegistry([syntheticUatAdapter]);

export const runtimeFiscalAdapterRegistry = () =>
  process.env.NEXUS_UAT_SYNTHETIC_FISCAL_ADAPTERS === 'true'
    ? createSyntheticUatFiscalAdapterRegistry()
    : productionFiscalAdapterRegistry;
