import { canonicalCurrencyRegistry } from './currency-registry.ts';
import { Money } from './money.ts';

export type FinanceMoneyValue = Readonly<{ amount: string; currency: string }>;

/**
 * Formats exact Finance money for people without converting its value through
 * JavaScript's binary floating point representation.  The domain canonical
 * amount remains untouched; any scale beyond the currency minor unit is shown
 * rather than silently rounded away.
 */
export function formatFinanceMoney(value: FinanceMoneyValue): string {
  const money = Money.parse(value.amount, value.currency);
  const currency = canonicalCurrencyRegistry.require(money.currency);
  const canonical = money.canonicalAmount();
  const negative = canonical.startsWith('-');
  const unsigned = negative ? canonical.slice(1) : canonical;
  const [integerPart, suppliedFraction = ''] = unsigned.split('.');
  const fraction = suppliedFraction.length >= currency.minorUnit
    ? suppliedFraction
    : suppliedFraction.padEnd(currency.minorUnit, '0');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}${groupedInteger}${fraction ? `,${fraction}` : ''} ${money.currency}`;
}
