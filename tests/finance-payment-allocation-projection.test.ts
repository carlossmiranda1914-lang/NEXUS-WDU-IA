import assert from 'node:assert/strict';
import test from 'node:test';
import { PostgresPaymentRepository } from '../src/modules/finance/payment-repository.ts';

const row = (allocatedAmount: string) => ({
  id: 'payment-a', institution_id: 'tenant-a', payment_reference: 'PAG-000001', journal_transaction_id: 'journal-a',
  source_type: 'manual_offline', method: 'cash', amount: '40', currency: 'AOA', status: 'confirmed', allocation_status: 'unapplied',
  allocated_amount: allocatedAmount, financial_account_id: null, payer_person_id: null, provider_key: null, provider_event_id: null,
  provider_transaction_ref: null, provider_occurred_at: null, manual_evidence_ref: null, notes: null,
  effective_at: '2026-09-12T10:00:00.000Z', confirmed_at: '2026-09-12T10:00:00.000Z', created_at: '2026-09-12T10:00:00.000Z',
  financial_profile_version: 1, actor_kind: 'human', actor_person_id: null,
});

test('payment list projects current allocation from append-only allocations, not stale confirmation state', async () => {
  let query = '';
  const pool: any = { query: async (sql: string) => { query = sql; return { rows: [row('40')] }; } };
  const payments = await new PostgresPaymentRepository(pool).list({ institutionId: 'tenant-a' });

  assert.match(query, /finance_allocations/, 'payment read must derive current settlement from allocation authority');
  assert.match(query, /finance_allocation_reversals/, 'reversed allocation value must not remain applied');
  assert.equal(payments[0]?.allocationStatus, 'fully_allocated');
});

test('payment projection remains unapplied where no effective allocation exists', async () => {
  const pool: any = { query: async () => ({ rows: [row('0')] }) };
  const payments = await new PostgresPaymentRepository(pool).list({ institutionId: 'tenant-a' });
  assert.equal(payments[0]?.allocationStatus, 'unapplied');
});

test('payment projection is partial where an effective allocation leaves a residual', async () => {
  const pool: any = { query: async () => ({ rows: [row('15')] }) };
  const payments = await new PostgresPaymentRepository(pool).list({ institutionId: 'tenant-a' });
  assert.equal(payments[0]?.allocationStatus, 'partially_allocated');
});

console.log('PAYMENT_ALLOCATION_PROJECTION=PASS');
