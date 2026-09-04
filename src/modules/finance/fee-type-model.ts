export type FeeTypeStatus = 'active' | 'inactive';
export type FeeTypeSource = 'nexus_base' | 'institution_custom';

export interface FeeType {
  id: string;
  institutionId: string;
  canonicalKey: string | null;
  source: FeeTypeSource;
  displayName: string;
  codePrefix: string;
  status: FeeTypeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeeTypeInput {
  displayName: string;
  codePrefix: string;
}

export interface UpdateFeeTypeInput {
  displayName: string;
  codePrefix?: string;
}

export class FeeTypeValidationError extends Error {
  readonly code = 'FEE_TYPE_VALIDATION';
  constructor(message: string) {
    super(message);
    this.name = 'FeeTypeValidationError';
    Object.setPrototypeOf(this, FeeTypeValidationError.prototype);
  }
}

export const NEXUS_BASELINE_FEE_TYPES = [
  { canonicalKey: 'tuition', displayName: 'Propina / Mensalidade', codePrefix: 'PROP' },
  { canonicalKey: 'enrollment', displayName: 'Matrícula / Inscrição', codePrefix: 'MATR' },
  { canonicalKey: 'examination', displayName: 'Exames / Avaliação', codePrefix: 'EXAM' },
  { canonicalKey: 'document', displayName: 'Certificados / Documentos', codePrefix: 'DOC' },
  { canonicalKey: 'transport', displayName: 'Transporte Escolar', codePrefix: 'TRAN' },
  { canonicalKey: 'meals', displayName: 'Refeições / Cantina', codePrefix: 'ALIM' },
  { canonicalKey: 'activity', displayName: 'Atividades Extracurriculares', codePrefix: 'ACT' },
  { canonicalKey: 'service', displayName: 'Serviços Administrativos', codePrefix: 'SERV' },
  { canonicalKey: 'penalty', displayName: 'Multas / Juros Administrativos', codePrefix: 'MULT' },
  { canonicalKey: 'other', displayName: 'Outros Emolumentos', codePrefix: 'DIV' },
] as const;

export function normalizeFeeTypeCreate(input: CreateFeeTypeInput): Required<CreateFeeTypeInput> {
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
  if (!displayName) {
    throw new FeeTypeValidationError('displayName is required');
  }
  if (displayName.length > 100) {
    throw new FeeTypeValidationError('displayName exceeds maximum length of 100 characters');
  }

  const rawPrefix = typeof input.codePrefix === 'string' ? input.codePrefix.trim().toUpperCase() : '';
  if (!rawPrefix) {
    throw new FeeTypeValidationError('codePrefix is required');
  }
  if (!/^[A-Z0-9]{2,8}$/.test(rawPrefix)) {
    throw new FeeTypeValidationError('codePrefix must be 2 to 8 uppercase alphanumeric characters');
  }

  return {
    displayName,
    codePrefix: rawPrefix,
  };
}

export function normalizeFeeTypeUpdate(input: UpdateFeeTypeInput): Required<UpdateFeeTypeInput> {
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
  if (!displayName) {
    throw new FeeTypeValidationError('displayName is required');
  }
  if (displayName.length > 100) {
    throw new FeeTypeValidationError('displayName exceeds maximum length of 100 characters');
  }

  let codePrefix = '';
  if (input.codePrefix !== undefined) {
    const rawPrefix = typeof input.codePrefix === 'string' ? input.codePrefix.trim().toUpperCase() : '';
    if (!rawPrefix) {
      throw new FeeTypeValidationError('codePrefix cannot be empty');
    }
    if (!/^[A-Z0-9]{2,8}$/.test(rawPrefix)) {
      throw new FeeTypeValidationError('codePrefix must be 2 to 8 uppercase alphanumeric characters');
    }
    codePrefix = rawPrefix;
  }

  return {
    displayName,
    codePrefix,
  };
}
