import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { FinanceAllocationCreateView } from '../src/components/finance/operational/FinanceAllocationCreateView.tsx';

const payment: any = { id: 'payment-1', paymentReference: 'REC-1', amount: { amount: '150.00', currency: 'EUR' }, received: { amount: '150.00', currency: 'EUR' }, allocated: { amount: '0.00', currency: 'EUR' }, unapplied: { amount: '150.00', currency: 'EUR' }, status: 'confirmed', method: 'cash', effectiveAt: '2026-01-01', allocationStatus: 'unapplied' };
const obligations: any[] = [
  { id: 'a', description: 'A', amount: { amount: '100.00', currency: 'EUR' }, uncovered: { amount: '100.00', currency: 'EUR' }, status: 'open', effectiveAt: '2026-01-01' },
  { id: 'b', description: 'B', amount: { amount: '30.00', currency: 'EUR' }, uncovered: { amount: '30.00', currency: 'EUR' }, status: 'open', effectiveAt: '2026-01-01' },
  { id: 'wrong', description: 'Wrong', amount: { amount: '10.00', currency: 'USD' }, uncovered: { amount: '10.00', currency: 'USD' }, status: 'open', effectiveAt: '2026-01-01' },
];
let renderer: ReturnType<typeof create>;
await act(async () => { renderer = create(React.createElement(FinanceAllocationCreateView, { payment, obligations, onSuccess: () => undefined, onCancel: () => undefined })); });
const root = renderer.root;
assert.equal(root.findAllByProps({ 'data-testid': 'allocation-obligation-a' }).length, 1);
assert.equal(root.findAllByProps({ 'data-testid': 'allocation-obligation-b' }).length, 1);
assert.equal(root.findAllByProps({ 'data-testid': 'allocation-obligation-wrong' }).length, 0);
assert.equal(root.findAllByProps({ 'data-testid': 'allocation-amount-a' })[0].props.value, '');
assert.match(JSON.stringify(renderer.toJSON()), /Valor recebido/);
console.log('finance-allocation-ui: PASS');
