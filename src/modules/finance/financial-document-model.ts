import { randomUUID } from 'node:crypto';

export type FinancialDocumentStatus = 'draft' | 'issued';
export type FinancialDocument = Readonly<{ id: string; institutionId: string; documentType: string; status: FinancialDocumentStatus; sourceSnapshot: Readonly<Record<string, unknown>>; seriesId?: string; sequenceNumber?: number; issuedAt?: string; correctsDocumentId?: string }>;
type Input = { institutionId: string; documentType: string; sourceSnapshot: Record<string, unknown> };

export function createFinancialDocumentDraft(input: Input): FinancialDocument { return Object.freeze({ id: randomUUID(), institutionId: input.institutionId, documentType: input.documentType, status: 'draft', sourceSnapshot: Object.freeze({ ...input.sourceSnapshot }) }); }
export function issueFinancialDocument(document: FinancialDocument, input: { seriesId: string; sequenceNumber: number; issuedAt: Date }): FinancialDocument { if (document.status !== 'draft') throw new Error('ISSUED_DOCUMENT_IMMUTABLE'); return Object.freeze({ ...document, status: 'issued', seriesId: input.seriesId, sequenceNumber: input.sequenceNumber, issuedAt: input.issuedAt.toISOString() }); }
export function createCorrectionDocument(original: FinancialDocument, input: Input): FinancialDocument { validateCorrectionInstitution(input.institutionId, original.institutionId); if (original.status !== 'issued') throw new Error('CORRECTION_REQUIRES_ISSUED_DOCUMENT'); return Object.freeze({ ...createFinancialDocumentDraft(input), correctsDocumentId: original.id }); }
export function validateDocumentSourceInstitution(documentInstitutionId: string, sourceInstitutionId: string): void { if (documentInstitutionId !== sourceInstitutionId) throw new Error('FOREIGN_FINANCIAL_DOCUMENT_SOURCE'); }
export function validateCorrectionInstitution(documentInstitutionId: string, originalInstitutionId: string): void { if (documentInstitutionId !== originalInstitutionId) throw new Error('FOREIGN_FINANCIAL_DOCUMENT_CORRECTION'); }
