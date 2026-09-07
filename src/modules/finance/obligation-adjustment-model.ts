import { createCanonicalFinanceFingerprint } from './finance-command.ts';
import { type AdjustmentDirection } from './obligation-financial-position.ts';
import { Money } from './money.ts';

export interface RecordObligationAdjustmentCommand { obligationId: string; direction: AdjustmentDirection; amount: Money; currency: string; reason: string; compensatesAdjustmentId?: string; }
export class ObligationAdjustmentValidationError extends Error { constructor(message: string) { super(message); this.name = 'ObligationAdjustmentValidationError'; } }

export function normalizeRecordObligationAdjustmentCommand(raw: unknown): RecordObligationAdjustmentCommand {
  if (!raw || typeof raw !== 'object') throw new ObligationAdjustmentValidationError('Adjustment command is invalid');
  const value=raw as Record<string,unknown>;
  if (typeof value.obligationId !== 'string' || !value.obligationId.trim()) throw new ObligationAdjustmentValidationError('Obligation is required');
  if (value.direction !== 'increase' && value.direction !== 'decrease') throw new ObligationAdjustmentValidationError('Adjustment direction is invalid');
  if (typeof value.amount !== 'string' || typeof value.currency !== 'string') throw new ObligationAdjustmentValidationError('Adjustment amount must be an exact decimal string with currency');
  const currency=value.currency.trim().toUpperCase(); let amount:Money;
  try { amount=Money.parse(value.amount,currency); } catch { throw new ObligationAdjustmentValidationError('Adjustment amount is invalid'); }
  if(amount.compare(Money.parse('0',currency))<=0) throw new ObligationAdjustmentValidationError('Adjustment amount must be strictly positive');
  if(typeof value.reason !== 'string' || !value.reason.trim() || value.reason.trim().length>500) throw new ObligationAdjustmentValidationError('Adjustment reason is required and must not exceed 500 characters');
  if(value.compensatesAdjustmentId !== undefined && (typeof value.compensatesAdjustmentId !== 'string' || !value.compensatesAdjustmentId.trim())) throw new ObligationAdjustmentValidationError('Compensation Adjustment identifier is invalid');
  return { obligationId:value.obligationId.trim(), direction:value.direction, amount, currency, reason:value.reason.trim(), compensatesAdjustmentId:typeof value.compensatesAdjustmentId==='string'?value.compensatesAdjustmentId.trim():undefined };
}
export function createObligationAdjustmentFingerprint(institutionId:string, command:RecordObligationAdjustmentCommand):string { return createCanonicalFinanceFingerprint({institutionId,operation:'finance.obligation.adjustment',obligationId:command.obligationId,direction:command.direction,money:command.amount.serialize(),reason:command.reason,compensatesAdjustmentId:command.compensatesAdjustmentId??null}); }
