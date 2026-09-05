import { Money } from './money.ts';

export type JournalStatus = 'prepared' | 'confirmed';
export type FoundationJournalType = 'foundation_value_received' | 'foundation_reversal';
export type FoundationPositionType = 'received_value' | 'reversed_value';
export interface JournalEntryDraft { positionType: FoundationPositionType; money: Money; sourceRef: string; }
export interface ConfirmJournalInput {
  institutionId: string;
  commandId: string;
  journalType: FoundationJournalType;
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

export function validateConfirmation(input: ConfirmJournalInput): { currency: string; amount: Money } {
  const actorKind = input.actorKind ?? 'human';
  if (actorKind === 'human' && !input.actorPersonId) throw new Error('Journal provenance is invalid');
  if (actorKind !== 'human' && input.actorPersonId) throw new Error('Journal provenance is invalid: system/provider actor must not specify actorPersonId');
  if (!input.commandId || !Number.isInteger(input.financialProfileVersion) || input.financialProfileVersion <= 0) throw new Error('Journal provenance is invalid');
  if (!(input.effectiveAt instanceof Date) || Number.isNaN(input.effectiveAt.getTime()) || input.entries.length === 0) throw new Error('Journal confirmation is invalid');
  const first = input.entries[0];
  if (!['received_value', 'reversed_value'].includes(first.positionType) || !first.sourceRef) throw new Error('Journal entry is invalid');
  const requiredPosition = input.journalType === 'foundation_value_received' ? 'received_value' : 'reversed_value';
  if (first.positionType !== requiredPosition) throw new Error('Journal type and entry position are incompatible');
  let amount = first.money;
  for (const entry of input.entries) {
    if (!['received_value', 'reversed_value'].includes(entry.positionType) || !entry.sourceRef || entry.money.currency !== first.money.currency) throw new Error('Journal entries require one currency and typed positions');
    if (entry.positionType !== requiredPosition) throw new Error('Journal type and entry position are incompatible');
    if (entry.money.compare(Money.parse('0', entry.money.currency)) <= 0) throw new Error('Journal entry Money must be strictly positive');
  }
  for (const entry of input.entries.slice(1)) amount = amount.add(entry.money);
  return { currency: first.money.currency, amount };
}
