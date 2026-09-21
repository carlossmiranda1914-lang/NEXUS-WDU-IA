import type { Pool, PoolClient } from 'pg';
import { FiscalAdapterRegistry, type FiscalAdapter } from './fiscal-adapter-registry.ts';
import { resolveInvoiceBillableSource, type InvoiceBillableSource } from './invoice-billable-source.ts';

export const documentaryEligibilityReasonCodes = new Set(['SOURCE_NOT_ELIGIBLE', 'INVOICE_SOURCE_NOT_ELIGIBLE', 'INVOICE_DUE_DATE_REQUIRED', 'INVOICE_BILLABLE_AMOUNT_INVALID', 'INVOICE_CURRENCY_MISMATCH', 'FISCAL_CONFIGURATION_NOT_EFFECTIVE', 'FINANCIAL_PROFILE_NOT_FOUND', 'FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION', 'FISCAL_CONFIGURATION_ADAPTER_MISMATCH', 'DOCUMENT_TYPE_UNSUPPORTED', 'RECEIPT_SERIES_NOT_EFFECTIVE', 'INVOICE_SERIES_NOT_EFFECTIVE', 'INSTITUTION_LEGAL_PROFILE_REQUIRED', 'DOCUMENT_RECIPIENT_REQUIRED', 'DOCUMENT_PARTY_SOURCE_NOT_FOUND', 'DOCUMENT_PARTY_NOT_FOUND']);
export const canonicalDocumentaryEligibilityReason = (error: unknown) => {
  const code = error instanceof Error ? error.message : '';
  return documentaryEligibilityReasonCodes.has(code) ? code : 'FINANCIAL_DOCUMENT_VALIDATION';
};

export type ReceiptEligibility = Readonly<{ eligible: true; payment: { id: string; amount: string; currency: string; paymentReference: string; effectiveAt: Date; method: string; journalTransactionId: string; financialProfileVersion: number; financialAccountId: string | null; payerPersonId: string | null }; fiscalConfiguration: { id: string; version: number; adapterKey: string }; adapter: FiscalAdapter; series: { nextSequenceNumber: number } }> | Readonly<{ eligible: false; reasonCode: string }>;
export type InvoiceEligibility = Readonly<{ eligible: true; obligation: InvoiceBillableSource; fiscalConfiguration: { id: string; version: number; adapterKey: string }; adapter: FiscalAdapter; series: { nextSequenceNumber: number } }> | Readonly<{ eligible: false; reasonCode: string }>;

export async function resolveReceiptEligibility(pool: Pick<Pool | PoolClient, 'query'>, fiscalAdapters: FiscalAdapterRegistry, input: { institutionId: string; paymentId: string; seriesId: string; documentType: string; lock?: boolean }): Promise<ReceiptEligibility> {
  const lock = input.lock ? ' FOR UPDATE' : '';
  const payment = await pool.query<{ id:string;amount:string;currency:string;payment_reference:string;effective_at:Date;method:string;journal_transaction_id:string;financial_profile_version:number;financial_account_id:string|null;payer_person_id:string|null }>(`SELECT id,amount::text,currency,payment_reference,effective_at,method,journal_transaction_id,financial_profile_version,financial_account_id,payer_person_id FROM finance_payments WHERE institution_id=$1 AND id=$2 AND status='confirmed'${lock}`, [input.institutionId,input.paymentId]);
  const row=payment.rows[0]; if(!row)return {eligible:false,reasonCode:'SOURCE_NOT_ELIGIBLE'};
  const fiscal=await pool.query<{id:string;version:number;adapter_key:string}>(`SELECT id,version,adapter_key FROM finance_fiscal_configuration_versions WHERE institution_id=$1 AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY version DESC LIMIT 1${input.lock ? ' FOR SHARE' : ''}`,[input.institutionId]); if(!fiscal.rows[0])return {eligible:false,reasonCode:'FISCAL_CONFIGURATION_NOT_EFFECTIVE'};
  const profile=await pool.query<{primary_jurisdiction:string}>('SELECT primary_jurisdiction FROM finance_profile_versions WHERE institution_id=$1 AND version=$2',[input.institutionId,row.financial_profile_version]); if(!profile.rows[0])return {eligible:false,reasonCode:'FINANCIAL_PROFILE_NOT_FOUND'};
  let adapter:FiscalAdapter; try { adapter=fiscalAdapters.select({primaryJurisdiction:profile.rows[0].primary_jurisdiction},{adapterKey:fiscal.rows[0].adapter_key}); } catch(error){return {eligible:false,reasonCode:canonicalDocumentaryEligibilityReason(error)};}
  if(!adapter.policy.supportedDocumentTypes.includes(input.documentType))return {eligible:false,reasonCode:'DOCUMENT_TYPE_UNSUPPORTED'};
  const series=await pool.query<{next_sequence_number:string}>(`SELECT next_sequence_number FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2 AND document_type=$3 AND status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())${lock}`,[input.institutionId,input.seriesId,input.documentType]); if(!series.rows[0])return {eligible:false,reasonCode:'RECEIPT_SERIES_NOT_EFFECTIVE'};
  return {eligible:true,payment:{id:row.id,amount:row.amount,currency:row.currency,paymentReference:row.payment_reference,effectiveAt:row.effective_at,method:row.method,journalTransactionId:row.journal_transaction_id,financialProfileVersion:row.financial_profile_version,financialAccountId:row.financial_account_id,payerPersonId:row.payer_person_id},fiscalConfiguration:{id:fiscal.rows[0].id,version:fiscal.rows[0].version,adapterKey:fiscal.rows[0].adapter_key},adapter,series:{nextSequenceNumber:Number(series.rows[0].next_sequence_number)}};
}

