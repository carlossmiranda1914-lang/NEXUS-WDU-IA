import type { Pool, PoolClient } from 'pg';

export type EligibleReceiptSource = Readonly<{
  paymentId: string;
  amount: string;
  currency: string;
  financialProfileVersion: number;
}>;

export type EligibleInvoiceSource = Readonly<{
  obligationId: string;
  amount: string;
  currency: string;
  financialProfileVersion: number;
}>;

export type EligibleInvoiceReceiptSource = Readonly<{ paymentId: string; obligationId: string; allocationId: string }>;

export class FinancialDocumentEligibilityService {
  constructor(private readonly pool: Pick<Pool | PoolClient, 'query'>) {}

  async requireReceipt(institutionId: string, paymentId: string): Promise<EligibleReceiptSource> {
    const result = await this.pool.query<{
      id: string; amount: string; currency: string; financial_profile_version: number;
    }>(
      `SELECT id,amount::text,currency,financial_profile_version
       FROM finance_payments
       WHERE institution_id=$1 AND id=$2 AND status='confirmed'
       FOR UPDATE`,
      [institutionId, paymentId],
    );
    const payment = result.rows[0];
    if (!payment) throw new Error('FINANCIAL_DOCUMENT_RECEIPT_INELIGIBLE');
    return Object.freeze({ paymentId: payment.id, amount: payment.amount, currency: payment.currency, financialProfileVersion: Number(payment.financial_profile_version) });
  }

  async requireInvoice(institutionId: string, obligationId: string): Promise<EligibleInvoiceSource> {
    const result = await this.pool.query<{
      id: string; amount: string; currency: string; financial_profile_version: number;
    }>(
      `SELECT id,amount::text,currency,financial_profile_version
       FROM finance_obligations
       WHERE institution_id=$1 AND id=$2 AND status='open'
       FOR UPDATE`,
      [institutionId, obligationId],
    );
    const obligation = result.rows[0];
    if (!obligation) throw new Error('FINANCIAL_DOCUMENT_INVOICE_INELIGIBLE');
    return Object.freeze({ obligationId: obligation.id, amount: obligation.amount, currency: obligation.currency, financialProfileVersion: Number(obligation.financial_profile_version) });
  }

  async requireInvoiceReceipt(institutionId: string, paymentId: string, obligationId: string): Promise<EligibleInvoiceReceiptSource> {
    const result = await this.pool.query<{ id: string; payment_id: string; obligation_id: string }>(
      `SELECT a.id,a.payment_id,a.obligation_id
       FROM finance_allocations a
       INNER JOIN finance_payments p ON p.institution_id=a.institution_id AND p.id=a.payment_id AND p.status='confirmed'
       INNER JOIN finance_obligations o ON o.institution_id=a.institution_id AND o.id=a.obligation_id AND o.status='open'
       WHERE a.institution_id=$1 AND a.payment_id=$2 AND a.obligation_id=$3
       FOR UPDATE OF a,p,o`,
      [institutionId, paymentId, obligationId],
    );
    const allocation = result.rows[0];
    if (!allocation) throw new Error('FINANCIAL_DOCUMENT_INVOICE_RECEIPT_INELIGIBLE');
    return Object.freeze({ allocationId: allocation.id, paymentId: allocation.payment_id, obligationId: allocation.obligation_id });
  }
}
