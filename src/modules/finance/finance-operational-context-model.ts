import type { MoneyAmount } from './money.ts';

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
  amount: MoneyAmount;
  effectiveAt: string;
  dueAt?: string | null;
  status: string;
  notes?: string | null;
}

export interface FinanceOperationalPayment {
  id: string;
  paymentReference: string;
  amount: MoneyAmount;
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
    };

export interface FinanceOperationalContext {
  financialAccount: FinanceOperationalAccount;
  responsiblePerson: FinanceOperationalResponsiblePerson | null;
  students: FinanceOperationalStudent[];
  openObligations: FinanceOperationalObligation[];
  confirmedUnallocatedPayments: FinanceOperationalPayment[];
  history: FinanceOperationalHistoryItem[];
}
