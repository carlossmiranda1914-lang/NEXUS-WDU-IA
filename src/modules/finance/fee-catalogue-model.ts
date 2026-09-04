import { Money } from './money.ts';

export type FeeCatalogueStatus = 'active' | 'inactive';

export interface FeeCatalogueVersion {
  id: string;
  itemId: string;
  institutionId: string;
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
  code: string;
  status: FeeCatalogueStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  current: FeeCatalogueVersion;
  history?: FeeCatalogueVersion[];
}

export interface CreateFeeCatalogueInput {
  code: string;
  name: string;
  description?: string | null;
  kind: string;
  amount: string;
  currency: string;
  effectiveFrom: string;
}

export interface UpdateFeeCatalogueInput extends Omit<CreateFeeCatalogueInput, 'code'> {
  expectedVersion: number;
}

export class FeeCatalogueValidationError extends Error {
  readonly code = 'FEE_CATALOGUE_VALIDATION';
  constructor(message: string) {
    super(message);
    this.name = 'FeeCatalogueValidationError';
    Object.setPrototypeOf(this, FeeCatalogueValidationError.prototype);
  }
}

export function normalizeFeeCatalogueCreate(input: CreateFeeCatalogueInput): Required<CreateFeeCatalogueInput> {
  const code = text(input.code, 'code').toUpperCase();
  const name = text(input.name, 'name');
  const kind = text(input.kind, 'kind');
  const effectiveFrom = time(input.effectiveFrom);

  let money: Money;
  try {
    const rawAmount = typeof input.amount === 'string' ? input.amount.trim().replace(',', '.') : String(input.amount || '');
    money = Money.parse(rawAmount, input.currency);
  } catch (err: any) {
    throw new FeeCatalogueValidationError(err?.message || 'Montante ou moeda inválida');
  }

  if (money.compare(Money.parse('0', money.currency)) <= 0) {
    throw new FeeCatalogueValidationError('amount must be positive');
  }

  return {
    code,
    name,
    kind,
    description: input.description?.trim() || null,
    amount: money.canonicalAmount(),
    currency: money.currency,
    effectiveFrom,
  };
}

export function normalizeFeeCatalogueUpdate(input: UpdateFeeCatalogueInput): Required<UpdateFeeCatalogueInput> {
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new FeeCatalogueValidationError('expectedVersion must be a positive integer');
  }
  const normalized = normalizeFeeCatalogueCreate({ ...input, code: 'UPDATE' });
  return { ...normalized, expectedVersion: input.expectedVersion };
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
