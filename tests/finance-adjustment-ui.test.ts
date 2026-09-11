import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { FinanceObligationAdjustmentView } from '../src/components/finance/operational/FinanceObligationAdjustmentView.tsx';
import { FinanceOperationalHistory } from '../src/components/finance/operational/FinanceOperationalHistory.tsx';

const obligation: any = {
  id: 'ob-1', description: 'Mensalidade setembro', status: 'open', effectiveAt: '2026-09-01',
  amount: { amount: '100.00', currency: 'EUR' }, original: { amount: '100.00', currency: 'EUR' },
  effectiveDue: { amount: '80.00', currency: 'EUR' }, covered: { amount: '40.00', currency: 'EUR' },
  remainingCoverable: { amount: '40.00', currency: 'EUR' }, uncovered: { amount: '40.00', currency: 'EUR' },
};

const render = async (theme: 'light' | 'dark' = 'light', onSubmit: (id: string, input: any) => Promise<any> = async () => undefined) => {
  let renderer!: ReturnType<typeof create>;
  await act(async () => { renderer = create(React.createElement(FinanceObligationAdjustmentView, { theme, obligations: [obligation], onCancel: () => undefined, onSubmit })); });
  return renderer;
};
const set = async (renderer: ReturnType<typeof create>, label: string, value: string) => {
  await act(async () => { renderer.root.findByProps({ 'aria-label': label }).props.onChange({ target: { value } }); });
};

const decrease = await render();
await set(decrease, 'Valor', '20.00');
let view = JSON.stringify(decrease.toJSON());
assert.match(view, /O que pretende corrigir/); assert.match(view, /Quanto pretende corrigir/); assert.match(view, /80\.00/); assert.match(view, /60/); assert.match(view, /Ficará por cobrar/); assert.match(view, /20/);
await set(decrease, 'Valor', '50.00');
assert.match(JSON.stringify(decrease.toJSON()), /Este valor não pode ser reduzido/);
await act(async () => { decrease.root.findByProps({ 'data-testid': 'obligation-adjustment-form' }).props.onSubmit({ preventDefault() {} }); });
assert.match(JSON.stringify(decrease.toJSON()), /Este valor não pode ser reduzido/);

const increase = await render();
await act(async () => { increase.root.findAllByType('button').find(button => button.children.join('') === '↑ Aumentar valor')!.props.onClick(); }); await set(increase, 'Valor', '0.10');
view = JSON.stringify(increase.toJSON());
assert.match(view, /↑ Aumentar valor/); assert.match(view, /80\.1/); assert.match(view, /40\.1/);
await act(async () => { increase.root.findByProps({ 'data-testid': 'obligation-adjustment-form' }).props.onSubmit({ preventDefault() {} }); });
assert.match(JSON.stringify(increase.toJSON()), /Indique obrigação, valor e motivo/);

let submitted: any;
const successful = await render('dark', async (_id, input) => { submitted = input; });
await set(successful, 'Valor', '10.00'); await set(successful, 'Motivo obrigatório', 'Acerto aprovado');
await act(async () => { await successful.root.findByProps({ 'data-testid': 'obligation-adjustment-form' }).props.onSubmit({ preventDefault() {} }); });
assert.deepEqual(submitted, { direction: 'decrease', amount: '10.00', currency: 'EUR', reason: 'Acerto aprovado' });
assert.match(JSON.stringify(successful.toJSON()), /bg-zinc-900/);

const failed = await render('light', async () => { throw new Error('Erro do servidor'); });
await set(failed, 'Valor', '10.00'); await set(failed, 'Motivo obrigatório', 'Acerto');
await act(async () => { await failed.root.findByProps({ 'data-testid': 'obligation-adjustment-form' }).props.onSubmit({ preventDefault() {} }); });
assert.match(JSON.stringify(failed.toJSON()), /Erro do servidor/);

let history!: ReturnType<typeof create>;
await act(async () => { history = create(React.createElement(FinanceOperationalHistory, { theme: 'light', history: [
  { kind: 'obligation', id: 'ob-1', occurredAt: '2026-09-01T10:00:00.000Z', obligation },
  { kind: 'adjustment', id: 'adj-1', occurredAt: '2026-09-02T10:00:00.000Z', adjustment: { obligationId: 'ob-1', obligationDescription: 'Mensalidade setembro', direction: 'decrease', amount: { amount: '20.00', currency: 'EUR' }, reason: 'Bolsa parcial' } },
] as any })); });
view = JSON.stringify(history.toJSON());
assert.match(view, /Correção registada/); assert.match(view, /Redução do valor devido/); assert.match(view, /Bolsa parcial/); assert.match(view, /Mensalidade setembro/); assert.equal(history.root.findAllByProps({ 'data-testid': 'history-item-obligation-ob-1' }).length, 1);
console.log('ADJUSTMENT_EXACT_PREVIEW=PASS ADJUSTMENT_FLOOR_PREVIEW=PASS ADJUSTMENT_REASON_AND_SERVER_ERROR=PASS ADJUSTMENT_LIGHT_DARK=PASS ADJUSTMENT_HISTORY=PASS');
