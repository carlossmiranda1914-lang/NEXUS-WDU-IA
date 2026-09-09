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
}
