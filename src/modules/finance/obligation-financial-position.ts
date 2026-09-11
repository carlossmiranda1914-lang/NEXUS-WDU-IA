import { Money } from './money.ts';

export type AdjustmentDirection = 'increase' | 'decrease';

export interface ObligationAdjustmentPositionInput {
  readonly direction: AdjustmentDirection;
  readonly amount: Money;
}

export interface ObligationDiscountPositionInput {
  readonly id: string;
  readonly amount: Money;
}

export interface ObligationDiscountRevocationPositionInput {
  readonly originalDiscountId: string;
  readonly amount: Money;
}

export interface ObligationFinancialPositionInput {
  readonly original: Money;
  readonly adjustments?: readonly ObligationAdjustmentPositionInput[];
  readonly discounts?: readonly ObligationDiscountPositionInput[];
  readonly discountRevocations?: readonly ObligationDiscountRevocationPositionInput[];
  readonly allocations: readonly Money[];
  readonly allocationReversals: readonly Money[];
}

export interface ObligationFinancialPosition {
  readonly netAdjustments: Money;
  readonly grossDiscounts: Money;
  readonly revokedDiscounts: Money;
  readonly netDiscounts: Money;
  readonly effectiveDue: Money;
  readonly netCovered: Money;
  readonly remainingCoverable: Money;
}

const zero = (currency: string) => Money.parse('0', currency);
const sum = (values: readonly Money[], currency: string) =>
  values.reduce((total, value) => total.add(value), zero(currency));

export function deriveObligationFinancialPosition(
  input: ObligationFinancialPositionInput
): ObligationFinancialPosition {
  const { original } = input;
  const currency = original.currency;
  if (original.compare(zero(currency)) <= 0) {
    throw new Error('Obligation original amount must be strictly positive');
  }

  // 1. Calculate net adjustments
  let netAdjustments = zero(currency);
  if (input.adjustments) {
    for (const adjustment of input.adjustments) {
      if (adjustment.amount.currency !== currency || adjustment.amount.compare(zero(currency)) <= 0) {
        throw new Error('Adjustment Money must be positive and match Obligation currency');
      }
      netAdjustments =
        adjustment.direction === 'increase'
          ? netAdjustments.add(adjustment.amount)
          : adjustment.direction === 'decrease'
          ? netAdjustments.subtract(adjustment.amount)
          : (() => {
              throw new Error('Adjustment direction is invalid');
            })();
    }
  }

  // 2. Calculate discounts: gross, revoked, net
  let grossDiscounts = zero(currency);
  if (input.discounts) {
    for (const discount of input.discounts) {
      if (discount.amount.currency !== currency || discount.amount.compare(zero(currency)) <= 0) {
        throw new Error('Discount Money must be positive and match Obligation currency');
      }
      grossDiscounts = grossDiscounts.add(discount.amount);
    }
  }

  let revokedDiscounts = zero(currency);
  if (input.discountRevocations) {
    for (const revocation of input.discountRevocations) {
      if (revocation.amount.currency !== currency || revocation.amount.compare(zero(currency)) <= 0) {
        throw new Error('Discount revocation Money must be positive and match Obligation currency');
      }
      revokedDiscounts = revokedDiscounts.add(revocation.amount);
    }
  }

  if (revokedDiscounts.compare(grossDiscounts) > 0) {
    throw new Error('Revoked discounts cannot exceed gross discounts');
  }

  const netDiscounts = grossDiscounts.subtract(revokedDiscounts);

  // 3. Calculate net covered
  const netCovered = sum(input.allocations, currency).subtract(sum(input.allocationReversals, currency));
  if (netCovered.compare(zero(currency)) < 0) {
    throw new Error('Allocation reversals cannot exceed allocations');
  }

  // 4. Effective due = original + netAdjustments - netDiscounts
  const effectiveDue = original.add(netAdjustments).subtract(netDiscounts);
  if (effectiveDue.compare(netCovered) < 0) {
    throw new Error('Effective obligation due cannot be below covered amount');
  }

  const remainingCoverable = effectiveDue.subtract(netCovered);

  return {
    netAdjustments,
    grossDiscounts,
    revokedDiscounts,
    netDiscounts,
    effectiveDue,
    netCovered,
    remainingCoverable,
  };
}
