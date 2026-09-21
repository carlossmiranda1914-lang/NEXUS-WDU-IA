export class FinancialObligationValidationError extends Error {
  readonly code = 'FINANCIAL_OBLIGATION_VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'FinancialObligationValidationError';
  }
}

export type FinancialObligationStatus = 'open' | 'cancelled';
export type FinancialObligationSourceType = 'manual_finance' | 'enrollment' | 'academic_process' | 'service_request';

export interface FinancialObligation {
  id: string;
  institutionId: string;
  financialAccountId: string;
  accountNumber?: string;
  accountName?: string;
  beneficiaryPersonId?: string | null;
  beneficiaryName?: string | null;
  feeCatalogueItemId: string;
  feeCatalogueVersion: number;
  feeItemCode?: string;
  feeItemName?: string;
  sourceType: FinancialObligationSourceType;
  sourceRef: string;
  money: {
    amount: string;
    currency: string;
  };
  effectiveAt: string;
  dueAt?: string | null;
  status: FinancialObligationStatus;
  notes?: string | null;
  financialProfileVersion: number;
  createdByPersonId: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssueObligationInput {
  financialAccountId: string;
  feeCatalogueItemId: string;
  beneficiaryPersonId?: string | null;
  dueAt?: string | null;
  notes?: string | null;
  sourceType?: FinancialObligationSourceType;
  sourceRef?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeIssueObligationInput(input: unknown): IssueObligationInput {
  if (typeof input !== 'object' || input === null) {
    throw new FinancialObligationValidationError('Dados da obrigação financeira inválidos.');
  }
  const raw = input as Record<string, unknown>;

  // Amount cannot be authored by the client — reject if passed
  if (raw.amount !== undefined) {
    throw new FinancialObligationValidationError(
      'O valor financeiro não pode ser definido diretamente pelo cliente; é obtido a partir da autoridade do Catálogo de Emolumentos.',
    );
  }

  const financialAccountId = typeof raw.financialAccountId === 'string' ? raw.financialAccountId.trim() : '';
  if (!financialAccountId || !UUID_REGEX.test(financialAccountId)) {
    throw new FinancialObligationValidationError('Identificador de conta financeira inválido.');
  }

  const feeCatalogueItemId = typeof raw.feeCatalogueItemId === 'string' ? raw.feeCatalogueItemId.trim() : '';
  if (!feeCatalogueItemId || !UUID_REGEX.test(feeCatalogueItemId)) {
    throw new FinancialObligationValidationError('Identificador de item do catálogo de emolumentos inválido.');
  }

  let beneficiaryPersonId: string | null = null;
  if (raw.beneficiaryPersonId !== undefined && raw.beneficiaryPersonId !== null && raw.beneficiaryPersonId !== '') {
    const bId = String(raw.beneficiaryPersonId).trim();
    if (!UUID_REGEX.test(bId)) {
      throw new FinancialObligationValidationError('Identificador de beneficiário inválido.');
    }
    beneficiaryPersonId = bId;
  }

  let dueAt: string | null = null;
  if (raw.dueAt !== undefined && raw.dueAt !== null && raw.dueAt !== '') {
    const d = new Date(String(raw.dueAt));
    if (Number.isNaN(d.getTime())) {
      throw new FinancialObligationValidationError('Data de vencimento inválida.');
    }
    dueAt = d.toISOString();
  }

  const notes = typeof raw.notes === 'string' ? raw.notes.trim() || null : null;
  const sourceType = (typeof raw.sourceType === 'string' && ['manual_finance', 'enrollment', 'academic_process', 'service_request'].includes(raw.sourceType))
    ? (raw.sourceType as FinancialObligationSourceType)
    : 'manual_finance';
  const sourceRef = typeof raw.sourceRef === 'string' && raw.sourceRef.trim() ? raw.sourceRef.trim() : 'manual';

  return {
    financialAccountId,
    feeCatalogueItemId,
    beneficiaryPersonId,
    dueAt,
    notes,
    sourceType,
    sourceRef,
  };
}
