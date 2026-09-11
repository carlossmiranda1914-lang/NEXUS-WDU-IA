import type { Pool, PoolClient } from 'pg';
import { FiscalAdapterRegistry, type FiscalAdapter } from './fiscal-adapter-registry.ts';

export const documentaryEligibilityReasonCodes = new Set(['SOURCE_NOT_ELIGIBLE', 'FISCAL_CONFIGURATION_NOT_EFFECTIVE', 'FINANCIAL_PROFILE_NOT_FOUND', 'FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION', 'FISCAL_CONFIGURATION_ADAPTER_MISMATCH', 'DOCUMENT_TYPE_UNSUPPORTED', 'RECEIPT_SERIES_NOT_EFFECTIVE']);
export const canonicalDocumentaryEligibilityReason = (error: unknown) => {
  const code = error instanceof Error ? error.message : '';
  return documentaryEligibilityReasonCodes.has(code) ? code : 'FINANCIAL_DOCUMENT_VALIDATION';
};

export type ReceiptEligibility = Readonly<{ eligible: true; payment: { id: string; amount: string; currency: string; paymentReference: string; effectiveAt: Date; journalTransactionId: string; financialProfileVersion: number }; fiscalConfiguration: { id: string; adapterKey: string }; adapter: FiscalAdapter; series: { nextSequenceNumber: number } }> | Readonly<{ eligible: false; reasonCode: string }>;

export async function resolveReceiptEligibility(pool: Pick<Pool | PoolClient, 'query'>, fiscalAdapters: FiscalAdapterRegistry, input: { institutionId: string; paymentId: string; seriesId: string; documentType: string; lock?: boolean }): Promise<ReceiptEligibility> {
  const lock = input.lock ? ' FOR UPDATE' : '';
  const payment = await pool.query<{ id:string;amount:string;currency:string;payment_reference:string;effective_at:Date;journal_transaction_id:string;financial_profile_version:number }>(`SELECT id,amount::text,currency,payment_reference,effective_at,journal_transaction_id,financial_profile_version FROM finance_payments WHERE institution_id=$1 AND id=$2 AND status='confirmed'${lock}`, [input.institutionId,input.paymentId]);
  const row=payment.rows[0]; if(!row)return {eligible:false,reasonCode:'SOURCE_NOT_ELIGIBLE'};
  const fiscal=await pool.query<{id:string;adapter_key:string}>(`SELECT id,adapter_key FROM finance_fiscal_configuration_versions WHERE institution_id=$1 AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY version DESC LIMIT 1${input.lock ? ' FOR SHARE' : ''}`,[input.institutionId]); if(!fiscal.rows[0])return {eligible:false,reasonCode:'FISCAL_CONFIGURATION_NOT_EFFECTIVE'};
  const profile=await pool.query<{primary_jurisdiction:string}>('SELECT primary_jurisdiction FROM finance_profile_versions WHERE institution_id=$1 AND version=$2',[input.institutionId,row.financial_profile_version]); if(!profile.rows[0])return {eligible:false,reasonCode:'FINANCIAL_PROFILE_NOT_FOUND'};
  let adapter:FiscalAdapter; try { adapter=fiscalAdapters.select({primaryJurisdiction:profile.rows[0].primary_jurisdiction},{adapterKey:fiscal.rows[0].adapter_key}); } catch(error){return {eligible:false,reasonCode:canonicalDocumentaryEligibilityReason(error)};}
  if(!adapter.policy.supportedDocumentTypes.includes(input.documentType))return {eligible:false,reasonCode:'DOCUMENT_TYPE_UNSUPPORTED'};
  const series=await pool.query<{next_sequence_number:string}>(`SELECT next_sequence_number FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2 AND document_type=$3 AND status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())${lock}`,[input.institutionId,input.seriesId,input.documentType]); if(!series.rows[0])return {eligible:false,reasonCode:'RECEIPT_SERIES_NOT_EFFECTIVE'};
  return {eligible:true,payment:{id:row.id,amount:row.amount,currency:row.currency,paymentReference:row.payment_reference,effectiveAt:row.effective_at,journalTransactionId:row.journal_transaction_id,financialProfileVersion:row.financial_profile_version},fiscalConfiguration:{id:fiscal.rows[0].id,adapterKey:fiscal.rows[0].adapter_key},adapter,series:{nextSequenceNumber:Number(series.rows[0].next_sequence_number)}};
}

export class FinancialDocumentEligibilityService {
  constructor(private readonly pool: Pick<Pool | PoolClient, 'query'>, private readonly fiscalAdapters: FiscalAdapterRegistry) {}
  receipt(input: { institutionId: string; paymentId: string; seriesId: string; documentType?: string }) { return resolveReceiptEligibility(this.pool, this.fiscalAdapters, { ...input, documentType: input.documentType ?? 'receipt' }); }
  async requireReceipt(institutionId: string, paymentId: string) { const r=await this.pool.query('SELECT id FROM finance_payments WHERE institution_id=$1 AND id=$2 AND status=\'confirmed\'',[institutionId,paymentId]); if(!r.rows[0])throw new Error('FINANCIAL_DOCUMENT_RECEIPT_INELIGIBLE'); return {paymentId}; }
  async requireInvoice(institutionId: string, obligationId: string) { const r=await this.pool.query("SELECT id FROM finance_obligations WHERE institution_id=$1 AND id=$2 AND status='open'",[institutionId,obligationId]); if(!r.rows[0])throw new Error('FINANCIAL_DOCUMENT_INVOICE_INELIGIBLE'); return {obligationId}; }
  async requireInvoiceReceipt(institutionId: string, paymentId: string, obligationId: string) { const r=await this.pool.query("SELECT 1 FROM finance_allocations a WHERE a.institution_id=$1 AND a.payment_id=$2 AND a.obligation_id=$3 AND NOT EXISTS (SELECT 1 FROM finance_allocation_reversals r WHERE r.institution_id=a.institution_id AND r.original_allocation_id=a.id)",[institutionId,paymentId,obligationId]); if(!r.rows[0])throw new Error('FINANCIAL_DOCUMENT_INVOICE_RECEIPT_INELIGIBLE'); return {paymentId,obligationId}; }
  private async require(input: { institutionId: string; paymentId: string; seriesId: string }, documentType: string) { const result = await resolveReceiptEligibility(this.pool, this.fiscalAdapters, { ...input, documentType }); if (result.eligible === false) throw new Error(result.reasonCode); return result; }
}
