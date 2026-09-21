import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { FinanceOperationalHistory } from '../src/components/finance/operational/FinanceOperationalHistory.tsx';

const payment = (id: string, allocationPosition: 'unapplied' | 'partially_allocated' | 'fully_allocated') => ({
  kind: 'payment' as const,
  id,
  occurredAt: '2026-09-21T10:00:00.000Z',
  payment: {
    id,
    paymentReference: `PAG-${id}`,
    amount: { amount: '100.00', currency: 'EUR' },
    received: { amount: '100.00', currency: 'EUR' },
    allocated: { amount: allocationPosition === 'unapplied' ? '0.00' : allocationPosition === 'partially_allocated' ? '40.00' : '100.00', currency: 'EUR' },
    unapplied: { amount: allocationPosition === 'unapplied' ? '100.00' : allocationPosition === 'partially_allocated' ? '60.00' : '0.00', currency: 'EUR' },
    allocationPosition,
    method: 'cash',
    effectiveAt: '2026-09-21T10:00:00.000Z',
    status: 'confirmed',
    allocationStatus: allocationPosition,
  },
});

let renderer!: ReturnType<typeof create>;
await act(async () => {
  renderer = create(React.createElement(FinanceOperationalHistory, {
    theme: 'light',
    history: [
      payment('not-allocated', 'unapplied'),
      payment('partially-allocated', 'partially_allocated'),
      payment('fully-allocated', 'fully_allocated'),
    ],
  }));
});

const textFor = (id: string) => renderer.root
  .findByProps({ 'data-testid': `history-item-payment-${id}` })
  .findAllByType('p')
  .flatMap(node => node.children)
  .join('');

assert.match(textFor('not-allocated'), /Confirmado.*Aplica..o:.*N.o aplicado/);
assert.match(textFor('partially-allocated'), /Confirmado.*Aplica..o:.*Parcialmente aplicado/);
assert.match(textFor('fully-allocated'), /Confirmado.*Aplica..o:.*Aplicado/);
assert.doesNotMatch(textFor('partially-allocated'), /Confirmado \(N.o aplicado\)/);
assert.doesNotMatch(textFor('fully-allocated'), /Confirmado \(N.o aplicado\)/);

console.log('PAYMENT_ALLOCATION_HISTORY_UI=PASS CONFIRMATION_SEPARATE_FROM_ALLOCATION=PASS');
