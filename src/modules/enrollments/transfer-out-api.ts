import type { PoolClient } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { canPrepareTransferOut, canTransitionTransferOut, isTransferOutStatus, type TransferOutStatus } from './transfer-out-policy.ts';

interface QueryClient { query<T = any>(text: string, params?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }>; }
export interface TransferOutPool extends QueryClient { connect(): Promise<PoolClient>; }
export class TransferOutError extends Error { constructor(public readonly code: 'INVALID_INPUT' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'INVALID_TRANSITION', message: string) { super(message); } }
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{30,}$/i.test(value);
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';

export async function listTransferOuts(pool: QueryClient, context: InstitutionalContext, enrollmentId: unknown) {
  if (!uuid(enrollmentId)) throw new TransferOutError('INVALID_INPUT', 'Matrícula inválida.');
  if (!canPrepareTransferOut(context.role)) throw new TransferOutError('FORBIDDEN', 'O seu papel não pode consultar transferências.');
  const result = await pool.query(`SELECT id, destination_name, reason, status, academic_clearance, financial_clearance, attestation_note, decided_at, created_at, updated_at
    FROM transfer_out_requests WHERE institution_id = $1 AND enrollment_application_id = $2 ORDER BY created_at DESC`, [context.institutionId, enrollmentId]);
  return { requests: result.rows };
}

export async function createTransferOut(pool: TransferOutPool, context: InstitutionalContext, input: { enrollmentId: unknown; destinationName: unknown; reason: unknown }) {
  if (!canPrepareTransferOut(context.role)) throw new TransferOutError('FORBIDDEN', 'O seu papel não pode preparar transferências.');
  const destinationName = text(input.destinationName, 160); const reason = text(input.reason, 500);
  if (!uuid(input.enrollmentId) || destinationName.length < 2 || reason.length < 2) throw new TransferOutError('INVALID_INPUT', 'Dados de transferência inválidos.');
  const client = await pool.connect();
  try { await client.query('BEGIN');
    const enrollment = await client.query<{ status: string }>('SELECT status FROM enrollment_applications WHERE id = $1 AND institution_id = $2 FOR UPDATE', [input.enrollmentId, context.institutionId]);
    if (!enrollment.rowCount) throw new TransferOutError('NOT_FOUND', 'Matrícula não encontrada nesta instituição.');
    if (enrollment.rows[0].status !== 'active') throw new TransferOutError('CONFLICT', 'Só uma matrícula ativa pode iniciar transferência de saída.');
    const inserted = await client.query('INSERT INTO transfer_out_requests (institution_id,enrollment_application_id,destination_name,reason,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$5) RETURNING id,status,destination_name,reason,created_at', [context.institutionId, input.enrollmentId, destinationName, reason, context.personId]);
    await client.query("INSERT INTO enrollment_events (institution_id,enrollment_application_id,actor_person_id,event_type,metadata) VALUES ($1,$2,$3,'transfer_out_started',$4::jsonb)", [context.institutionId, input.enrollmentId, context.personId, JSON.stringify({ destinationName })]);
    await client.query('COMMIT'); return { request: inserted.rows[0] };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function transitionTransferOut(pool: TransferOutPool, context: InstitutionalContext, requestId: unknown, input: { toStatus: unknown; academicClearance?: unknown; financialClearance?: unknown; attestationNote?: unknown }) {
  if (!uuid(requestId) || !isTransferOutStatus(input.toStatus)) throw new TransferOutError('INVALID_INPUT', 'Transição de transferência inválida.');
  const client = await pool.connect();
  try { await client.query('BEGIN');
    const current = await client.query<{ status: TransferOutStatus; enrollment_application_id: string }>('SELECT status,enrollment_application_id FROM transfer_out_requests WHERE id=$1 AND institution_id=$2 FOR UPDATE', [requestId, context.institutionId]);
    if (!current.rowCount) throw new TransferOutError('NOT_FOUND', 'Pedido de transferência não encontrado nesta instituição.');
    const from = current.rows[0].status; const to = input.toStatus;
    if (!canTransitionTransferOut(context.role, from, to)) throw new TransferOutError('FORBIDDEN', 'Transição de transferência não autorizada.');
    const note = text(input.attestationNote, 500);
    if (to === 'approved' && (input.academicClearance !== true || input.financialClearance !== true || note.length < 2)) throw new TransferOutError('CONFLICT', 'A aprovação exige declaração académica, financeira e nota auditável da Direção/Administração.');
    const decision = to === 'approved' || to === 'rejected';
    const updated = await client.query(`UPDATE transfer_out_requests SET status=$1, academic_clearance=CASE WHEN $2 THEN $3 ELSE academic_clearance END, financial_clearance=CASE WHEN $2 THEN $4 ELSE financial_clearance END, attestation_note=CASE WHEN $2 THEN $5 ELSE attestation_note END, decided_by=CASE WHEN $2 THEN $6 ELSE NULL END, decided_at=CASE WHEN $2 THEN now() ELSE NULL END, updated_by=$6, updated_at=now() WHERE id=$7 AND institution_id=$8 RETURNING id,status,updated_at`, [to, decision, input.academicClearance === true, input.financialClearance === true, note || null, context.personId, requestId, context.institutionId]);
    if (to === 'approved') {
      await client.query("UPDATE enrollment_applications SET status='transferred_out',updated_by=$1,updated_at=now() WHERE id=$2 AND institution_id=$3", [context.personId, current.rows[0].enrollment_application_id, context.institutionId]);
      await client.query("INSERT INTO enrollment_events (institution_id,enrollment_application_id,actor_person_id,event_type,from_status,to_status,metadata) VALUES ($1,$2,$3,'transfer_out_approved','active','transferred_out',$4::jsonb)", [context.institutionId, current.rows[0].enrollment_application_id, context.personId, JSON.stringify({ requestId, attestationNote: note })]);
    } else await client.query("INSERT INTO enrollment_events (institution_id,enrollment_application_id,actor_person_id,event_type,metadata) VALUES ($1,$2,$3,'transfer_out_status_changed',$4::jsonb)", [context.institutionId, current.rows[0].enrollment_application_id, context.personId, JSON.stringify({ requestId, from, to })]);
    await client.query('COMMIT'); return { request: updated.rows[0] };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
