import { Money } from './money.ts';
import type { FinancialContext } from './financial-context.ts';

export class PaymentValidationError extends Error {
  readonly code = 'PAYMENT_VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'PaymentValidationError';
  }
}

export type PaymentSourceType = 'manual_offline' | 'provider';
export type ManualPaymentMethod = 'cash' | 'bank_transfer' | 'external_reference';
export type PaymentStatus = 'confirmed';
export type PaymentAllocationStatus = 'unapplied';

export interface Payment {
  id: string;
  institutionId: string;
  paymentReference: string;
  journalTransactionId: string;
  sourceType: PaymentSourceType;
  method: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  allocationStatus: PaymentAllocationStatus;
  financialAccountId?: string;
  payerPersonId?: string;
  providerKey?: string;
  providerEventId?: string;
  providerTransactionRef?: string;
  providerOccurredAt?: string;
  manualEvidenceRef?: string;
  notes?: string;
  effectiveAt: string;
  confirmedAt: string;
  createdAt: string;
  financialProfileVersion: number;
  actorPersonId: string;
}

export interface ConfirmIncomingPaymentIntent {
  institutionId: string;
  sourceType: PaymentSourceType;
  method: string;
  money: Money;
  effectiveAt: Date;
  financialAccountId?: string;
  payerPersonId?: string;
  providerKey?: string;
  providerEventId?: string;
  providerTransactionRef?: string;
  providerOccurredAt?: Date;
  manualEvidenceRef?: string;
  notes?: string;
  actorPersonId: string;
  financialProfileVersion: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeConfirmIncomingPaymentIntent(
  rawInput: unknown,
  context: FinancialContext,
  actorPersonId: string
): ConfirmIncomingPaymentIntent {
  if (typeof rawInput !== 'object' || rawInput === null) {
    throw new PaymentValidationError('Dados do recebimento inválidos.');
  }

  if (!context || !context.institutionId || !UUID_REGEX.test(context.institutionId)) {
    throw new PaymentValidationError('Contexto institucional inválido.');
  }

  if (!actorPersonId || !UUID_REGEX.test(actorPersonId)) {
    throw new PaymentValidationError('Identificador de operador/ator inválido.');
  }

  if (!Number.isInteger(context.financialProfileVersion) || context.financialProfileVersion <= 0) {
    throw new PaymentValidationError('Versão do perfil financeiro institucional inválida.');
  }

  const raw = rawInput as Record<string, unknown>;

  // Source type validation
  const sourceType = raw.sourceType;
  if (sourceType !== 'manual_offline' && sourceType !== 'provider') {
    throw new PaymentValidationError('Tipo de origem do pagamento deve ser "manual_offline" ou "provider".');
  }

  // Method validation
  if (typeof raw.method !== 'string' || !raw.method.trim()) {
    throw new PaymentValidationError('Método de pagamento é obrigatório.');
  }
  const method = raw.method.trim();

  if (sourceType === 'manual_offline') {
    const validManualMethods: ManualPaymentMethod[] = ['cash', 'bank_transfer', 'external_reference'];
    if (!validManualMethods.includes(method as ManualPaymentMethod)) {
      throw new PaymentValidationError(`Método manual "${method}" não é suportado. Utilize cash, bank_transfer ou external_reference.`);
    }
    if (raw.providerKey || raw.providerEventId || raw.providerTransactionRef) {
      throw new PaymentValidationError('Campos de provedor externo não são permitidos em pagamentos manuais/offline.');
    }
  }

  // Money / Currency validation
  const rawCurrency = typeof raw.currency === 'string' ? raw.currency.trim().toUpperCase() : context.functionalCurrency;
  if (!context.enabledCurrencies.includes(rawCurrency)) {
    throw new PaymentValidationError(`Moeda "${rawCurrency}" não habilitada no perfil financeiro da instituição.`);
  }

  if (typeof raw.amount !== 'string' && typeof raw.amount !== 'number') {
    throw new PaymentValidationError('Valor do recebimento é obrigatório.');
  }

  let money: Money;
  try {
    money = Money.parse(String(raw.amount), rawCurrency);
  } catch (err: any) {
    throw new PaymentValidationError(err?.message ?? 'Valor monetário inválido.');
  }

  const zeroMoney = Money.parse('0', rawCurrency);
  if (money.compare(zeroMoney) <= 0) {
    throw new PaymentValidationError('O valor do recebimento deve ser estritamente positivo.');
  }

  // Effective date validation
  let effectiveAt: Date;
  if (raw.effectiveAt instanceof Date) {
    effectiveAt = raw.effectiveAt;
  } else if (typeof raw.effectiveAt === 'string' && raw.effectiveAt.trim()) {
    effectiveAt = new Date(raw.effectiveAt);
  } else {
    effectiveAt = new Date();
  }

  if (Number.isNaN(effectiveAt.getTime())) {
    throw new PaymentValidationError('Data efetiva do pagamento inválida.');
  }

  // Optional relations
  let financialAccountId: string | undefined = undefined;
  if (raw.financialAccountId !== undefined && raw.financialAccountId !== null && raw.financialAccountId !== '') {
    if (typeof raw.financialAccountId !== 'string' || !UUID_REGEX.test(raw.financialAccountId.trim())) {
      throw new PaymentValidationError('Identificador de conta financeira inválido.');
    }
    financialAccountId = raw.financialAccountId.trim();
  }

  let payerPersonId: string | undefined = undefined;
  if (raw.payerPersonId !== undefined && raw.payerPersonId !== null && raw.payerPersonId !== '') {
    if (typeof raw.payerPersonId !== 'string' || !UUID_REGEX.test(raw.payerPersonId.trim())) {
      throw new PaymentValidationError('Identificador de pessoa pagadora inválido.');
    }
    payerPersonId = raw.payerPersonId.trim();
  }

  // Provider specific validations
  let providerKey: string | undefined = undefined;
  let providerEventId: string | undefined = undefined;
  let providerTransactionRef: string | undefined = undefined;
  let providerOccurredAt: Date | undefined = undefined;

  if (sourceType === 'provider') {
    if (typeof raw.providerKey !== 'string' || !raw.providerKey.trim()) {
      throw new PaymentValidationError('Identificador do provedor (providerKey) é obrigatório para origem provider.');
    }
    providerKey = raw.providerKey.trim().toLowerCase();

    if (typeof raw.providerEventId !== 'string' || !raw.providerEventId.trim()) {
      throw new PaymentValidationError('Identificador do evento do provedor (providerEventId) é obrigatório para origem provider.');
    }
    providerEventId = raw.providerEventId.trim();

    if (typeof raw.providerTransactionRef !== 'string' || !raw.providerTransactionRef.trim()) {
      throw new PaymentValidationError('Referência de transação do provedor (providerTransactionRef) é obrigatória para origem provider.');
    }
    providerTransactionRef = raw.providerTransactionRef.trim();

    if (raw.providerOccurredAt instanceof Date) {
      providerOccurredAt = raw.providerOccurredAt;
    } else if (typeof raw.providerOccurredAt === 'string' && raw.providerOccurredAt.trim()) {
      providerOccurredAt = new Date(raw.providerOccurredAt);
    } else {
      providerOccurredAt = effectiveAt;
    }

    if (Number.isNaN(providerOccurredAt.getTime())) {
      throw new PaymentValidationError('Data de ocorrência do provedor inválida.');
    }
  }

  // Manual specific fields
  let manualEvidenceRef: string | undefined = undefined;
  if (typeof raw.manualEvidenceRef === 'string' && raw.manualEvidenceRef.trim()) {
    manualEvidenceRef = raw.manualEvidenceRef.trim();
  }

  let notes: string | undefined = undefined;
  if (typeof raw.notes === 'string' && raw.notes.trim()) {
    notes = raw.notes.trim();
  }

  return {
    institutionId: context.institutionId,
    sourceType,
    method,
    money,
    effectiveAt,
    financialAccountId,
    payerPersonId,
    providerKey,
    providerEventId,
    providerTransactionRef,
    providerOccurredAt,
    manualEvidenceRef,
    notes,
    actorPersonId,
    financialProfileVersion: context.financialProfileVersion,
  };
}
