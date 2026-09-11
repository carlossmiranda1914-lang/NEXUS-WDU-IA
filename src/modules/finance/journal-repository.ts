import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { type ConfirmJournalInput, type JournalRepository, type ReverseFoundationTransactionInput, validateConfirmation } from './journal-model.ts';
import { Money } from './money.ts';

export type JournalFailurePoint = 'after_transaction' | 'after_entries' | 'after_audit' | 'after_outbox';

export class PostgresJournalRepository implements JournalRepository {
  constructor(private readonly readClient: PoolClient, private readonly failurePoint?: JournalFailurePoint) {}
  async confirm(client: PoolClient, input: ConfirmJournalInput): Promise<{ transactionId: string }> {
    void client; void input;
    throw new Error('Journal confirmation must execute through the canonical idempotent command boundary');
  }
  async confirmInTransaction(client: PoolClient, input: ConfirmJournalInput): Promise<{ transactionId: string }> {
    if (input.journalType === 'foundation_reversal') throw new Error('Foundation reversal confirmation is guarded by executeFoundationReversal');
    return this.persistConfirmed(client, input);
  }
  private async persistConfirmed(client: PoolClient, input: ConfirmJournalInput): Promise<{ transactionId: string }> {
    const validated = validateConfirmation(input); const transactionId = randomUUID();
    const actorKind = input.actorKind ?? 'human';
    await client.query(`INSERT INTO finance_journal_transactions (id,institution_id,status,currency,amount,command_id,journal_type,actor_kind,actor_person_id,financial_profile_version,effective_at,confirmed_at,reverses_transaction_id,reason) VALUES ($1,$2,'confirmed',$3,$4,$5,$6,$7,$8,$9,$10,now(),$11,$12)`, [transactionId,input.institutionId,validated.currency,validated.amount.canonicalAmount(),input.commandId,input.journalType,actorKind,input.actorPersonId ?? null,input.financialProfileVersion,input.effectiveAt,input.reversesTransactionId ?? null,input.reason ?? null]);
      this.fail('after_transaction');
      for (const entry of input.entries) await client.query(`INSERT INTO finance_journal_entries (institution_id,transaction_id,currency,amount,position_type,source_ref) VALUES ($1,$2,$3,$4,$5,$6)`, [input.institutionId,transactionId,entry.money.currency,entry.money.canonicalAmount(),entry.positionType,entry.sourceRef]);
      this.fail('after_entries');
      await client.query(`INSERT INTO finance_audit_records (institution_id,transaction_id,event_type,metadata) VALUES ($1,$2,'JOURNAL_CONFIRMED','{}')`, [input.institutionId,transactionId]);
      this.fail('after_audit');
      await client.query(`INSERT INTO finance_outbox (institution_id,transaction_id,topic,aggregate_id,payload) VALUES ($1,$2,'finance.journal.confirmed',$2,'{}')`, [input.institutionId,transactionId]);
      this.fail('after_outbox');
      return { transactionId };
  }
  async reverseInTransaction(client: PoolClient, input: ReverseFoundationTransactionInput, commandId: string): Promise<{ transactionId: string }> {
    if (!input.reason.trim() || input.amount.compare(Money.parse('0', input.amount.currency)) <= 0) throw new Error('Reversal amount and reason are required');
    const original = await client.query<{ status: string; currency: string; amount: string; journal_type: string }>(`SELECT status,currency,amount::text,journal_type FROM finance_journal_transactions WHERE institution_id=$1 AND id=$2 FOR UPDATE`, [input.institutionId, input.originalTransactionId]);
    const row = original.rows[0]; if (!row || row.status !== 'confirmed' || row.journal_type === 'foundation_reversal') throw new Error('Original eligible transaction is required; reversal target is not eligible');
    if (row.currency !== input.amount.currency) throw new Error('Reversal currency must match original');
    const reversed = await client.query<{ amount: string }>(`SELECT coalesce(sum(amount),0)::text amount FROM finance_journal_transactions WHERE institution_id=$1 AND reverses_transaction_id=$2 AND status='confirmed' AND journal_type='foundation_reversal'`, [input.institutionId, input.originalTransactionId]);
    const remaining = Money.parse(row.amount, row.currency).subtract(Money.parse(reversed.rows[0].amount, row.currency));
    if (input.amount.compare(remaining) > 0) throw new Error('Reversal exceeds remaining reversible amount');
    return this.persistConfirmed(client, { institutionId: input.institutionId, commandId, journalType: 'foundation_reversal', effectiveAt: input.effectiveAt, entries: [{ positionType: 'reversed_value', money: input.amount, sourceRef: input.originalTransactionId }], reversesTransactionId: input.originalTransactionId, reason: input.reason, actorPersonId: input.actorPersonId, financialProfileVersion: input.financialProfileVersion });
  }
  async getConfirmed(institutionId: string, transactionId: string): Promise<unknown | null> {
    const result = await this.readClient.query(`SELECT id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,reason FROM finance_journal_transactions WHERE institution_id=$1 AND id=$2 AND status='confirmed'`, [institutionId, transactionId]);
    return result.rows[0] ?? null;
  }
  private fail(point: JournalFailurePoint) { if (this.failurePoint === point) throw new Error(`Injected failure: ${point}`); }
}
