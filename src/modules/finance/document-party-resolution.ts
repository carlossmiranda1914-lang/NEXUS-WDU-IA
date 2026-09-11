export type DocumentaryPartyKind = 'person' | 'organization';
export type DocumentaryPartyRef = Readonly<{ kind: DocumentaryPartyKind; authorityId: string; resolvedFrom: 'beneficiary' | 'billingParty' | 'payer' }>;
export type ResolvedDocumentParties = Readonly<{ beneficiary: DocumentaryPartyRef | null; billingParty: DocumentaryPartyRef; payer: DocumentaryPartyRef | null; recipient: DocumentaryPartyRef }>;
type Queryable = { query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> };

export class UnsupportedOrganizationRecipientError extends Error { constructor() { super('ORGANIZATION_RECIPIENT_UNSUPPORTED'); } }

export type DocumentaryPartySnapshot = Readonly<{ kind: 'person'; authorityId: string; name: string; resolvedFrom: DocumentaryPartyRef['resolvedFrom'] }>;

export async function resolveDocumentaryPartySnapshot(db: Queryable, party: DocumentaryPartyRef): Promise<DocumentaryPartySnapshot> {
  if (party.kind !== 'person') throw new UnsupportedOrganizationRecipientError();
  const result = await db.query<{ name: string }>('SELECT name FROM people WHERE id=$1', [party.authorityId]);
  if (!result.rows[0]) throw new Error('DOCUMENT_PARTY_NOT_FOUND');
  return { kind: 'person', authorityId: party.authorityId, name: result.rows[0].name, resolvedFrom: party.resolvedFrom };
}

export async function resolveDocumentParties(db: Queryable, input: { institutionId: string; financialAccountId: string; beneficiaryPersonId?: string | null; payerPersonId?: string | null; recipientKind?: DocumentaryPartyKind }): Promise<ResolvedDocumentParties> {
  if (input.recipientKind === 'organization') throw new UnsupportedOrganizationRecipientError();
  const billing = await db.query<{ person_id: string }>("SELECT person_id FROM finance_financial_account_parties WHERE institution_id=$1 AND financial_account_id=$2 AND role IN ('primary_debtor','co_debtor') AND status='active' ORDER BY CASE role WHEN 'primary_debtor' THEN 0 ELSE 1 END LIMIT 1", [input.institutionId, input.financialAccountId]);
  const billingPersonId = billing.rows[0]?.person_id;
  if (!billingPersonId) throw new Error('DOCUMENT_RECIPIENT_REQUIRED');
  const person = (authorityId: string, resolvedFrom: DocumentaryPartyRef['resolvedFrom']): DocumentaryPartyRef => ({ kind: 'person', authorityId, resolvedFrom });
  return { beneficiary: input.beneficiaryPersonId ? person(input.beneficiaryPersonId, 'beneficiary') : null, billingParty: person(billingPersonId, 'billingParty'), payer: input.payerPersonId ? person(input.payerPersonId, 'payer') : null, recipient: person(billingPersonId, 'billingParty') };
}
