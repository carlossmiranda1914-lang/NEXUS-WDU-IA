export class FinancialAccountValidationError extends Error {
  readonly code = 'FINANCIAL_ACCOUNT_VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'FinancialAccountValidationError';
  }
}

export type FinancialAccountStatus = 'active' | 'inactive';
export type FinancialAccountPartyRole = 'primary_debtor' | 'co_debtor' | 'guarantor' | 'beneficiary';

export interface FinancialAccountParty {
  id: string;
  financialAccountId: string;
  personId: string;
  personName?: string;
  role: FinancialAccountPartyRole;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface FinancialAccount {
  id: string;
  institutionId: string;
  accountNumber: string;
  name: string;
  status: FinancialAccountStatus;
  primaryParty?: FinancialAccountParty;
  parties?: FinancialAccountParty[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateFinancialAccountInput {
  primaryPersonId: string;
  name?: string;
}

export interface UpdateFinancialAccountInput {
  name?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeCreateFinancialAccount(input: unknown): CreateFinancialAccountInput {
  if (typeof input !== 'object' || input === null) {
    throw new FinancialAccountValidationError('Dados da conta financeira inválidos.');
  }
  const raw = input as Partial<CreateFinancialAccountInput> & { personId?: string };
  const primaryPersonId = typeof raw.primaryPersonId === 'string'
    ? raw.primaryPersonId.trim()
    : typeof raw.personId === 'string'
      ? raw.personId.trim()
      : '';
  if (!primaryPersonId || !UUID_REGEX.test(primaryPersonId)) {
    throw new FinancialAccountValidationError('Identificador de pessoa responsável principal inválido.');
  }

  let name: string | undefined = undefined;
  if (typeof raw.name === 'string' && raw.name.trim().length > 0) {
    const trimmed = raw.name.trim();
    if (trimmed.length < 2 || trimmed.length > 255) {
      throw new FinancialAccountValidationError('O nome da conta financeira deve ter entre 2 e 255 caracteres.');
    }
    name = trimmed;
  }

  return { primaryPersonId, ...(name ? { name } : {}) };
}

export function normalizeUpdateFinancialAccount(input: unknown): UpdateFinancialAccountInput {
  if (typeof input !== 'object' || input === null) {
    throw new FinancialAccountValidationError('Dados de atualização inválidos.');
  }
  const raw = input as Partial<UpdateFinancialAccountInput>;
  const res: UpdateFinancialAccountInput = {};
  if (raw.name !== undefined) {
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name || name.length < 2 || name.length > 255) {
      throw new FinancialAccountValidationError('O nome da conta financeira deve ter entre 2 e 255 caracteres.');
    }
    res.name = name;
  }
  return res;
}
