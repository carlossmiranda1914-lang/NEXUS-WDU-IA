import type { InstitutionalContext } from '../../auth/institutional-context.ts';

type QueryResult<T = any> = { rows: T[]; rowCount: number | null };
export type ActivationClient = { query<T = any>(text: string, values?: unknown[]): Promise<QueryResult<T>>; release(): void };
export type ActivationPool = { connect(): Promise<ActivationClient> };
export class EnrollmentActivationError extends Error { constructor(public readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'INVALID_STATE', message: string) { super(message); } }
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function activateEnrollment(pool: ActivationPool, context: InstitutionalContext, enrollmentId: unknown, testHooks?: { failAfter?: 'enrollment' | 'profile' | 'event' }) {
  if (!uuid(enrollmentId)) throw new EnrollmentActivationError('NOT_FOUND', 'Matrícula não encontrada.');
  if (!['institution_admin', 'director'].includes(context.role)) throw new EnrollmentActivationError('FORBIDDEN', 'Apenas Direção ou Administração pode ativar uma matrícula.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const enrollment = await client.query<{ status: string; student_person_id: string }>('SELECT status,student_person_id FROM enrollment_applications WHERE id=$1 AND institution_id=$2 FOR UPDATE', [enrollmentId, context.institutionId]);
    if (!enrollment.rowCount) throw new EnrollmentActivationError('NOT_FOUND', 'Matrícula não encontrada.');
    const profile = await client.query<{ status: string }>('SELECT status FROM student_profiles WHERE person_id=$1 AND institution_id=$2 FOR UPDATE', [enrollment.rows[0].student_person_id, context.institutionId]);
    if (!profile.rowCount) throw new EnrollmentActivationError('CONFLICT', 'O perfil escolar da matrícula não está consistente.');
    const pair = `${enrollment.rows[0].status}/${profile.rows[0].status}`;
    if (pair === 'active/active') { await client.query('COMMIT'); return { status: 'active', replayed: true }; }
    if (pair === 'active/inactive' || pair === 'validated/active') throw new EnrollmentActivationError('CONFLICT', 'Foi detetada uma inconsistência histórica que requer reconciliação administrativa.');
    if (pair !== 'validated/inactive') throw new EnrollmentActivationError('INVALID_STATE', 'A matrícula ainda não está pronta para ativação.');
    await client.query("UPDATE enrollment_applications SET status='active',updated_by=$1,updated_at=now() WHERE id=$2 AND institution_id=$3", [context.personId, enrollmentId, context.institutionId]);
    if (testHooks?.failAfter === 'enrollment') throw new Error('injected activation failure');
    await client.query("UPDATE student_profiles SET status='active',updated_at=now() WHERE person_id=$1 AND institution_id=$2", [enrollment.rows[0].student_person_id, context.institutionId]);
    if (testHooks?.failAfter === 'profile') throw new Error('injected activation failure');
    await client.query("INSERT INTO enrollment_events(institution_id,enrollment_application_id,actor_person_id,event_type,from_status,to_status) VALUES($1,$2,$3,'enrollment_activated','validated','active')", [context.institutionId, enrollmentId, context.personId]);
    if (testHooks?.failAfter === 'event') throw new Error('injected activation failure');
    await client.query('COMMIT'); return { status: 'active', replayed: false };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
