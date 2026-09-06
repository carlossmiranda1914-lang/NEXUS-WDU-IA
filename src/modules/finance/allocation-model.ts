import { Money } from './money.ts';

export type PaymentAllocationPosition = 'unapplied' | 'partially_allocated' | 'fully_allocated';
export type ObligationCoveragePosition = 'open' | 'partially_covered' | 'covered';

export interface Allocation {
  readonly id: string;
  readonly institutionId: string;
  readonly financialAccountId: string;
  readonly paymentId: string;
  readonly obligationId: string;
  readonly money: Money;
  readonly effectiveAt: Date;
  readonly recordedAt: Date;
  readonly actorKind: 'human' | 'system' | 'provider';
  readonly actorPersonId?: string;
  readonly journalTransactionId: string;
  readonly commandId: string;
  readonly status: 'confirmed';
}

export interface AllocationReversal {
  readonly id: string;
  readonly institutionId: string;
  readonly originalAllocationId: string;
  readonly money: Money;
  readonly reason: string;
  readonly effectiveAt: Date;
  readonly recordedAt: Date;
  readonly actorKind: 'human' | 'system' | 'provider';
  readonly actorPersonId?: string;
  readonly journalTransactionId: string;
  readonly commandId: string;
  readonly status: 'confirmed';
}

export interface AllocationPaymentCandidate {
  readonly id: string;
  readonly institutionId: string;
  readonly financialAccountId: string;
  readonly currency: string;
  readonly remainingAllocatable: Money;
}

export interface AllocationObligationCandidate {
  readonly id: string;
  readonly institutionId: string;
  readonly financialAccountId: string;
  readonly currency: string;
  readonly remainingCoverable: Money;
}

export interface ConfirmAllocationLineInput {
  readonly obligation: AllocationObligationCandidate;
  readonly amount: Money;
}

export interface ConfirmAllocationInput {
  readonly payment: AllocationPaymentCandidate;
  readonly lines: readonly ConfirmAllocationLineInput[];
  readonly effectiveAt: Date;
}

export interface NormalizedConfirmAllocationInput extends ConfirmAllocationInput {
  readonly lines: readonly ConfirmAllocationLineInput[];
  readonly total: Money;
}

export interface ReverseAllocationInput {
  readonly originalAllocationId: string;
  readonly amount: Money;
  readonly remainingReversible: Money;
  readonly currency: string;
  readonly reason: string;
  readonly effectiveAt: Date;
}

export interface PaymentAllocationPositionProjection {
  readonly state: PaymentAllocationPosition;
  readonly allocated: Money;
  readonly unapplied: Money;
}

export interface ObligationCoveragePositionProjection {
  readonly state: ObligationCoveragePosition;
  readonly covered: Money;
  readonly uncovered: Money;
}

export class AllocationValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'AllocationValidationError'; }
}

const zero = (currency: string) => Money.parse('0', currency);

function requireValidDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new AllocationValidationError('Allocation effective date is required');
}

function requirePositive(money: Money, message: string): void {
  if (money.compare(zero(money.currency)) <= 0) throw new AllocationValidationError(message);
}

export function derivePaymentAllocationPosition(amount: string, allocated: string, currency: string): PaymentAllocationPositionProjection {
  const received = Money.parse(amount, currency);
  const applied = Money.parse(allocated, currency);
  requirePositive(received, 'Payment amount must be strictly positive');
  if (applied.compare(zero(currency)) < 0 || applied.compare(received) > 0) throw new AllocationValidationError('Payment allocated amount must be within the received amount');
  const unapplied = received.subtract(applied);
  return { state: applied.compare(zero(currency)) === 0 ? 'unapplied' : unapplied.compare(zero(currency)) === 0 ? 'fully_allocated' : 'partially_allocated', allocated: applied, unapplied };
}

export function deriveObligationCoveragePosition(amount: string, covered: string, currency: string): ObligationCoveragePositionProjection {
  const original = Money.parse(amount, currency);
  const applied = Money.parse(covered, currency);
  requirePositive(original, 'Obligation amount must be strictly positive');
  if (applied.compare(zero(currency)) < 0 || applied.compare(original) > 0) throw new AllocationValidationError('Obligation covered amount must be within the original amount');
  const uncovered = original.subtract(applied);
  return { state: applied.compare(zero(currency)) === 0 ? 'open' : uncovered.compare(zero(currency)) === 0 ? 'covered' : 'partially_covered', covered: applied, uncovered };
}

export function normalizeConfirmAllocationInput(input: ConfirmAllocationInput): NormalizedConfirmAllocationInput {
  requireValidDate(input.effectiveAt);
  if (!input.payment.id || !input.payment.institutionId || !input.payment.financialAccountId || input.lines.length === 0) throw new AllocationValidationError('Payment and at least one allocation line are required');
  if (input.payment.remainingAllocatable.currency !== input.payment.currency) throw new AllocationValidationError('Payment remaining amount currency is invalid');
  requirePositive(input.payment.remainingAllocatable, 'Payment remaining allocatable amount must be strictly positive');
  const obligationIds = new Set<string>();
  let total = zero(input.payment.currency);
  for (const line of input.lines) {
    const { obligation, amount } = line;
    if (!obligation.id || obligationIds.has(obligation.id)) throw new AllocationValidationError('Duplicate obligation lines must be consolidated before confirmation');
    obligationIds.add(obligation.id);
    if (obligation.institutionId !== input.payment.institutionId) throw new AllocationValidationError('Allocation institution must match the Payment');
    if (obligation.financialAccountId !== input.payment.financialAccountId) throw new AllocationValidationError('Allocation financial account must match the Payment');
    if (obligation.currency !== input.payment.currency || amount.currency !== input.payment.currency || obligation.remainingCoverable.currency !== input.payment.currency) throw new AllocationValidationError('Allocation currency must match the Payment and Obligation');
    requirePositive(amount, 'Allocation Money must be strictly positive');
    if (amount.compare(obligation.remainingCoverable) > 0) throw new AllocationValidationError('Allocation amount exceeds Obligation remaining coverable value');
    total = total.add(amount);
  }
  if (total.compare(input.payment.remainingAllocatable) > 0) throw new AllocationValidationError('Allocation total exceeds Payment remaining allocatable value');
  return { ...input, lines: [...input.lines], total };
}

export function normalizeReverseAllocationInput(input: ReverseAllocationInput): ReverseAllocationInput {
  requireValidDate(input.effectiveAt);
  if (!input.originalAllocationId) throw new AllocationValidationError('Original Allocation is required');
  if (input.amount.currency !== input.currency || input.remainingReversible.currency !== input.currency) throw new AllocationValidationError('Allocation reversal currency must match the original Allocation');
  requirePositive(input.amount, 'Allocation reversal Money must be strictly positive');
  if (input.amount.compare(input.remainingReversible) > 0) throw new AllocationValidationError('Allocation reversal exceeds remaining reversible value');
  const reason = input.reason.trim();
  if (!reason) throw new AllocationValidationError('Allocation reversal reason is required');
  return { ...input, reason };
}
