export type DocumentarySnapshotV1 = Readonly<{ schemaVersion: 1; issuer: Readonly<{ legalName: string; taxIdentifier: string | null; address: Readonly<{ countryCode: string; line1: string }> }>; recipient: Readonly<{ name: string; authorityId: string }>; operation: Readonly<{ reference: string | null }>; payment: Readonly<{ reference: string; amount: string; currency: string }> | null; totals: Readonly<{ documentTotal: string; currency: string }>; jurisdiction: Readonly<{ code: string; policyVersion: string }> }>;

type DocumentaryPartySnapshot = Readonly<{ name: string; authorityId: string }>;
type DocumentaryMoney = Readonly<{ amount: string; currency: string }>;
export type DocumentarySnapshotV2 = Readonly<{
  snapshotVersion: 2;
  document: Readonly<{ type: string; issuedAt: string; currency: string }>;
  issuer: DocumentarySnapshotV1['issuer']; recipient: DocumentaryPartySnapshot;
  beneficiary?: DocumentaryPartySnapshot; billingParty?: DocumentaryPartySnapshot; payer?: DocumentaryPartySnapshot;
  operation: Readonly<{ reference: string | null }>;
  obligations: readonly Readonly<{ authorityId: string; reference: string | null; components: readonly Readonly<{ kind: string; amount: string; currency: string; provenance: Readonly<{ sourceType: string; sourceId: string; versionId?: string }> }>[] }> [];
  payment: Readonly<{ authorityId: string; reference: string; confirmedAt: string; method: string; amount: string; currency: string }> | null;
  allocations: readonly Readonly<{ authorityId: string; obligationAuthorityId: string; before: DocumentaryMoney; movement: DocumentaryMoney; after: DocumentaryMoney }>[];
  unallocated?: DocumentaryMoney;
  totals: Readonly<{ documentTotal: string; currency: string }>;
  tax: Readonly<{ treatment: string }>;
  jurisdiction: Readonly<{ code: string; policyVersion: string }>;
  legalMentions: readonly string[];
  correction?: Readonly<{ originalDocumentId: string; originalSnapshotVersion: 1 | 2 }>;
  policyProvenance: Readonly<{ financialProfileVersion: number; fiscalConfigurationVersion: number; seriesId: string; adapterKey: string; policyVersion: string }>;
}>;
export type DocumentarySnapshot = DocumentarySnapshotV1 | DocumentarySnapshotV2;
export type DecodedDocumentarySnapshot = Readonly<{ snapshotVersion: 1 | 2; snapshot: DocumentarySnapshot }>;

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);
const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

const required = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`DOCUMENTARY_SNAPSHOT_${field}_REQUIRED`);
  return value;
};

/** Reject incomplete documentary evidence before issuance allocates a document number. */
export function assertValidDocumentarySnapshot(snapshot: DocumentarySnapshotV1): void {
  required(snapshot.issuer.legalName, 'ISSUER_LEGAL_NAME');
  required(snapshot.issuer.address.countryCode, 'ISSUER_COUNTRY');
  required(snapshot.issuer.address.line1, 'ISSUER_ADDRESS');
  required(snapshot.recipient.name, 'RECIPIENT_NAME');
  required(snapshot.recipient.authorityId, 'RECIPIENT_AUTHORITY');
  required(snapshot.operation.reference, 'OPERATION_REFERENCE');
  if (!snapshot.payment) throw new Error('DOCUMENTARY_SNAPSHOT_PAYMENT_REQUIRED');
  required(snapshot.payment.reference, 'PAYMENT_REFERENCE');
  required(snapshot.payment.amount, 'PAYMENT_AMOUNT');
  required(snapshot.payment.currency, 'PAYMENT_CURRENCY');
  required(snapshot.totals.documentTotal, 'TOTAL_AMOUNT');
  required(snapshot.totals.currency, 'TOTAL_CURRENCY');
  required(snapshot.jurisdiction.code, 'JURISDICTION_CODE');
  required(snapshot.jurisdiction.policyVersion, 'POLICY_VERSION');
}

export function createDocumentarySnapshot(input: Omit<DocumentarySnapshotV1, 'schemaVersion'>): DocumentarySnapshotV1 {
  const snapshot = freeze({ schemaVersion: 1 as const, issuer: freeze({ ...input.issuer, address: freeze({ ...input.issuer.address }) }), recipient: freeze({ ...input.recipient }), operation: freeze({ ...input.operation }), payment: input.payment ? freeze({ ...input.payment }) : null, totals: freeze({ ...input.totals }), jurisdiction: freeze({ ...input.jurisdiction }) });
  assertValidDocumentarySnapshot(snapshot);
  return snapshot;
}

export function composeReceiptDocumentarySnapshot(input: {
  issuer: DocumentarySnapshotV1['issuer']; recipient: DocumentarySnapshotV1['recipient']; paymentReference: string; amount: string; currency: string; jurisdictionCode: string; policyVersion: string;
}): DocumentarySnapshotV1 {
  return createDocumentarySnapshot({ issuer: input.issuer, recipient: input.recipient, operation: { reference: input.paymentReference }, payment: { reference: input.paymentReference, amount: input.amount, currency: input.currency }, totals: { documentTotal: input.amount, currency: input.currency }, jurisdiction: { code: input.jurisdictionCode, policyVersion: input.policyVersion } });
}

/** V2 is the only new-write shape after cutover; V1 remains a read-only historical format. */
export function createDocumentarySnapshotV2(input: Omit<DocumentarySnapshotV2, 'snapshotVersion'>): DocumentarySnapshotV2 {
  required(input.document.type, 'DOCUMENT_TYPE'); required(input.document.issuedAt, 'ISSUED_AT'); required(input.document.currency, 'DOCUMENT_CURRENCY');
  required(input.issuer.legalName, 'ISSUER_LEGAL_NAME'); required(input.recipient.name, 'RECIPIENT_NAME'); required(input.recipient.authorityId, 'RECIPIENT_AUTHORITY');
  required(input.totals.documentTotal, 'TOTAL_AMOUNT'); required(input.totals.currency, 'TOTAL_CURRENCY'); required(input.jurisdiction.code, 'JURISDICTION_CODE'); required(input.jurisdiction.policyVersion, 'POLICY_VERSION');
  required(input.policyProvenance.adapterKey, 'POLICY_ADAPTER'); required(input.policyProvenance.policyVersion, 'POLICY_VERSION'); required(input.policyProvenance.seriesId, 'SERIES_ID');
  if (input.document.currency !== input.totals.currency) throw new Error('DOCUMENTARY_SNAPSHOT_CURRENCY_MISMATCH');
  return deepFreeze({ snapshotVersion: 2 as const, ...input }) as DocumentarySnapshotV2;
}

/** Explicit discriminator: legacy rows are recognized solely by their stored V1 schema marker. */
export function decodeDocumentarySnapshot(value: unknown): DecodedDocumentarySnapshot {
  if (!value || typeof value !== 'object') throw new Error('DOCUMENTARY_SNAPSHOT_INVALID');
  const snapshot = value as Record<string, unknown>;
  if (snapshot.snapshotVersion === 2) return { snapshotVersion: 2, snapshot: value as DocumentarySnapshotV2 };
  if (snapshot.schemaVersion === 1) return { snapshotVersion: 1, snapshot: value as DocumentarySnapshotV1 };
  throw new Error('DOCUMENTARY_SNAPSHOT_VERSION_UNSUPPORTED');
}
