import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { FinanceAllocationCreateView } from '../src/components/finance/operational/FinanceAllocationCreateView.tsx';
import { allocationClient } from '../src/modules/finance/allocation-client.ts';

const payment: any = { id: 'payment-1', paymentReference: 'REC-1', amount: { amount: '150.00', currency: 'EUR' }, received: { amount: '150.00', currency: 'EUR' }, allocated: { amount: '0.00', currency: 'EUR' }, unapplied: { amount: '150.00', currency: 'EUR' }, status: 'confirmed', method: 'cash', effectiveAt: '2026-01-01', allocationStatus: 'unapplied' };
const obligations: any[] = [
  { id: 'a', description: 'A', amount: { amount: '100.00', currency: 'EUR' }, uncovered: { amount: '100.00', currency: 'EUR' }, status: 'open', effectiveAt: '2026-01-01' },
  { id: 'b', description: 'B', amount: { amount: '30.00', currency: 'EUR' }, uncovered: { amount: '30.00', currency: 'EUR' }, status: 'open', effectiveAt: '2026-01-01' },
  { id: 'wrong-currency', description: 'Wrong currency', amount: { amount: '10.00', currency: 'USD' }, uncovered: { amount: '10.00', currency: 'USD' }, status: 'open', effectiveAt: '2026-01-01' },
  { id: 'covered', description: 'Covered', amount: { amount: '10.00', currency: 'EUR' }, uncovered: { amount: '0', currency: 'EUR' }, status: 'open', effectiveAt: '2026-01-01' },
];
const render = async (onSuccess = () => undefined) => { let renderer!: ReturnType<typeof create>; await act(async () => { renderer = create(React.createElement(FinanceAllocationCreateView, { payment, obligations, onSuccess, onCancel: () => undefined })); }); return renderer; };
const change = async (renderer: ReturnType<typeof create>, id: string, value: string) => { await act(async () => { renderer.root.findByProps({ 'data-testid': `allocation-amount-${id}` }).props.onChange({ target: { value } }); }); };

const renderer = await render();
assert.match(JSON.stringify(renderer.toJSON()), /Distribua o valor recebido pelas cobranças que pretende cobrir/);
assert.match(JSON.stringify(renderer.toJSON()), /Disponível para associar/);
assert.match(JSON.stringify(renderer.toJSON()), /O valor original do recebimento e das cobranças não é alterado/);
assert.match(renderer.root.findByProps({ 'data-testid': 'allocation-amount-a' }).props.className, /dark:bg-zinc-950/);
assert.equal(renderer.root.findAllByProps({ 'data-testid': 'allocation-obligation-a' }).length, 1);
assert.equal(renderer.root.findAllByProps({ 'data-testid': 'allocation-obligation-b' }).length, 1);
assert.equal(renderer.root.findAllByProps({ 'data-testid': 'allocation-obligation-wrong-currency' }).length, 0);
assert.equal(renderer.root.findAllByProps({ 'data-testid': 'allocation-obligation-covered' }).length, 0);
assert.equal(renderer.root.findByProps({ 'data-testid': 'allocation-amount-a' }).props.value, '');
assert.equal(renderer.root.findByProps({ 'data-testid': 'allocation-amount-b' }).props.value, '');
await change(renderer, 'a', '100.00'); await change(renderer, 'b', '20.00');
await act(async () => { renderer.root.findByProps({ 'data-testid': 'allocation-review-btn' }).parent.props.onSubmit({ preventDefault() {} }); });
const review = JSON.stringify(renderer.toJSON()); assert.match(review, /"A"/); assert.match(review, /"100.00"," ","EUR"/); assert.match(review, /"B"/); assert.match(review, /"20.00"," ","EUR"/); assert.match(review, /"30"," ","EUR"," por associar"/);
assert.match(review, /Confirme a distribuição antes de gravar/);
assert.match(review, /Esta operação não altera o valor original do recebimento nem das cobranças/);
let request: any; let refreshed = 0; const originalConfirm = allocationClient.confirm;
(allocationClient as any).confirm = async (input: any) => { request = input; return { allocations: [], replayed: false }; };
try { const confirmed = await render(() => { refreshed += 1; }); await change(confirmed, 'a', '100.00'); await change(confirmed, 'b', '20.00'); await act(async () => { confirmed.root.findByProps({ 'data-testid': 'allocation-review-btn' }).parent.props.onSubmit({ preventDefault() {} }); }); await act(async () => { await confirmed.root.findByProps({ 'data-testid': 'allocation-confirm-btn' }).props.onClick(); }); } finally { (allocationClient as any).confirm = originalConfirm; }
assert.deepEqual({ paymentId: request.paymentId, lines: request.lines }, { paymentId: 'payment-1', lines: [{ obligationId: 'a', amount: '100.00', currency: 'EUR' }, { obligationId: 'b', amount: '20.00', currency: 'EUR' }] }); assert.equal(typeof request.effectiveAt, 'string'); assert.equal(refreshed, 1);
const paymentOverage = await render(); await change(paymentOverage, 'a', '100'); await change(paymentOverage, 'b', '51'); await act(async () => { paymentOverage.root.findByProps({ 'data-testid': 'allocation-review-btn' }).parent.props.onSubmit({ preventDefault() {} }); }); assert.match(JSON.stringify(paymentOverage.toJSON()), /total não pode exceder/);
const obligationOverage = await render(); await change(obligationOverage, 'a', '100.01'); await act(async () => { obligationOverage.root.findByProps({ 'data-testid': 'allocation-review-btn' }).parent.props.onSubmit({ preventDefault() {} }); }); assert.match(JSON.stringify(obligationOverage.toJSON()), /valor não pode exceder o valor por cobrir/);
console.log('MULTI_OBLIGATION_UI=PASS REVIEW_SUMMARY_UI=PASS REMAINDER_UI=PASS PAYMENT_OVERAGE_UI=PASS OBLIGATION_OVERAGE_UI=PASS CANONICAL_CONFIRM_CLIENT_CALL=PASS SUCCESS_REFETCH_PATH=PASS');
