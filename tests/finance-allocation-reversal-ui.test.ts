import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { FinanceAllocationReverseView } from '../src/components/finance/operational/FinanceAllocationReverseView.tsx';
import { FinanceAllocationHistory } from '../src/components/finance/operational/FinanceAllocationHistory.tsx';
import { FinanceOperationalHistory } from '../src/components/finance/operational/FinanceOperationalHistory.tsx';

const allocation = {
  id: 'allocation-1', paymentId: 'payment-1', obligationId: 'obligation-1',
  amount: { amount: '100.00', currency: 'EUR' }, effectiveAt: '2026-09-06T10:00:00.000Z', reversals: [],
};

let reversed: unknown;
let success = 0;
let renderer: ReturnType<typeof create>;
await act(async () => { renderer = create(React.createElement(FinanceAllocationReverseView, {
  allocation, onReverse: async (request: unknown) => { reversed = request; }, onSuccess: () => { success++; }, onCancel: () => undefined,
})); });
const root = renderer.root;
assert.match(JSON.stringify(renderer.toJSON()), /Reverter uma associação não devolve o dinheiro/);
assert.match(JSON.stringify(renderer.toJSON()), /volta a ficar disponível para ser associado novamente/);
assert.match(JSON.stringify(renderer.toJSON()), /Motivo da reversão/);
assert.match(JSON.stringify(renderer.toJSON()), /100\.00 EUR/);
assert.match(JSON.stringify(renderer.toJSON()), /Disponível para reversão/);
assert.equal(root.findAllByProps({ 'data-testid': 'allocation-edit-action' }).length, 0);
assert.equal(root.findAllByProps({ 'data-testid': 'allocation-delete-action' }).length, 0);
assert.doesNotMatch(JSON.stringify(renderer.toJSON()).toLowerCase(), /refund|reembolso/);

await act(async () => { root.findByProps({ 'data-testid': 'allocation-reversal-amount' }).props.onChange({ target: { value: '30.00' } }); });
await act(async () => { await root.findByProps({ 'data-testid': 'allocation-reversal-confirm' }).props.onClick(); });
assert.match(JSON.stringify(renderer.toJSON()), /obrigatória/i);

await act(async () => { root.findByProps({ 'data-testid': 'allocation-reversal-reason' }).props.onChange({ target: { value: 'Erro de imputação' } }); });
await act(async () => { await root.findByProps({ 'data-testid': 'allocation-reversal-confirm' }).props.onClick(); });
assert.deepEqual(reversed, { amount: '30.00', currency: 'EUR', reason: 'Erro de imputação' });
assert.equal(success, 1);
assert.match(JSON.stringify(renderer.toJSON()), /Valor que será revertido/);
assert.match(JSON.stringify(renderer.toJSON()), /A associação original continuará visível no histórico/);

let full: unknown;
await act(async () => { renderer = create(React.createElement(FinanceAllocationReverseView, {
  allocation: { ...allocation, reversals: [{ id: 'reversal-1', amount: { amount: '30.00', currency: 'EUR' }, reason: 'Erro', effectiveAt: '', occurredAt: '' }] },
  onReverse: async (request: unknown) => { full = request; }, onSuccess: () => undefined, onCancel: () => undefined,
})); });
const fullRoot = renderer.root;
assert.match(JSON.stringify(renderer.toJSON()), /30 EUR/);
assert.match(JSON.stringify(renderer.toJSON()), /70 EUR/);
await act(async () => { fullRoot.findByProps({ 'data-testid': 'allocation-reversal-full' }).props.onClick(); });
await act(async () => { fullRoot.findByProps({ 'data-testid': 'allocation-reversal-reason' }).props.onChange({ target: { value: 'Correção total' } }); });
await act(async () => { await fullRoot.findByProps({ 'data-testid': 'allocation-reversal-confirm' }).props.onClick(); });
assert.deepEqual(full, { amount: '70', currency: 'EUR', reason: 'Correção total' });

let history: ReturnType<typeof create>;
await act(async () => { history = create(React.createElement(FinanceAllocationHistory, { history: [{ kind: 'allocation', id: 'history-1', occurredAt: '', allocation: { ...allocation, reversals: [{ id: 'reversal-1', amount: { amount: '30.00', currency: 'EUR' }, reason: 'Erro', effectiveAt: '', occurredAt: '' }] } }] as any })); });
assert.match(JSON.stringify(history.toJSON()), /100\.00.*EUR/);
assert.match(JSON.stringify(history.toJSON()), /Reversão: .*30\.00.*EUR/);

let operationalHistory: ReturnType<typeof create>;
let selectedForReversal: unknown;
await act(async () => { operationalHistory = create(React.createElement(FinanceOperationalHistory, {
  theme: 'dark',
  history: [{ kind: 'allocation', id: 'history-1', occurredAt: '2026-09-06T10:00:00.000Z', allocation: { ...allocation, reversals: [{ id: 'reversal-1', amount: { amount: '30.00', currency: 'EUR' }, reason: 'Erro de imputação', effectiveAt: '', occurredAt: '2026-09-06T11:00:00.000Z' }] } }],
  onReverse: (value: unknown) => { selectedForReversal = value; },
})); });
const operationalText = JSON.stringify(operationalHistory.toJSON());
const visibleText = (node: any): string => typeof node === 'string' ? node : Array.isArray(node) ? node.map(visibleText).join('') : node?.children ? node.children.map(visibleText).join('') : '';
assert.equal(operationalHistory.root.findAllByProps({ 'data-testid': 'history-item-allocation-history-1' }).length, 1);
assert.match(operationalText, /Recebimento associado/);
assert.match(operationalText, /Associação revertida/);
assert.match(operationalText, /100,00 EUR/);
assert.match(operationalText, /30,00 EUR/);
assert.match(operationalText, /Erro de imputação/);
assert.doesNotMatch(visibleText(operationalHistory.toJSON()), /allocation-1/);
const associationEntry = operationalHistory.root.findByProps({ 'data-testid': 'history-item-allocation-history-1' });
const reversalEntry = operationalHistory.root.findByProps({ 'data-testid': 'history-item-reversal-reversal-1' });
assert.match(associationEntry.props.className, /py-3\.5/);
assert.match(associationEntry.props.className, /border-l-2/);
assert.doesNotMatch(associationEntry.props.className, /bg-white|shadow-sm/);
assert.match(reversalEntry.props.className, /ml-5/);
assert.match(reversalEntry.props.className, /border-l-2/);
assert.doesNotMatch(reversalEntry.props.className, /bg-amber-50/);
await act(async () => { operationalHistory.root.findByProps({ 'data-testid': 'allocation-reverse-action-allocation-1' }).props.onClick(); });
assert.equal((selectedForReversal as any).id, allocation.id);
console.log('finance-allocation-reversal-ui: PASS');
