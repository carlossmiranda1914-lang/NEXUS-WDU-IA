export interface CurrencyDefinition {
  readonly code: string;
  readonly minorUnit: number;
  readonly status: 'active' | 'historical' | 'special';
  readonly registryVersion: string;
}

export interface CurrencyRegistry {
  require(code: string): CurrencyDefinition;
}

const REGISTRY_VERSION = 'iso4217-foundation-v1';
const definitions: ReadonlyMap<string, CurrencyDefinition> = new Map<string, CurrencyDefinition>([
  ['EUR', Object.freeze({ code: 'EUR', minorUnit: 2, status: 'active' as const, registryVersion: REGISTRY_VERSION })],
  ['AOA', Object.freeze({ code: 'AOA', minorUnit: 2, status: 'active' as const, registryVersion: REGISTRY_VERSION })],
  ['USD', Object.freeze({ code: 'USD', minorUnit: 2, status: 'active' as const, registryVersion: REGISTRY_VERSION })],
  ['GBP', Object.freeze({ code: 'GBP', minorUnit: 2, status: 'active' as const, registryVersion: REGISTRY_VERSION })],
]);

export const canonicalCurrencyRegistry: CurrencyRegistry = {
  require(code: string): CurrencyDefinition {
    const definition = definitions.get(code);
    if (!definition) throw new Error(`Unrecognized currency: ${code}`);
    return definition;
  },
};
