import { canonicalCurrencyRegistry, type CurrencyRegistry } from './currency-registry.ts';
import { ExactDecimal } from './exact-decimal.ts';

const RATE_MAX_PRECISION = 30;
const RATE_MAX_SCALE = 18;

export class DecimalRatio {
  private constructor(readonly value: ExactDecimal) {}
  static parse(value: string): DecimalRatio { return new DecimalRatio(ExactDecimal.parse(value, RATE_MAX_PRECISION, RATE_MAX_SCALE)); }
  static fromExact(value: ExactDecimal): DecimalRatio { return new DecimalRatio(ExactDecimal.parse(value.toCanonicalString(), RATE_MAX_PRECISION, RATE_MAX_SCALE)); }
}

export class Percentage {
  private constructor(private readonly percent: ExactDecimal) {}
  static parsePercent(value: string): Percentage { return new Percentage(ExactDecimal.parse(value, RATE_MAX_PRECISION, RATE_MAX_SCALE)); }
  toRatio(): DecimalRatio {
    return DecimalRatio.fromExact(ExactDecimal.fromParts(this.percent.coefficient, this.percent.scale + 2, RATE_MAX_PRECISION, RATE_MAX_SCALE));
  }
}

export class ExchangeRate {
  private constructor(
    readonly baseCurrency: string,
    readonly quoteCurrency: string,
    readonly rate: ExactDecimal,
  ) {}

  static create(baseCurrency: string, quoteCurrency: string, rate: string, registry: CurrencyRegistry = canonicalCurrencyRegistry): ExchangeRate {
    registry.require(baseCurrency);
    registry.require(quoteCurrency);
    const exactRate = ExactDecimal.parse(rate, RATE_MAX_PRECISION, RATE_MAX_SCALE);
    if (exactRate.compare(ExactDecimal.parse('0', RATE_MAX_PRECISION, RATE_MAX_SCALE)) <= 0) throw new Error('Exchange rate must be strictly positive');
    return new ExchangeRate(baseCurrency, quoteCurrency, exactRate);
  }
}
