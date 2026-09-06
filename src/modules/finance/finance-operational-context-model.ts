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
  covered?: FinanceMoneyAmount;
  uncovered?: FinanceMoneyAmount;
  coveragePosition?: 'open' | 'partially_covered' | 'covered';
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
    };

export interface FinanceOperationalContext {
  financialAccount: FinanceOperationalAccount;
  responsiblePerson: FinanceOperationalResponsiblePerson | null;
  students: FinanceOperationalStudent[];
  openObligations: FinanceOperationalObligation[];
  confirmedUnallocatedPayments: FinanceOperationalPayment[];
  history: FinanceOperationalHistoryItem[];
}
