import { documentValidationGate, type CapturedDocumentRequirement } from './enrollment-document-requirement-policy.ts';

export function evaluateCapturedDocumentPolicy(
  policyId: string | null,
  documents: readonly CapturedDocumentRequirement[],
) {
  return documentValidationGate(policyId !== null, documents);
}
