import { canonicalCurrencyRegistry, type CurrencyRegistry } from './currency-registry.ts';
import { ExactDecimal } from './exact-decimal.ts';

export const MONEY_MAX_PRECISION = 30;
export const MONEY_MAX_SCALE = 12;

export class Money {
  private constructor(readonly amount: ExactDecimal, readonly currency: string) {}

  static parse(amount: string, currency: string, registry: CurrencyRegistry = canonicalCurrencyRegistry): Money {
    registry.require(currency);
    return new Money(ExactDecimal.parse(amount, MONEY_MAX_PRECISION, MONEY_MAX_SCALE), currency);
  }

  static fromDecimal(amount: ExactDecimal, currency: string, registry: CurrencyRegistry = canonicalCurrencyRegistry): Money {
    registry.require(currency);
    return new Money(ExactDecimal.parse(amount.toCanonicalString(), MONEY_MAX_PRECISION, MONEY_MAX_SCALE), currency);
  }

  canonicalAmount(): string { return this.amount.toCanonicalString(); }
  serialize(): { amount: string; currency: string } { return { amount: this.canonicalAmount(), currency: this.currency }; }
  equals(other: Money): boolean { return this.currency === other.currency && this.amount.compare(other.amount) === 0; }

  add(other: Money): Money {
    this.requireSameCurrency(other);
    return Money.fromDecimal(this.amount.add(other.amount), this.currency);
  }

  subtract(other: Money): Money {
    this.requireSameCurrency(other);
    return Money.fromDecimal(this.amount.subtract(other.amount), this.currency);
  }

  compare(other: Money): -1 | 0 | 1 {
    this.requireSameCurrency(other);
    return this.amount.compare(other.amount);
  }

  private requireSameCurrency(other: Money): void {
    if (this.currency !== other.currency) throw new Error('Cross-currency Money operation is not permitted');
  }
}
