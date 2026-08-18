import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { canConfigureDocumentRequirements } from './enrollment-document-requirement-policy.ts';

export interface EnrollmentDocumentPolicyPublicationClient {
  query<T = any>(sql: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
  release(): void;
}

export interface EnrollmentDocumentPolicyPublicationPool {
  connect(): Promise<EnrollmentDocumentPolicyPublicationClient>;
}

export class EnrollmentDocumentPolicyPublicationError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'INVALID_POLICY', message: string) {
    super(message);
    this.name = 'EnrollmentDocumentPolicyPublicationError';
  }
}

export interface PublishEnrollmentDocumentPolicyResult {
  status: 'active';
  version: number;
  activatedAt: string;
  replayed: boolean;
}

export async function publishEnrollmentDocumentPolicy(
  pool: EnrollmentDocumentPolicyPublicationPool,
  context: InstitutionalContext,
  policyId: string,
  testHooks?: { failAfter?: 'retire' | 'activate' | 'event' },
): Promise<PublishEnrollmentDocumentPolicyResult> {
  if (!canConfigureDocumentRequirements(context.role)) throw new EnrollmentDocumentPolicyPublicationError('FORBIDDEN', 'O seu papel não pode publicar políticas documentais.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const policy = await client.query<{ id: string; offer_id: string; status: 'draft' | 'active' | 'retired'; version: number; activated_at: string | null }>(
      `SELECT id, offer_id, status, version, activated_at
         FROM enrollment_document_policies
        WHERE id = $1 AND institution_id = $2
        FOR UPDATE`,
      [policyId, context.institutionId],
    );
    if (!policy.rowCount) throw new EnrollmentDocumentPolicyPublicationError('NOT_FOUND', 'Política documental não encontrada nesta instituição.');
    const candidate = policy.rows[0];
    const offer = await client.query<{ id: string }>(
      `SELECT id FROM enrollment_offers
        WHERE id = $1 AND institution_id = $2 AND status = 'active'
        FOR UPDATE`,
      [candidate.offer_id, context.institutionId],
    );
    if (!offer.rowCount) throw new EnrollmentDocumentPolicyPublicationError('INVALID_POLICY', 'A oferta desta política não está ativa nesta instituição.');
    if (candidate.status === 'active') {
      await client.query('COMMIT');
      return { status: 'active', version: candidate.version, activatedAt: candidate.activated_at ?? '', replayed: true };
    }
    if (candidate.status !== 'draft') throw new EnrollmentDocumentPolicyPublicationError('CONFLICT', 'Apenas políticas em rascunho podem ser publicadas.');

    const requirements = await client.query<{ id: string }>(
      `SELECT id FROM enrollment_document_requirements
        WHERE institution_id = $1 AND policy_id = $2
        FOR SHARE`,
      [context.institutionId, candidate.id],
    );
    if (!requirements.rowCount) throw new EnrollmentDocumentPolicyPublicationError('INVALID_POLICY', 'A política documental precisa de pelo menos um requisito antes da publicação.');

    const previous = await client.query<{ id: string; version: number }>(
      `SELECT id, version FROM enrollment_document_policies
        WHERE institution_id = $1 AND offer_id = $2 AND status = 'active'
        FOR UPDATE`,
      [context.institutionId, candidate.offer_id],
    );
    if (previous.rowCount) {
      await client.query("UPDATE enrollment_document_policies SET status = 'retired' WHERE id = $1 AND institution_id = $2", [previous.rows[0].id, context.institutionId]);
    }
    if (testHooks?.failAfter === 'retire') throw new Error('injected policy publication failure');

    const activated = await client.query<{ activated_at: string }>(
      `UPDATE enrollment_document_policies
          SET status = 'active', activated_at = now()
        WHERE id = $1 AND institution_id = $2 AND status = 'draft'
        RETURNING activated_at`,
      [candidate.id, context.institutionId],
    );
    if (!activated.rowCount) throw new EnrollmentDocumentPolicyPublicationError('CONFLICT', 'A política deixou de estar disponível para publicação.');
    if (testHooks?.failAfter === 'activate') throw new Error('injected policy publication failure');

    await client.query(
      `INSERT INTO enrollment_document_policy_events
         (institution_id, policy_id, offer_id, previous_policy_id, actor_person_id, event_type, metadata)
       VALUES ($1, $2, $3, $4, $5, 'policy_published', $6::jsonb)`,
      [context.institutionId, candidate.id, candidate.offer_id, previous.rows[0]?.id ?? null, context.personId, JSON.stringify({ version: candidate.version, previousVersion: previous.rows[0]?.version ?? null })],
    );
    if (testHooks?.failAfter === 'event') throw new Error('injected policy publication failure');
    await client.query('COMMIT');
    return { status: 'active', version: candidate.version, activatedAt: activated.rows[0].activated_at, replayed: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
