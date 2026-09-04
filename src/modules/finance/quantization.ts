import { canonicalCurrencyRegistry, type CurrencyRegistry } from './currency-registry.ts';
import { type RoundingMode, ExactDecimal } from './exact-decimal.ts';
import { Money, MONEY_MAX_PRECISION, MONEY_MAX_SCALE } from './money.ts';

export function quantizeMoneyCandidate(amount: ExactDecimal, currency: string, scale: number, mode: RoundingMode, registry: CurrencyRegistry = canonicalCurrencyRegistry): Money {
  if (!Number.isSafeInteger(scale) || scale < 0 || scale > MONEY_MAX_SCALE) throw new Error('Money quantization scale is outside the permitted envelope');
  return Money.fromDecimal(amount.quantize(scale, mode), currency, registry);
}

export function distributeMoney(total: Money, count: number, scale: number, mode: RoundingMode): Money[] {
  if (!Number.isSafeInteger(count) || count <= 0) throw new Error('Distribution count must be a positive integer');
  if (!Number.isSafeInteger(scale) || scale < 0 || scale > MONEY_MAX_SCALE) throw new Error('Distribution scale is outside the permitted envelope');
  const rounded = total.amount.quantize(scale, mode);
  if (rounded.compare(total.amount) !== 0) throw new Error('Distribution would lose value; quantize explicitly first');
  const units = rounded.scaledCoefficient(scale);
  const divisor = BigInt(count);
  const base = units / divisor;
  const remainder = units % divisor;
  const direction = remainder < 0n ? -1n : 1n;
  const extra = remainder < 0n ? -remainder : remainder;
  return Array.from({ length: count }, (_, index) => {
    const unitsForPart = base + (BigInt(index) < extra ? direction : 0n);
    return Money.fromDecimal(ExactDecimal.fromParts(unitsForPart, scale, MONEY_MAX_PRECISION, MONEY_MAX_SCALE), total.currency);
  });
}