/** Invoice eligibility stays source-specific; it never reuses payment semantics. */
export async function resolveInvoiceEligibility(pool: Pick<Pool | PoolClient, 'query'>, fiscalAdapters: FiscalAdapterRegistry, input: { institutionId: string; obligationId: string; seriesId: string; documentType: 'invoice'; at: Date; lock?: boolean }): Promise<InvoiceEligibility> {
  let obligation: InvoiceBillableSource;
  try { obligation = await resolveInvoiceBillableSource(pool, { institutionId: input.institutionId, obligationId: input.obligationId, at: input.at, lock: input.lock }); }
  catch (error) { return { eligible: false, reasonCode: canonicalDocumentaryEligibilityReason(error) }; }
  const fiscal = await pool.query<{ id: string; version: number; adapter_key: string }>(`SELECT id,version,adapter_key FROM finance_fiscal_configuration_versions WHERE institution_id=$1 AND effective_from<=$2 AND (effective_to IS NULL OR effective_to>$2) ORDER BY version DESC LIMIT 1${input.lock ? ' FOR SHARE' : ''}`, [input.institutionId, input.at]);
  if (!fiscal.rows[0]) return { eligible: false, reasonCode: 'FISCAL_CONFIGURATION_NOT_EFFECTIVE' };
  const profile = await pool.query<{ primary_jurisdiction: string }>('SELECT primary_jurisdiction FROM finance_profile_versions WHERE institution_id=$1 AND version=$2', [input.institutionId, obligation.financialProfileVersion]);
  if (!profile.rows[0]) return { eligible: false, reasonCode: 'FINANCIAL_PROFILE_NOT_FOUND' };
  let adapter: FiscalAdapter;
  try { adapter = fiscalAdapters.select({ primaryJurisdiction: profile.rows[0].primary_jurisdiction }, { adapterKey: fiscal.rows[0].adapter_key }); }
  catch (error) { return { eligible: false, reasonCode: canonicalDocumentaryEligibilityReason(error) }; }
  if (!adapter.policy.supportedDocumentTypes.includes('invoice')) return { eligible: false, reasonCode: 'DOCUMENT_TYPE_UNSUPPORTED' };
  const series = await pool.query<{ next_sequence_number: string }>(`SELECT next_sequence_number FROM finance_financial_document_series WHERE institution_id=$1 AND id=$2 AND document_type='invoice' AND status='active' AND effective_from<=$3 AND (effective_to IS NULL OR effective_to>$3)${input.lock ? ' FOR UPDATE' : ''}`, [input.institutionId, input.seriesId, input.at]);
  if (!series.rows[0]) return { eligible: false, reasonCode: 'INVOICE_SERIES_NOT_EFFECTIVE' };
  return { eligible: true, obligation, fiscalConfiguration: { id: fiscal.rows[0].id, version: fiscal.rows[0].version, adapterKey: fiscal.rows[0].adapter_key }, adapter, series: { nextSequenceNumber: Number(series.rows[0].next_sequence_number) } };
}

export class FinancialDocumentEligibilityService {
  constructor(private readonly pool: Pick<Pool | PoolClient, 'query'>, private readonly fiscalAdapters: FiscalAdapterRegistry) {}
  receipt(input: { institutionId: string; paymentId: string; seriesId: string; documentType?: string }) { return resolveReceiptEligibility(this.pool, this.fiscalAdapters, { ...input, documentType: input.documentType ?? 'receipt' }); }
  invoice(input: { institutionId: string; obligationId: string; seriesId: string; at?: Date }) { return resolveInvoiceEligibility(this.pool, this.fiscalAdapters, { ...input, documentType: 'invoice', at: input.at ?? new Date() }); }
  async requireReceipt(institutionId: string, paymentId: string) { const r=await this.pool.query('SELECT id FROM finance_payments WHERE institution_id=$1 AND id=$2 AND status=\'confirmed\'',[institutionId,paymentId]); if(!r.rows[0])throw new Error('FINANCIAL_DOCUMENT_RECEIPT_INELIGIBLE'); return {paymentId}; }
  async requireInvoice(institutionId: string, obligationId: string) { const r=await this.pool.query("SELECT id FROM finance_obligations WHERE institution_id=$1 AND id=$2 AND status='open'",[institutionId,obligationId]); if(!r.rows[0])throw new Error('FINANCIAL_DOCUMENT_INVOICE_INELIGIBLE'); return {obligationId}; }
  async requireInvoiceReceipt(institutionId: string, paymentId: string, obligationId: string) { const r=await this.pool.query("SELECT 1 FROM finance_allocations a WHERE a.institution_id=$1 AND a.payment_id=$2 AND a.obligation_id=$3 AND NOT EXISTS (SELECT 1 FROM finance_allocation_reversals r WHERE r.institution_id=a.institution_id AND r.original_allocation_id=a.id)",[institutionId,paymentId,obligationId]); if(!r.rows[0])throw new Error('FINANCIAL_DOCUMENT_INVOICE_RECEIPT_INELIGIBLE'); return {paymentId,obligationId}; }
  private async require(input: { institutionId: string; paymentId: string; seriesId: string }, documentType: string) { const result = await resolveReceiptEligibility(this.pool, this.fiscalAdapters, { ...input, documentType }); if (result.eligible === false) throw new Error(result.reasonCode); return result; }
}
