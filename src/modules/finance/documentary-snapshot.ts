export type DocumentarySnapshotV1 = Readonly<{ schemaVersion: 1; issuer: Readonly<{ legalName: string; taxIdentifier: string | null; address: Readonly<{ countryCode: string; line1: string }> }>; recipient: Readonly<{ name: string; authorityId: string }>; operation: Readonly<{ reference: string | null }>; payment: Readonly<{ reference: string; amount: string; currency: string }> | null; totals: Readonly<{ documentTotal: string; currency: string }>; jurisdiction: Readonly<{ code: string; policyVersion: string }> }>;

const freeze = <T>(value: T): Readonly<T> => Object.freeze(value);

export function createDocumentarySnapshot(input: Omit<DocumentarySnapshotV1, 'schemaVersion'>): DocumentarySnapshotV1 {
  return freeze({ schemaVersion: 1, issuer: freeze({ ...input.issuer, address: freeze({ ...input.issuer.address }) }), recipient: freeze({ ...input.recipient }), operation: freeze({ ...input.operation }), payment: input.payment ? freeze({ ...input.payment }) : null, totals: freeze({ ...input.totals }), jurisdiction: freeze({ ...input.jurisdiction }) });
}

export function composeReceiptDocumentarySnapshot(input: {
  issuer: DocumentarySnapshotV1['issuer']; recipient: DocumentarySnapshotV1['recipient']; paymentReference: string; amount: string; currency: string; jurisdictionCode: string; policyVersion: string;
}): DocumentarySnapshotV1 {
  return createDocumentarySnapshot({ issuer: input.issuer, recipient: input.recipient, operation: { reference: input.paymentReference }, payment: { reference: input.paymentReference, amount: input.amount, currency: input.currency }, totals: { documentTotal: input.amount, currency: input.currency }, jurisdiction: { code: input.jurisdictionCode, policyVersion: input.policyVersion } });
}
