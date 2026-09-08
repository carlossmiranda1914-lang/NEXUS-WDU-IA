import { validateDocumentSourceInstitution } from './financial-document-model.ts';

export type FinancialDocumentIssuanceCommand = { institutionId: string; sourceInstitutionId: string; seriesId: string; idempotencyKey: string };

/** F7-01 command boundary: all source ownership is rejected before any numbering mutation. */
export async function issueFinancialDocumentCommand(_dependencies: unknown, command: FinancialDocumentIssuanceCommand): Promise<never> {
  validateDocumentSourceInstitution(command.institutionId, command.sourceInstitutionId);
  throw new Error('FINANCIAL_DOCUMENT_ISSUANCE_REPOSITORY_REQUIRED');
}
