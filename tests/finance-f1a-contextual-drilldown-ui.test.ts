import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { fileURLToPath } from 'node:url';
import { FinanceOperationalTruthPanels } from '../src/components/finance/operational/FinanceOperationalTruthPanels.tsx';
import { FinanceOperationalHistory } from '../src/components/finance/operational/FinanceOperationalHistory.tsx';

const obligation = { id: 'obligation-1', description: 'Propina', amount: { amount: '100.00', currency: 'EUR' }, effectiveAt: '2026-09-01T00:00:00.000Z', status: 'open' };
const payment = { id: 'payment-1', paymentReference: 'PAG-1', amount: { amount: '100.00', currency: 'EUR' }, received: { amount: '100.00', currency: 'EUR' }, allocationPosition: 'unapplied', method: 'cash', effectiveAt: '2026-09-02T00:00:00.000Z', status: 'confirmed' };
const allocation = { id: 'allocation-1', paymentId: payment.id, obligationId: obligation.id, amount: payment.amount, effectiveAt: '2026-09-03T00:00:00.000Z', reversals: [] };

let openedObligation: string | undefined;
let openedPayment: string | undefined;
let panels!: ReturnType<typeof create>;
await act(async () => { panels = create(React.createElement(FinanceOperationalTruthPanels, { openObligations: [obligation] as any, confirmedUnallocatedPayments: [payment] as any, onOpenObligation: id => { openedObligation = id; }, onOpenPayment: id => { openedPayment = id; } })); });
await act(async () => { panels.root.findByProps({ 'data-testid': 'obligation-actions-obligation-1' }).props.onClick(); });
await act(async () => { panels.root.findByProps({ 'data-testid': 'open-obligation-obligation-1' }).props.onClick(); });
await act(async () => { panels.root.findByProps({ 'data-testid': 'open-payment-payment-1' }).props.onClick(); });
assert.equal(openedObligation, obligation.id);
assert.equal(openedPayment, payment.id);

let allocationPayment: string | undefined;
let allocationObligation: string | undefined;
let history!: ReturnType<typeof create>;
await act(async () => { history = create(React.createElement(FinanceOperationalHistory, { history: [{ kind: 'allocation', id: allocation.id, occurredAt: allocation.effectiveAt, allocation }] as any, onOpenPayment: id => { allocationPayment = id; }, onOpenObligation: id => { allocationObligation = id; } })); });
await act(async () => { history.root.findByProps({ 'data-testid': 'allocation-open-payment-allocation-1' }).props.onClick(); });
await act(async () => { history.root.findByProps({ 'data-testid': 'allocation-open-obligation-allocation-1' }).props.onClick(); });
assert.equal(allocationPayment, payment.id);
assert.equal(allocationObligation, obligation.id);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = fs.readFileSync(path.join(root, 'src/components/finance/FinanceWorkspace.tsx'), 'utf8');
const operational = fs.readFileSync(path.join(root, 'src/components/finance/operational/FinanceOperationalContextWorkspace.tsx'), 'utf8');
assert.match(workspace, /operationsReturnAccountId/);
assert.match(workspace, /data-testid="return-to-financial-situation"/);
assert.match(workspace, /initialPaymentId=\{selectedPaymentId\}/);
assert.match(operational, /onOpenObligation\?\.\(obligationId, context\.financialAccount\.id\)/);
assert.match(operational, /onOpenPayment\?\.\(paymentId, context\.financialAccount\.id\)/);
console.log('FINANCE_F1A_CONTEXTUAL_DRILLDOWN_UI=PASS');
