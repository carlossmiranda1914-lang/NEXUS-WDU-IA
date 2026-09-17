import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { FinanceObligationAdjustmentView } from '../src/components/finance/operational/FinanceObligationAdjustmentView.tsx';

const obligation: any = {
  id: 'obligation-1', description: 'Serviço institucional', status: 'open', effectiveAt: '2026-09-01',
  amount: { amount: '100.00', currency: 'EUR' }, original: { amount: '100.00', currency: 'EUR' },
  effectiveDue: { amount: '100.00', currency: 'EUR' }, covered: { amount: '0', currency: 'EUR' },
  remainingCoverable: { amount: '100.00', currency: 'EUR' }, uncovered: { amount: '100.00', currency: 'EUR' },
};
let submitted: any;
let renderer!: ReturnType<typeof create>;
await act(async () => {
  renderer = create(React.createElement(FinanceObligationAdjustmentView, {
    obligations: [obligation], theme: 'light', onCancel: () => undefined,
    onSubmit: async (_id: string, input: unknown) => { submitted = input; },
  }));
});
const text = () => JSON.stringify(renderer.toJSON());
const click = async (label: string) => {
  await act(async () => { renderer.root.findAllByType('button').find((button) => button.children.join('') === label)!.props.onClick(); });
};
const set = async (label: string, value: string) => {
  await act(async () => { renderer.root.findByProps({ 'aria-label': label }).props.onChange({ target: { value } }); });
};

assert.match(text(), /Ajuste financeiro geral/);
assert.doesNotMatch(text(), /Evento de débito sujeito a validação documental/);
await click('↑ Aumentar valor');
assert.match(text(), /Natureza do aumento/);
assert.match(text(), /Evento de débito sujeito a validação documental/);
await click('Evento de débito sujeito a validação documental');
await set('Valor', '10.00');
await set('Motivo obrigatório', 'Aumento factual autorizado');
await act(async () => { await renderer.root.findByProps({ 'data-testid': 'obligation-adjustment-form' }).props.onSubmit({ preventDefault() {} }); });
assert.deepEqual(submitted, { direction: 'increase', amount: '10.00', currency: 'EUR', reason: 'Aumento factual autorizado', basisType: 'debit_event' });
await click('↓ Reduzir valor');
assert.doesNotMatch(text(), /Evento de débito sujeito a validação documental/);
assert.doesNotMatch(text(), /Imposto|tax|Nota de Débito|instituição/i);

console.log('FINANCE_OBLIGATION_ADJUSTMENT_DEBIT_EVENT_UI_CONTRACT=PASS');
