import type { InstitutionalRole } from '../../auth/institutional-context.ts';

export type PaymentAction = 'read' | 'write' | 'provider_admin';

export class PaymentPermissionError extends Error {
  readonly code = 'PAYMENT_PERMISSION_ERROR';
  constructor(message = 'Sem permissão para aceder ou operar pagamentos.') {
    super(message);
    this.name = 'PaymentPermissionError';
  }
}

export function canAccessPayments(role: InstitutionalRole, action: PaymentAction): boolean {
  if (action === 'read') {
    return role === 'institution_admin' || role === 'financial' || role === 'director';
  }
  if (action === 'write' || action === 'provider_admin') {
    return role === 'institution_admin' || role === 'financial';
  }
  return false;
}

export function requirePaymentRole(role: InstitutionalRole, action: PaymentAction): void {
  if (!canAccessPayments(role, action)) {
    throw new PaymentPermissionError(`A função "${role}" não tem permissão para a ação de pagamento "${action}".`);
  }
}
