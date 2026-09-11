import { Money } from './money.ts';

export type JournalStatus = 'prepared' | 'confirmed';
export type FoundationJournalType = 'foundation_value_received' | 'foundation_reversal';
export type AllocationJournalType = 'payment_allocation' | 'allocation_reversal';
export type ObligationAdjustmentJournalType = 'obligation_adjustment';
export type DiscountJournalType = 'obligation_discount';
export type JournalTransactionType = FoundationJournalType | AllocationJournalType | ObligationAdjustmentJournalType | DiscountJournalType;
export type FoundationPositionType = 'received_value' | 'reversed_value';
export type AllocationPositionType = 'allocated_value' | 'released_value';
export type ObligationAdjustmentPositionType = 'obligation_due_increased' | 'obligation_due_decreased';
export type DiscountPositionType = 'obligation_discount_applied' | 'obligation_discount_revoked';
export type JournalPositionType = FoundationPositionType | AllocationPositionType | ObligationAdjustmentPositionType | DiscountPositionType;
export interface JournalEntryDraft { positionType: JournalPositionType; money: Money; sourceRef: string; }
export interface ConfirmJournalInput {
  institutionId: string;
  commandId: string;
  journalType: JournalTransactionType;
  effectiveAt: Date;
  entries: readonly JournalEntryDraft[];
  reversesTransactionId?: string;
  reason?: string;
  actorKind?: 'human' | 'system' | 'provider';
  actorPersonId?: string;
  financialProfileVersion: number;
}
export interface ReverseFoundationTransactionInput { institutionId: string; originalTransactionId: string; amount: Money; reason: string; actorPersonId: string; effectiveAt: Date; financialProfileVersion: number; }
export interface JournalRepository { confirm(client: import('pg').PoolClient, input: ConfirmJournalInput): Promise<{ transactionId: string }>; getConfirmed(institutionId: string, transactionId: string): Promise<unknown | null>; }

const VALID_POSITIONS: readonly string[] = [
  'received_value',
  'reversed_value',
  'allocated_value',
  'released_value',
  'obligation_due_increased',
  'obligation_due_decreased',
  'obligation_discount_applied',
  'obligation_discount_revoked',
];

export function validateConfirmation(input: ConfirmJournalInput): { currency: string; amount: Money } {
  const actorKind = input.actorKind ?? 'human';
  if (actorKind === 'human' && !input.actorPersonId) throw new Error('Journal provenance is invalid');
  if (actorKind !== 'human' && input.actorPersonId) throw new Error('Journal provenance is invalid: system/provider actor must not specify actorPersonId');
  if (!input.commandId || !Number.isInteger(input.financialProfileVersion) || input.financialProfileVersion <= 0) throw new Error('Journal provenance is invalid');
  if (!(input.effectiveAt instanceof Date) || Number.isNaN(input.effectiveAt.getTime()) || input.entries.length === 0) throw new Error('Journal confirmation is invalid');
  const first = input.entries[0];
  if (!VALID_POSITIONS.includes(first.positionType) || !first.sourceRef) throw new Error('Journal entry is invalid');
  const requiredPosition: JournalPositionType = ({ foundation_value_received: 'received_value', foundation_reversal: 'reversed_value', payment_allocation: 'allocated_value', allocation_reversal: 'released_value' } as const)[input.journalType] ?? first.positionType;
  if (input.journalType === 'obligation_adjustment' && !['obligation_due_increased','obligation_due_decreased'].includes(first.positionType)) throw new Error('Journal type and entry position are incompatible');
  if (input.journalType === 'obligation_discount' && !['obligation_discount_applied','obligation_discount_revoked'].includes(first.positionType)) throw new Error('Journal type and entry position are incompatible');
  if (first.positionType !== requiredPosition) throw new Error('Journal type and entry position are incompatible');
  let amount = first.money;
  for (const entry of input.entries) {
    if (!VALID_POSITIONS.includes(entry.positionType) || !entry.sourceRef || entry.money.currency !== first.money.currency) throw new Error('Journal entries require one currency and typed positions');
    if (entry.positionType !== requiredPosition) throw new Error('Journal type and entry position are incompatible');
    if (entry.money.compare(Money.parse('0', entry.money.currency)) <= 0) throw new Error('Journal entry Money must be strictly positive');
  }
  for (const entry of input.entries.slice(1)) amount = amount.add(entry.money);
  return { currency: first.money.currency, amount };
}
