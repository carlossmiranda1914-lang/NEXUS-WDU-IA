export type DocumentarySnapshotV1 = Readonly<{ schemaVersion: 1; issuer: Readonly<{ legalName: string; taxIdentifier: string | null; address: Readonly<{ countryCode: string; line1: string }> }>; recipient: Readonly<{ name: string; authorityId: string }>; operation: Readonly<{ reference: string | null }>; payment: Readonly<{ reference: string; amount: string; currency: string }> | null; totals: Readonly<{ documentTotal: string; currency: string }>; jurisdiction: Readonly<{ code: string; policyVersion: string }> }>;

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);

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
  const snapshot = freeze({ schemaVersion: 1, issuer: freeze({ ...input.issuer, address: freeze({ ...input.issuer.address }) }), recipient: freeze({ ...input.recipient }), operation: freeze({ ...input.operation }), payment: input.payment ? freeze({ ...input.payment }) : null, totals: freeze({ ...input.totals }), jurisdiction: freeze({ ...input.jurisdiction }) });
  assertValidDocumentarySnapshot(snapshot);
  return snapshot;
}

export function composeReceiptDocumentarySnapshot(input: {
  issuer: DocumentarySnapshotV1['issuer']; recipient: DocumentarySnapshotV1['recipient']; paymentReference: string; amount: string; currency: string; jurisdictionCode: string; policyVersion: string;
}): DocumentarySnapshotV1 {
  return createDocumentarySnapshot({ issuer: input.issuer, recipient: input.recipient, operation: { reference: input.paymentReference }, payment: { reference: input.paymentReference, amount: input.amount, currency: input.currency }, totals: { documentTotal: input.amount, currency: input.currency }, jurisdiction: { code: input.jurisdictionCode, policyVersion: input.policyVersion } });
}
