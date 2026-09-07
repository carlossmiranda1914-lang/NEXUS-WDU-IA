import { auth } from '../../lib/firebase.ts';
import type { FinanceMoneyAmount } from './finance-operational-context-model.ts';

export class AllocationApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); this.name = 'AllocationApiError'; }
}

export type AllocationClientOptions = { fetcher?: typeof fetch; getToken?: () => Promise<string | null | undefined> };
export type ConfirmAllocationRequest = { paymentId: string; lines: Array<{ obligationId: string; amount: string; currency: string }>; effectiveAt?: string | Date };
export type ReverseAllocationRequest = { amount: string; currency: string; reason: string; effectiveAt?: string | Date };
export type AllocationClientFact = { id: string; financialAccountId: string; paymentId: string; obligationId: string; money: FinanceMoneyAmount; effectiveAt: string; recordedAt: string; status: 'confirmed' };

const defaultFetch: typeof fetch = (input, init) => typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch(input, init) : globalThis.fetch(input, init);
const defaultGetToken = async () => auth.currentUser?.getIdToken() ?? null;
const key = (prefix: string) => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class AllocationApiClient {
  private readonly fetcher: typeof fetch;
  private readonly getToken: () => Promise<string | null | undefined>;
  constructor(options?: AllocationClientOptions) { this.fetcher = options?.fetcher || defaultFetch; this.getToken = options?.getToken || defaultGetToken; }
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getToken().catch(() => null);
    const response = await this.fetcher(path, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...((init?.headers as Record<string, string>) || {}) } });
    if (!response.ok) {
      let body: any = {}; try { body = await response.json(); } catch { /* response may be empty */ }
      throw new AllocationApiError(response.status, body?.code || (response.status === 401 ? 'UNAUTHORIZED' : response.status === 403 ? 'ALLOCATION_FORBIDDEN' : 'ALLOCATION_ERROR'), body?.message || body?.error || `Erro HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
  }
  confirm(input: ConfirmAllocationRequest, idempotencyKey = key('allocation-confirm')): Promise<{ allocations: AllocationClientFact[]; replayed: boolean }> {
    return this.request('/api/finance/allocations', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(input) });
  }
  reverse(allocationId: string, input: ReverseAllocationRequest, idempotencyKey = key('allocation-reverse')): Promise<{ reversal: unknown; replayed: boolean }> {
    return this.request(`/api/finance/allocations/${encodeURIComponent(allocationId)}/reversals`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(input) });
  }
  listForPayment(paymentId: string): Promise<{ allocations: AllocationClientFact[] }> { return this.request(`/api/finance/allocations?paymentId=${encodeURIComponent(paymentId)}`); }
}

export const allocationClient = new AllocationApiClient();
