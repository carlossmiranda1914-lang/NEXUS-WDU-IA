import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { type ConfirmJournalInput, type JournalRepository, validateConfirmation } from './journal-model.ts';

export type JournalFailurePoint = 'after_transaction' | 'after_entries' | 'after_audit' | 'after_command_result' | 'after_outbox';

export class PostgresJournalRepository implements JournalRepository {
  constructor(private readonly readClient: PoolClient, private readonly failurePoint?: JournalFailurePoint) {}
  async confirm(client: PoolClient, input: ConfirmJournalInput): Promise<{ transactionId: string }> {
    const validated = validateConfirmation(input); const transactionId = randomUUID();
    await client.query('BEGIN');
    try {
      await client.query(`INSERT INTO finance_journal_transactions (id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,effective_at,confirmed_at,reverses_transaction_id,reason) VALUES ($1,$2,'confirmed',$3,$4,$5,$6,$7,$8,$9,now(),$10,$11)`, [transactionId,input.institutionId,validated.currency,validated.amount.canonicalAmount(),input.commandId,input.journalType,input.actorPersonId,input.financialProfileVersion,input.effectiveAt,input.reversesTransactionId ?? null,input.reason ?? null]);
      this.fail('after_transaction');
      for (const entry of input.entries) await client.query(`INSERT INTO finance_journal_entries (institution_id,transaction_id,currency,amount,position_type,source_ref) VALUES ($1,$2,$3,$4,$5,$6)`, [input.institutionId,transactionId,entry.money.currency,entry.money.canonicalAmount(),entry.positionType,entry.sourceRef]);
      this.fail('after_entries');
      await client.query(`INSERT INTO finance_audit_records (institution_id,transaction_id,event_type,metadata) VALUES ($1,$2,'JOURNAL_CONFIRMED','{}')`, [input.institutionId,transactionId]);
      this.fail('after_audit');
      await client.query(`INSERT INTO finance_command_results (institution_id,operation_namespace,idempotency_key,request_fingerprint,result_ref) VALUES ($1,'finance.journal.confirmation',$2,$2,$3)`, [input.institutionId,input.commandId,transactionId]);
      this.fail('after_command_result');
      await client.query(`INSERT INTO finance_outbox (institution_id,transaction_id,topic,aggregate_id,payload) VALUES ($1,$2,'finance.journal.confirmed',$2,'{}')`, [input.institutionId,transactionId]);
      this.fail('after_outbox');
      await client.query('COMMIT'); return { transactionId };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
  async getConfirmed(institutionId: string, transactionId: string): Promise<unknown | null> {
    const result = await this.readClient.query(`SELECT id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,reason FROM finance_journal_transactions WHERE institution_id=$1 AND id=$2 AND status='confirmed'`, [institutionId, transactionId]);
    return result.rows[0] ?? null;
  }
  private fail(point: JournalFailurePoint) { if (this.failurePoint === point) throw new Error(`Injected failure: ${point}`); }
}
