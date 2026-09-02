import type { TransactionQueryClient } from './enrollment-intake.ts';

export interface DocumentPolicySnapshotResult {
  policyCaptured: boolean;
  policyId: string | null;
  requirementsCaptured: number;
}

function documentTypeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt');
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
  const requirements = await client.query<{ id: string; document_type: string; required: boolean }>(
    `SELECT id, document_type, required
       FROM enrollment_document_requirements
      WHERE institution_id = $1 AND policy_id = $2
      ORDER BY sort_order ASC, document_type ASC`,
    [input.institutionId, policyId],
  );

  // A document added before a policy is captured is operational evidence, not
  // an immutable policy snapshot. Bind only an exact normalized type match,
  // preserving its status/evidence; leave unrelated ad-hoc material untouched.
  const existing = await client.query<{ id: string; document_type: string; source_requirement_id: string | null }>(
    `SELECT id, document_type, source_requirement_id
       FROM enrollment_documents
      WHERE institution_id = $1 AND enrollment_application_id = $2
      FOR UPDATE`,
    [input.institutionId, input.enrollmentId],
  );
  const unmatchedByType = new Map<string, string>();
  for (const document of existing.rows) {
    if (document.source_requirement_id === null && !unmatchedByType.has(documentTypeKey(document.document_type))) {
      unmatchedByType.set(documentTypeKey(document.document_type), document.id);
    }
  }

  for (const requirement of requirements.rows) {
    const existingId = unmatchedByType.get(documentTypeKey(requirement.document_type));
    if (existingId) {
      await client.query(
        `UPDATE enrollment_documents
            SET required = $1, source_requirement_id = $2, updated_at = now()
          WHERE id = $3 AND institution_id = $4 AND enrollment_application_id = $5`,
        [requirement.required, requirement.id, existingId, input.institutionId, input.enrollmentId],
      );
      continue;
    }
    await client.query(
      `INSERT INTO enrollment_documents (
         institution_id, enrollment_application_id, document_type, status, required, source_requirement_id
       ) VALUES ($1, $2, $3, 'pending', $4, $5)`,
      [input.institutionId, input.enrollmentId, requirement.document_type, requirement.required, requirement.id],
    );
  }

  await client.query(
    `UPDATE enrollment_applications
        SET document_policy_id = $1, document_policy_captured_at = now()
      WHERE id = $2 AND institution_id = $3`,
    [policyId, input.enrollmentId, input.institutionId],
  );

  return { policyCaptured: true, policyId, requirementsCaptured: requirements.rows.length };
}
