export type DocumentaryPartyKind = 'person' | 'organization';
export type DocumentaryPartyRef = Readonly<{ kind: DocumentaryPartyKind; authorityId: string; resolvedFrom: 'beneficiary' | 'billingParty' | 'payer' }>;
export type ResolvedDocumentParties = Readonly<{ beneficiary: DocumentaryPartyRef | null; billingParty: DocumentaryPartyRef; payer: DocumentaryPartyRef | null; recipient: DocumentaryPartyRef }>;
type Queryable = { query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> };

export class UnsupportedOrganizationRecipientError extends Error { constructor() { super('ORGANIZATION_RECIPIENT_UNSUPPORTED'); } }
export class DocumentPartyResolutionError extends Error {
  constructor(readonly code: 'DOCUMENT_RECIPIENT_REQUIRED' | 'DOCUMENT_PARTY_SOURCE_NOT_FOUND') { super(code); }
}

export type DocumentaryPartySnapshot = Readonly<{ kind: 'person'; authorityId: string; name: string; resolvedFrom: DocumentaryPartyRef['resolvedFrom'] }>;

export async function resolveDocumentaryPartySnapshot(db: Queryable, party: DocumentaryPartyRef): Promise<DocumentaryPartySnapshot> {
  if (party.kind !== 'person') throw new UnsupportedOrganizationRecipientError();
  const result = await db.query<{ name: string }>('SELECT name FROM people WHERE id=$1', [party.authorityId]);
  if (!result.rows[0]) throw new Error('DOCUMENT_PARTY_NOT_FOUND');
  return { kind: 'person', authorityId: party.authorityId, name: result.rows[0].name, resolvedFrom: party.resolvedFrom };
}

/**
 * Resolves authority references only.  Inputs are Finance source identifiers,
 * never browser-supplied party identifiers or presentation data.
 */
export async function resolveDocumentParties(db: Queryable, input: { institutionId: string; financialAccountId: string; paymentId?: string; obligationId?: string; recipientKind?: DocumentaryPartyKind }): Promise<ResolvedDocumentParties> {
  if (input.recipientKind === 'organization') throw new UnsupportedOrganizationRecipientError();
  const billing = await db.query<{ person_id: string }>("SELECT person_id FROM finance_financial_account_parties WHERE institution_id=$1 AND financial_account_id=$2 AND role IN ('primary_debtor','co_debtor') AND status='active' ORDER BY CASE role WHEN 'primary_debtor' THEN 0 ELSE 1 END LIMIT 1", [input.institutionId, input.financialAccountId]);
  const billingPersonId = billing.rows[0]?.person_id;
  if (!billingPersonId) throw new DocumentPartyResolutionError('DOCUMENT_RECIPIENT_REQUIRED');
  const person = (authorityId: string, resolvedFrom: DocumentaryPartyRef['resolvedFrom']): DocumentaryPartyRef => ({ kind: 'person', authorityId, resolvedFrom });
  let beneficiary: DocumentaryPartyRef | null = null;
  if (input.obligationId) {
    const obligation = await db.query<{ beneficiary_person_id: string | null }>('SELECT beneficiary_person_id FROM finance_obligations WHERE institution_id=$1 AND financial_account_id=$2 AND id=$3', [input.institutionId, input.financialAccountId, input.obligationId]);
    if (!obligation.rows[0]) throw new DocumentPartyResolutionError('DOCUMENT_PARTY_SOURCE_NOT_FOUND');
    beneficiary = obligation.rows[0].beneficiary_person_id ? person(obligation.rows[0].beneficiary_person_id, 'beneficiary') : null;
  }
  let payer: DocumentaryPartyRef | null = null;
  if (input.paymentId) {
    const payment = await db.query<{ payer_person_id: string | null }>('SELECT payer_person_id FROM finance_payments WHERE institution_id=$1 AND financial_account_id=$2 AND id=$3', [input.institutionId, input.financialAccountId, input.paymentId]);
    if (!payment.rows[0]) throw new DocumentPartyResolutionError('DOCUMENT_PARTY_SOURCE_NOT_FOUND');
    payer = payment.rows[0].payer_person_id ? person(payment.rows[0].payer_person_id, 'payer') : null;
  }
  const billingParty = person(billingPersonId, 'billingParty');
  return { beneficiary, billingParty, payer, recipient: billingParty };
}
