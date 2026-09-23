export interface FinanceMoneyAmount {
  amount: string;
  currency: string;
}

export interface FinanceOperationalAccount {
  id: string;
  accountNumber: string;
  name: string;
  status: string;
}

export interface FinanceOperationalResponsiblePerson {
  personId: string;
  displayName: string;
  role?: string;
}

export interface FinanceOperationalStudent {
  studentId?: string;
  personId: string;
  displayName: string;
  enrollmentId?: string;
  enrollmentStatus?: string;
}

export interface FinanceOperationalObligation {
  id: string;
  description: string;
  feeItemCode?: string;
  feeItemName?: string;
  amount: FinanceMoneyAmount;
  /** Immutable issued value, repeated under the allocation projection vocabulary. */
  original?: FinanceMoneyAmount;
  netAdjustments?: FinanceMoneyAmount;
  netDiscounts?: FinanceMoneyAmount;
  effectiveDue?: FinanceMoneyAmount;
  covered?: FinanceMoneyAmount;
  uncovered?: FinanceMoneyAmount;
  remainingCoverable?: FinanceMoneyAmount;
  coveragePosition?: 'open' | 'partially_covered' | 'covered';
  activeDiscount?: {
    id: string;
    policyId: string;
    policyCode: string;
    policyName: string;
    amount: FinanceMoneyAmount;
    appliedAt: string;
    reason: string;
  } | null;
  effectiveAt: string;
  dueAt?: string | null;
  status: string;
  notes?: string | null;
}

export interface FinanceOperationalPayment {
  id: string;
  paymentReference: string;
  amount: FinanceMoneyAmount;
  /** Immutable confirmed receipt, repeated under the allocation projection vocabulary. */
  received?: FinanceMoneyAmount;
  allocated?: FinanceMoneyAmount;
  unapplied?: FinanceMoneyAmount;
  allocationPosition?: 'unapplied' | 'partially_allocated' | 'fully_allocated';
  method: string;
  effectiveAt: string;
  payerPersonId?: string;
  payerPersonName?: string;
  status: string;
  allocationStatus: string;
}

export type FinanceOperationalHistoryItem =
  | {
      kind: 'obligation';
      id: string;
      occurredAt: string;
      obligation: FinanceOperationalObligation;
    }
  | {
      kind: 'payment';
      id: string;
      occurredAt: string;
      payment: FinanceOperationalPayment;
    }
  | {
      kind: 'allocation';
      id: string;
      occurredAt: string;
      allocation: {
        id: string;
        paymentId: string;
        obligationId: string;
        amount: FinanceMoneyAmount;
        effectiveAt: string;
        reversals: Array<{
          id: string;
          amount: FinanceMoneyAmount;
          reason: string;
          effectiveAt: string;
          occurredAt: string;
        }>;
      };
    }
  | {
      kind: 'adjustment';
      id: string;
      occurredAt: string;
      adjustment: {
        obligationId: string;
        obligationDescription: string;
        direction: 'increase' | 'decrease';
        amount: FinanceMoneyAmount;
        reason: string;
        basisType: 'general' | 'debit_event';
        compensatesAdjustmentId?: string;
      };
    }
  | {
      kind: 'discount_applied';
      id: string;
      occurredAt: string;
      discount: {
        discountId: string;
        obligationId: string;
        obligationDescription?: string;
        policyCode: string;
        policyName: string;
        amount: FinanceMoneyAmount;
        reason: string;
        appliedAt: string;
        actorName?: string;
      };
    }
  | {
      kind: 'discount_revoked';
      id: string;
      occurredAt: string;
      revocation: {
        revocationId: string;
        originalDiscountId: string;
        obligationId: string;
        obligationDescription?: string;
        amount: FinanceMoneyAmount;
        reason: string;
        revokedAt: string;
        actorName?: string;
      };
    };

export interface FinanceOperationalContext {
  financialAccount: FinanceOperationalAccount;
  responsiblePerson: FinanceOperationalResponsiblePerson | null;
  students: FinanceOperationalStudent[];
  openObligations: FinanceOperationalObligation[];
  confirmedUnallocatedPayments: FinanceOperationalPayment[];
  history: FinanceOperationalHistoryItem[];
}
