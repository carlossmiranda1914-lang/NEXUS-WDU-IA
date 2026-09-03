export interface CurrencyDefinition {
  code: string;
  minorUnit: number;
  status: 'active' | 'historical' | 'special';
  registryVersion: string;
}

export interface CurrencyRegistry {
  require(code: string): CurrencyDefinition;
}

const REGISTRY_VERSION = 'iso4217-foundation-v1';
const definitions: ReadonlyMap<string, CurrencyDefinition> = new Map([
  ['EUR', { code: 'EUR', minorUnit: 2, status: 'active', registryVersion: REGISTRY_VERSION }],
  ['AOA', { code: 'AOA', minorUnit: 2, status: 'active', registryVersion: REGISTRY_VERSION }],
  ['USD', { code: 'USD', minorUnit: 2, status: 'active', registryVersion: REGISTRY_VERSION }],
  ['GBP', { code: 'GBP', minorUnit: 2, status: 'active', registryVersion: REGISTRY_VERSION }],
]);

export const canonicalCurrencyRegistry: CurrencyRegistry = {
  require(code: string): CurrencyDefinition {
    const definition = definitions.get(code);
    if (!definition) throw new Error(`Unrecognized currency: ${code}`);
    return definition;
  },
};
