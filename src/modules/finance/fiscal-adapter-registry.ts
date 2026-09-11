export type FiscalAdapter = Readonly<{
  key: string;
  supportedJurisdictions: readonly string[];
  /** A policy pack is explicit evidence, not a claim that its fields are globally mandatory. */
  policy: Readonly<{ version: string; supportedDocumentTypes: readonly string[] }>;
}>;

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
}

/** No jurisdiction has been approved for production fiscal operation yet. */
export const productionFiscalAdapterRegistry = new FiscalAdapterRegistry([]);

const syntheticUatAdapter: FiscalAdapter = {
  key: 'core',
  supportedJurisdictions: ['NEXUS_TEST'],
  policy: { version: 'core-1', supportedDocumentTypes: ['receipt', 'credit_note'] },
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
