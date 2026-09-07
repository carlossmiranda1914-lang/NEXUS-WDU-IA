import { createCanonicalFinanceFingerprint } from './finance-command.ts';
import { Money } from './money.ts';

export interface AllocationCommandLine { obligationId: string; amount: Money; }
export interface ConfirmAllocationCommand { paymentId: string; lines: readonly AllocationCommandLine[]; effectiveAt: Date; }
export interface ReverseAllocationCommand { originalAllocationId: string; amount: Money; reason: string; effectiveAt: Date; }

export class AllocationCommandValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'AllocationCommandValidationError'; }
}

function date(value: unknown): Date {
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new AllocationCommandValidationError('Allocation effectiveAt is required');
  return parsed;
}

function money(value: unknown, currency?: string): Money {
  if (!value || typeof value !== 'object') throw new AllocationCommandValidationError('Allocation amount is required');
  const raw = value as { amount?: unknown; currency?: unknown };
  // The transport boundary is intentionally lexical.  JavaScript numbers are
  // not an authority for canonical Finance Money because their binary value can
  // silently differ from the decimal amount the operator intended.
  if (typeof raw.amount !== 'string') throw new AllocationCommandValidationError('Allocation amount must be an exact decimal string');
  const parsedCurrency = typeof raw.currency === 'string' ? raw.currency.trim().toUpperCase() : currency;
  if (!parsedCurrency) throw new AllocationCommandValidationError('Allocation currency is required');
  const parsed = Money.parse(raw.amount, parsedCurrency);
  if (parsed.compare(Money.parse('0', parsedCurrency)) <= 0) throw new AllocationCommandValidationError('Allocation amount must be strictly positive');
  return parsed;
}

export function normalizeConfirmAllocationCommand(rawInput: unknown): ConfirmAllocationCommand {
  if (!rawInput || typeof rawInput !== 'object') throw new AllocationCommandValidationError('Allocation command is invalid');
  const raw = rawInput as { paymentId?: unknown; lines?: unknown; effectiveAt?: unknown };
  if (typeof raw.paymentId !== 'string' || !raw.paymentId.trim() || !Array.isArray(raw.lines) || raw.lines.length === 0) throw new AllocationCommandValidationError('Payment and allocation lines are required');
  const seen = new Set<string>();
  const lines = raw.lines.map((line): AllocationCommandLine => {
    if (!line || typeof line !== 'object') throw new AllocationCommandValidationError('Allocation line is invalid');
    const value = line as { obligationId?: unknown; amount?: unknown; currency?: unknown };
    if (typeof value.obligationId !== 'string' || !value.obligationId.trim() || seen.has(value.obligationId.trim())) throw new AllocationCommandValidationError('Allocation obligation lines must be unique');
    seen.add(value.obligationId.trim());
    return { obligationId: value.obligationId.trim(), amount: money({ amount: value.amount, currency: value.currency }) };
  }).sort((left, right) => left.obligationId.localeCompare(right.obligationId));
  return { paymentId: raw.paymentId.trim(), lines, effectiveAt: date(raw.effectiveAt) };
}

export function normalizeReverseAllocationCommand(rawInput: unknown): ReverseAllocationCommand {
  if (!rawInput || typeof rawInput !== 'object') throw new AllocationCommandValidationError('Allocation reversal command is invalid');
  const raw = rawInput as { originalAllocationId?: unknown; amount?: unknown; currency?: unknown; reason?: unknown; effectiveAt?: unknown };
  if (typeof raw.originalAllocationId !== 'string' || !raw.originalAllocationId.trim()) throw new AllocationCommandValidationError('Original Allocation is required');
  if (typeof raw.reason !== 'string' || !raw.reason.trim()) throw new AllocationCommandValidationError('Allocation reversal reason is required');
  return { originalAllocationId: raw.originalAllocationId.trim(), amount: money({ amount: raw.amount, currency: raw.currency }), reason: raw.reason.trim(), effectiveAt: date(raw.effectiveAt) };
}

export function createConfirmAllocationFingerprint(institutionId: string, command: ConfirmAllocationCommand): string {
  return createCanonicalFinanceFingerprint({ institutionId, operation: 'finance.allocation.confirm', paymentId: command.paymentId, lines: command.lines.map((line) => ({ obligationId: line.obligationId, money: line.amount.serialize() })), effectiveAt: command.effectiveAt.toISOString() });
}

export function createReverseAllocationFingerprint(institutionId: string, command: ReverseAllocationCommand): string {
  return createCanonicalFinanceFingerprint({ institutionId, operation: 'finance.allocation.reverse', originalAllocationId: command.originalAllocationId, money: command.amount.serialize(), reason: command.reason, effectiveAt: command.effectiveAt.toISOString() });
}
