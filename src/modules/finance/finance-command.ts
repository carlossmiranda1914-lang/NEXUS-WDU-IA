import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { Money } from './money.ts';
import type { ConfirmJournalInput } from './journal-model.ts';
import type { ReverseFoundationTransactionInput } from './journal-model.ts';
import { PostgresJournalRepository } from './journal-repository.ts';

export interface FinanceCommandIdentity {
  institutionId: string;
  operationNamespace: string;
  idempotencyKey: string;
  canonicalFingerprint: string;
}

type PersistedCommand = { request_fingerprint: string; result_ref: string };
export type JournalConfirmationFingerprintInput = Omit<ConfirmJournalInput, 'commandId'>;

export function createCanonicalFinanceFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

export function createJournalConfirmationFingerprint(input: JournalConfirmationFingerprintInput): string {
  if (Number.isNaN(input.effectiveAt.getTime())) throw new Error('Journal confirmation effectiveAt is invalid');
  return createCanonicalFinanceFingerprint({
    institutionId: input.institutionId,
    journalType: input.journalType,
    effectiveAt: input.effectiveAt.toISOString(),
    entries: input.entries.map((entry) => ({ positionType: entry.positionType, money: entry.money.serialize(), sourceRef: entry.sourceRef })),
    reversesTransactionId: input.reversesTransactionId ?? null,
    reason: input.reason ?? null,
    actorPersonId: input.actorPersonId,
    financialProfileVersion: input.financialProfileVersion,
  });
}

export async function executeFoundationReversal(input: { pool: Pool; identity: Omit<FinanceCommandIdentity, 'canonicalFingerprint'> & { canonicalFingerprint?: string }; reversal: ReverseFoundationTransactionInput }): Promise<{ replayed: boolean; result: { transactionId: string } }> {
  const reversal = input.reversal;
  if (input.identity.institutionId !== reversal.institutionId) throw new Error('Finance command identity institution does not match reversal institution');
  const canonicalFingerprint = createJournalConfirmationFingerprint({ institutionId: reversal.institutionId, journalType: 'foundation_reversal', effectiveAt: reversal.effectiveAt, entries: [{ positionType: 'reversed_value', money: reversal.amount, sourceRef: reversal.originalTransactionId }], reversesTransactionId: reversal.originalTransactionId, reason: reversal.reason, actorPersonId: reversal.actorPersonId, financialProfileVersion: reversal.financialProfileVersion });
  return executeIdempotentFinanceCommand({ pool: input.pool, identity: { ...input.identity, canonicalFingerprint }, execute: async (client) => { const confirmed = await new PostgresJournalRepository(client).reverseInTransaction(client, reversal, input.identity.idempotencyKey); return { resultRef: confirmed.transactionId, result: confirmed }; }, loadResult: async (client, resultRef) => { const result = await client.query(`SELECT id FROM finance_journal_transactions WHERE institution_id=$1 AND id=$2 AND status='confirmed'`, [reversal.institutionId, resultRef]); if (!result.rows[0]) throw new Error('Persisted reversal result is missing'); return { transactionId: result.rows[0].id as string }; } });
}

export async function executeIdempotentFinanceCommand<T>(input: {
  pool: Pool;
  identity: FinanceCommandIdentity;
  execute: (client: PoolClient) => Promise<{ resultRef: string; result: T }>;
  loadResult: (client: PoolClient, resultRef: string) => Promise<T>;
}): Promise<{ replayed: boolean; result: T }> {
  const client = await input.pool.connect();
  try {
    const existing = await findCommand(client, input.identity);
    if (existing) return replayOrConflict(client, input.identity, existing, input.loadResult);

    await client.query('BEGIN');
    try {
      const executed = await input.execute(client);
      await client.query(
        `INSERT INTO finance_command_results (institution_id,operation_namespace,idempotency_key,request_fingerprint,result_ref) VALUES ($1,$2,$3,$4,$5)`,
        [input.identity.institutionId, input.identity.operationNamespace, input.identity.idempotencyKey, input.identity.canonicalFingerprint, executed.resultRef],
      );
      await client.query('COMMIT');
      return { replayed: false, result: executed.result };
    } catch (error) {
      await client.query('ROLLBACK');
      if (!isUniqueConflict(error)) throw error;
      const persisted = await findCommand(client, input.identity);
      if (!persisted) throw error;
      return replayOrConflict(client, input.identity, persisted, input.loadResult);
    }
  } finally { client.release(); }
}

async function findCommand(client: PoolClient, identity: FinanceCommandIdentity): Promise<PersistedCommand | undefined> {
  const result = await client.query<PersistedCommand>(
    `SELECT request_fingerprint,result_ref FROM finance_command_results WHERE institution_id=$1 AND operation_namespace=$2 AND idempotency_key=$3`,
    [identity.institutionId, identity.operationNamespace, identity.idempotencyKey],
  );
  return result.rows[0];
}

async function replayOrConflict<T>(client: PoolClient, identity: FinanceCommandIdentity, persisted: PersistedCommand, loadResult: (client: PoolClient, resultRef: string) => Promise<T>): Promise<{ replayed: boolean; result: T }> {
  if (persisted.request_fingerprint !== identity.canonicalFingerprint) throw new Error('Finance command fingerprint conflict');
  return { replayed: true, result: await loadResult(client, persisted.result_ref) };
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Money) return value.serialize();
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('Canonical Finance fingerprint Date is invalid');
    return value.toISOString();
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, nested]) => [key, canonicalize(nested)]));
  }
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') throw new Error('Canonical Finance fingerprint input is not serializable');
  return value;
}
