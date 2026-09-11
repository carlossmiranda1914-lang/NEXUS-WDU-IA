import type { DocumentarySnapshotV2 } from './documentary-snapshot.ts';
import type { DocumentarySettlementCapture } from './documentary-settlement-capture.ts';
import type { ResolvedDocumentaryPolicy } from './fiscal-adapter-registry.ts';
import { Money } from './money.ts';

const zero = (currency: string) => Money.parse('0', currency);

/** Independent V2 shape and internal-coherence boundary. */
export function validateDocumentarySnapshotStructure(snapshot: DocumentarySnapshotV2): void {
  const ids = new Set<string>();
  for (const allocation of snapshot.allocations) {
    if (ids.has(allocation.authorityId)) throw new Error('DOCUMENTARY_STRUCTURAL_DUPLICATE_ALLOCATION');
    ids.add(allocation.authorityId);
    const before = Money.parse(allocation.before.amount, allocation.before.currency);
    const movement = Money.parse(allocation.movement.amount, allocation.movement.currency);
    const after = Money.parse(allocation.after.amount, allocation.after.currency);
    if (!before.subtract(movement).equals(after) || movement.compare(zero(movement.currency)) <= 0) throw new Error('DOCUMENTARY_STRUCTURAL_ALLOCATION_COHERENCE');
  }
  if (snapshot.payment && snapshot.payment.currency !== snapshot.document.currency) throw new Error('DOCUMENTARY_STRUCTURAL_PAYMENT_CURRENCY');
}

/** Candidate must be exactly the immutable Finance capture from this command transaction. */
export function validateDocumentaryFinancialReconciliation(snapshot: DocumentarySnapshotV2, settlement: DocumentarySettlementCapture): void {
  if (JSON.stringify(snapshot.obligations) !== JSON.stringify(settlement.obligations) || JSON.stringify(snapshot.allocations) !== JSON.stringify(settlement.allocations) || JSON.stringify(snapshot.unallocated ?? null) !== JSON.stringify(settlement.unallocated ?? null)) throw new Error('DOCUMENTARY_FINANCIAL_RECONCILIATION_FAILED');
  if (snapshot.payment) {
    const allocated = snapshot.allocations.reduce((total, allocation) => total.add(Money.parse(allocation.movement.amount, allocation.movement.currency)), zero(snapshot.payment.currency));
    const residual = snapshot.unallocated ? Money.parse(snapshot.unallocated.amount, snapshot.unallocated.currency) : zero(snapshot.payment.currency);
    if (!allocated.add(residual).equals(Money.parse(snapshot.payment.amount, snapshot.payment.currency))) throw new Error('DOCUMENTARY_FINANCIAL_PAYMENT_RECONCILIATION_FAILED');
  }
}

export function validateDocumentaryDocumentType(snapshot: DocumentarySnapshotV2, expectedDocumentType: string): void {
  if (snapshot.document.type !== expectedDocumentType || !snapshot.payment || !snapshot.operation.reference) throw new Error('DOCUMENTARY_DOCUMENT_TYPE_INVALID');
}

export function validateDocumentaryJurisdiction(snapshot: DocumentarySnapshotV2, policy: ResolvedDocumentaryPolicy): void {
  if (snapshot.tax.treatment !== policy.taxTreatment || JSON.stringify(snapshot.legalMentions) !== JSON.stringify(policy.legalMentions)) throw new Error('DOCUMENTARY_JURISDICTION_POLICY_MISMATCH');
}
