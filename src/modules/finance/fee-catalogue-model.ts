import { Money } from './money.ts';

export type FeeCatalogueStatus = 'active' | 'inactive';

export interface FeeTypeSummary {
  id: string;
  displayName: string;
  codePrefix: string;
  canonicalKey?: string | null;
}

export interface FeeCatalogueVersion {
  id: string;
  itemId: string;
  institutionId: string;
  feeTypeId: string;
  feeType?: FeeTypeSummary;
  version: number;
  name: string;
  description: string | null;
  kind: string;
  money: { amount: string; currency: string };
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
}

export interface FeeCatalogueItem {
  id: string;
  institutionId: string;
  feeTypeId: string;
  feeType?: FeeTypeSummary;
  code: string;
  status: FeeCatalogueStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  current: FeeCatalogueVersion;
  history?: FeeCatalogueVersion[];
}

export interface CreateFeeCatalogueInput {
  feeTypeId: string;
  name: string;
  description?: string | null;
  amount: string;
  currency: string;
  effectiveFrom: string;
  // Legacy optional field (ignored if provided, server generates code)
  code?: string;
  // P1-03: kind is NOT accepted as user input. Classification authority is fee_type_id.
  // kind is compatibility-only derived data written by the server from the referenced fee type.
  // Removal boundary: Phase 2, once all consumers migrate to fee_type_id.
}

export interface UpdateFeeCatalogueInput {
  expectedVersion: number;
  feeTypeId?: string | null;
  name: string;
  description?: string | null;
  amount: string;
  currency: string;
  effectiveFrom: string;
  // P1-03: kind is NOT accepted as user input. Classification authority is fee_type_id.
  // kind is compatibility-only derived data written by the server from the referenced fee type.
}

export class FeeCatalogueValidationError extends Error {
  readonly code = 'FEE_CATALOGUE_VALIDATION';
  constructor(message: string) {
    super(message);
    this.name = 'FeeCatalogueValidationError';
    Object.setPrototypeOf(this, FeeCatalogueValidationError.prototype);
  }
}

export function normalizeFeeCatalogueCreate(input: CreateFeeCatalogueInput): {
  feeTypeId: string;
  name: string;
  description: string | null;
  amount: string;
  currency: string;
  effectiveFrom: string;
} {
  const feeTypeId = text(input.feeTypeId, 'feeTypeId');
  const name = text(input.name, 'name');
  const effectiveFrom = time(input.effectiveFrom);

  let money: Money;
  try {
    const rawAmount = typeof input.amount === 'string' ? input.amount.trim().replace(',', '.') : String(input.amount || '');
    money = Money.parse(rawAmount, input.currency);
  } catch (err: any) {
    throw new FeeCatalogueValidationError(err?.message || 'Montante ou moeda invÃ¡lida');
  }

  if (money.compare(Money.parse('0', money.currency)) <= 0) {
    throw new FeeCatalogueValidationError('amount must be positive');
  }

  return {
    feeTypeId,
    name,
    description: input.description?.trim() || null,
    amount: money.canonicalAmount(),
    currency: money.currency,
    effectiveFrom,
  };
}

export function normalizeFeeCatalogueUpdate(input: UpdateFeeCatalogueInput): {
  expectedVersion: number;
  feeTypeId?: string | null;
  name: string;
  description: string | null;
  amount: string;
  currency: string;
  effectiveFrom: string;
} {
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new FeeCatalogueValidationError('expectedVersion must be a positive integer');
  }

  const name = text(input.name, 'name');
  const effectiveFrom = time(input.effectiveFrom);

  let money: Money;
  try {
    const rawAmount = typeof input.amount === 'string' ? input.amount.trim().replace(',', '.') : String(input.amount || '');
    money = Money.parse(rawAmount, input.currency);
  } catch (err: any) {
    throw new FeeCatalogueValidationError(err?.message || 'Montante ou moeda invÃ¡lida');
  }

  if (money.compare(Money.parse('0', money.currency)) <= 0) {
    throw new FeeCatalogueValidationError('amount must be positive');
  }

  const feeTypeId = input.feeTypeId ? text(input.feeTypeId, 'feeTypeId') : null;

  return {
    expectedVersion: input.expectedVersion,
    feeTypeId,
    name,
    description: input.description?.trim() || null,
    amount: money.canonicalAmount(),
    currency: money.currency,
    effectiveFrom,
  };
}

function text(value: string, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new FeeCatalogueValidationError(`${field} is required`);
  return normalized;
}

function time(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new FeeCatalogueValidationError('effectiveFrom is invalid');
  return date.toISOString();
}
