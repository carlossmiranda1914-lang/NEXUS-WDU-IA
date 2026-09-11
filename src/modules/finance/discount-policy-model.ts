export type DiscountPolicyStatus = 'active' | 'archived';
export type DiscountCalculationMode = 'percentage' | 'fixed_amount';

export interface DiscountPolicy {
  readonly id: string;
  readonly institutionId: string;
  readonly code: string;
  readonly status: DiscountPolicyStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DiscountPolicyVersion {
  readonly id: string;
  readonly institutionId: string;
  readonly policyId: string;
  readonly version: number;
  readonly name: string;
  readonly description: string | null;
  readonly calculationMode: DiscountCalculationMode;
  readonly value: string; // Exact decimal string representation
  readonly currency: string | null; // Required for fixed_amount, NULL for percentage
  readonly effectiveFrom: Date | null;
  readonly effectiveTo: Date | null;
  readonly createdAt: Date;
  readonly actorPersonId: string | null;
}

export interface CreateDiscountPolicyInput {
  readonly code: string;
  readonly name: string;
  readonly description?: string | null;
  readonly calculationMode: DiscountCalculationMode;
  readonly value: string;
  readonly currency?: string | null;
  readonly effectiveFrom?: Date | string | null;
  readonly effectiveTo?: Date | string | null;
}

export interface CreateDiscountPolicyVersionInput {
  readonly name: string;
  readonly description?: string | null;
  readonly calculationMode: DiscountCalculationMode;
  readonly value: string;
  readonly currency?: string | null;
  readonly effectiveFrom?: Date | string | null;
  readonly effectiveTo?: Date | string | null;
}

export interface DiscountPolicySummary extends DiscountPolicy {
  readonly latestVersion: DiscountPolicyVersion;
  readonly currentApplicableVersion: DiscountPolicyVersion | null;
}

export function validateDiscountPolicyInputs(
  calculationMode: DiscountCalculationMode,
  valueStr: string,
  currency: string | null | undefined,
  effectiveFrom?: Date | null,
  effectiveTo?: Date | null
): { value: string; currency: string | null } {
  const num = Number(valueStr);
  if (isNaN(num) || num <= 0) {
    throw new Error('Discount policy value must be a strictly positive number');
  }

  if (calculationMode === 'percentage') {
    if (num > 100) {
      throw new Error('Discount policy percentage rate cannot exceed 100%');
    }
    if (currency) {
      throw new Error('Discount policy in percentage mode cannot specify currency');
    }
    return { value: valueStr.trim(), currency: null };
  } else if (calculationMode === 'fixed_amount') {
    if (!currency || currency.trim().length !== 3) {
      throw new Error('Discount policy in fixed_amount mode requires a 3-letter currency code');
    }
    return { value: valueStr.trim(), currency: currency.trim().toUpperCase() };
  } else {
    throw new Error(`Invalid calculation mode: ${calculationMode}`);
  }
}
