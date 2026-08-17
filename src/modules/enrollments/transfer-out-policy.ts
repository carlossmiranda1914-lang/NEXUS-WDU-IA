import type { InstitutionalRole } from '../../auth/institutional-context.ts';

export const TRANSFER_OUT_STATUSES = ['draft', 'submitted', 'awaiting_resolution', 'approved', 'rejected', 'withdrawn'] as const;
export type TransferOutStatus = (typeof TRANSFER_OUT_STATUSES)[number];

const transitions: Record<TransferOutStatus, readonly TransferOutStatus[]> = {
  draft: ['submitted', 'withdrawn'], submitted: ['awaiting_resolution', 'approved', 'rejected', 'withdrawn'],
  awaiting_resolution: ['submitted', 'rejected', 'withdrawn'], approved: [], rejected: [], withdrawn: [],
};

export function isTransferOutStatus(value: unknown): value is TransferOutStatus { return typeof value === 'string' && (TRANSFER_OUT_STATUSES as readonly string[]).includes(value); }
export function canPrepareTransferOut(role: InstitutionalRole): boolean { return role === 'secretariat' || role === 'director' || role === 'institution_admin'; }
export function canDecideTransferOut(role: InstitutionalRole): boolean { return role === 'director' || role === 'institution_admin'; }
export function canTransitionTransferOut(role: InstitutionalRole, from: TransferOutStatus, to: TransferOutStatus): boolean {
  if (!transitions[from].includes(to)) return false;
  if (to === 'approved' || to === 'rejected') return canDecideTransferOut(role);
  return canPrepareTransferOut(role);
}
