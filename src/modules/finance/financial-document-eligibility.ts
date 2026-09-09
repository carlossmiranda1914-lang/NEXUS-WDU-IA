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
}
