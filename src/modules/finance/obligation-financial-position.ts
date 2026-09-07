import { Money } from './money.ts';

export type AdjustmentDirection = 'increase' | 'decrease';
export interface ObligationAdjustmentPositionInput { readonly direction: AdjustmentDirection; readonly amount: Money; }
export interface ObligationFinancialPositionInput { readonly original: Money; readonly adjustments: readonly ObligationAdjustmentPositionInput[]; readonly allocations: readonly Money[]; readonly allocationReversals: readonly Money[]; }
export interface ObligationFinancialPosition { readonly netAdjustments: Money; readonly effectiveDue: Money; readonly netCovered: Money; readonly remainingCoverable: Money; }

const zero = (currency: string) => Money.parse('0', currency);
const sum = (values: readonly Money[], currency: string) => values.reduce((total, value) => total.add(value), zero(currency));

export function deriveObligationFinancialPosition(input: ObligationFinancialPositionInput): ObligationFinancialPosition {
  const { original } = input;
  const currency = original.currency;
  if (original.compare(zero(currency)) <= 0) throw new Error('Obligation original amount must be strictly positive');
  let netAdjustments = zero(currency);
  for (const adjustment of input.adjustments) {
    if (adjustment.amount.currency !== currency || adjustment.amount.compare(zero(currency)) <= 0) throw new Error('Adjustment Money must be positive and match Obligation currency');
    netAdjustments = adjustment.direction === 'increase' ? netAdjustments.add(adjustment.amount) : adjustment.direction === 'decrease' ? netAdjustments.subtract(adjustment.amount) : (() => { throw new Error('Adjustment direction is invalid'); })();
  }
  const netCovered = sum(input.allocations, currency).subtract(sum(input.allocationReversals, currency));
  if (netCovered.compare(zero(currency)) < 0) throw new Error('Allocation reversals cannot exceed allocations');
  const effectiveDue = original.add(netAdjustments);
  if (effectiveDue.compare(netCovered) < 0) throw new Error('Effective obligation due cannot be below covered amount');
  return { netAdjustments, effectiveDue, netCovered, remainingCoverable: effectiveDue.subtract(netCovered) };
}
