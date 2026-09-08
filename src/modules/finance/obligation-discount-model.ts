import { Money } from './money.ts';
import { DiscountCalculationMode } from './discount-policy-model.ts';

export interface ObligationDiscount {
  readonly id: string;
  readonly institutionId: string;
  readonly financialAccountId: string;
  readonly obligationId: string;
  readonly policyId: string;
  readonly policyVersionId: string;
  readonly policyCode: string;
  readonly policyName: string;
  readonly policyVersion: number;
  readonly calculationMode: DiscountCalculationMode;
  readonly policyValue: string;
  readonly amount: Money;
  readonly currency: string;
  readonly reason: string;
  readonly journalTransactionId: string;
  readonly appliedAt: Date;
  readonly actorPersonId: string | null;
}

export interface ObligationDiscountRevocation {
  readonly id: string;
  readonly institutionId: string;
  readonly financialAccountId: string;
  readonly obligationId: string;
  readonly originalDiscountId: string;
  readonly amount: Money;
  readonly currency: string;
  readonly reason: string;
  readonly journalTransactionId: string;
  readonly revokedAt: Date;
  readonly actorPersonId: string | null;
}

export interface ApplyObligationDiscountInput {
  readonly obligationId: string;
  readonly discountPolicyId?: string;
  readonly discountPolicyVersionId?: string;
  readonly reason: string;
}

export interface RevokeObligationDiscountInput {
  readonly obligationId: string;
  readonly discountId: string;
  readonly reason: string;
}
