import type { TransactionQueryClient } from './enrollment-intake.ts';

export interface DocumentPolicySnapshotResult {
  policyCaptured: boolean;
  policyId: string | null;
  requirementsCaptured: number;
}

export async function captureEnrollmentDocumentPolicy(
  client: TransactionQueryClient,
  input: { institutionId: string; offerId: string; enrollmentId: string },
): Promise<DocumentPolicySnapshotResult> {
  const policy = await client.query<{ id: string }>(
    `SELECT id
       FROM enrollment_document_policies
      WHERE institution_id = $1 AND offer_id = $2 AND status = 'active'
      FOR SHARE`,
    [input.institutionId, input.offerId],
  );

  if (!policy.rowCount) {
    return { policyCaptured: false, policyId: null, requirementsCaptured: 0 };
  }

  const policyId = policy.rows[0].id;
  await client.query(
    `UPDATE enrollment_applications
        SET document_policy_id = $1, document_policy_captured_at = now()
      WHERE id = $2 AND institution_id = $3`,
    [policyId, input.enrollmentId, input.institutionId],
  );

  const requirements = await client.query<{ id: string; document_type: string; required: boolean }>(
    `SELECT id, document_type, required
       FROM enrollment_document_requirements
      WHERE institution_id = $1 AND policy_id = $2
      ORDER BY sort_order ASC, document_type ASC`,
    [input.institutionId, policyId],
  );

  for (const requirement of requirements.rows) {
    await client.query(
      `INSERT INTO enrollment_documents (
         institution_id, enrollment_application_id, document_type, status, required, source_requirement_id
       ) VALUES ($1, $2, $3, 'pending', $4, $5)`,
      [input.institutionId, input.enrollmentId, requirement.document_type, requirement.required, requirement.id],
    );
  }

  return { policyCaptured: true, policyId, requirementsCaptured: requirements.rows.length };
}
