import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { fileURLToPath } from 'node:url';
import { FinanceOperationalTruthPanels } from '../src/components/finance/operational/FinanceOperationalTruthPanels.tsx';
import { FinanceOperationalHistory } from '../src/components/finance/operational/FinanceOperationalHistory.tsx';
import { FinanceOperationalContextWorkspace } from '../src/components/finance/operational/FinanceOperationalContextWorkspace.tsx';
import { FinanceOperationalContextClient } from '../src/modules/finance/finance-operational-context-client.ts';
import { FinanceWorkspace } from '../src/components/finance/FinanceWorkspace.tsx';
import { FinancialObligationsWorkspace } from '../src/components/finance/obligations/FinancialObligationsWorkspace.tsx';
import { FinancePaymentsWorkspace } from '../src/components/finance/payments/FinancePaymentsWorkspace.tsx';

const obligation = { id: 'obligation-1', description: 'Propina', amount: { amount: '100.00', currency: 'EUR' }, effectiveAt: '2026-09-01T00:00:00.000Z', status: 'open' };
const payment = { id: 'payment-1', paymentReference: 'PAG-1', amount: { amount: '100.00', currency: 'EUR' }, received: { amount: '100.00', currency: 'EUR' }, allocationPosition: 'unapplied', method: 'cash', effectiveAt: '2026-09-02T00:00:00.000Z', status: 'confirmed' };
const allocation = { id: 'allocation-1', paymentId: payment.id, obligationId: obligation.id, amount: payment.amount, effectiveAt: '2026-09-03T00:00:00.000Z', reversals: [] };

let openedObligation: string | undefined;
let openedPayment: string | undefined;
let panels!: ReturnType<typeof create>;
await act(async () => { panels = create(React.createElement(FinanceOperationalTruthPanels, { openObligations: [obligation] as any, confirmedUnallocatedPayments: [payment] as any, onOpenObligation: id => { openedObligation = id; }, onOpenPayment: id => { openedPayment = id; } })); });
assert.equal(panels.root.findAllByProps({ 'data-testid': 'open-obligation-obligation-1' }).length, 1, 'visible primary obligation action must exist without secondary-action callbacks');
assert.equal(panels.root.findAllByProps({ 'data-testid': 'obligation-actions-obligation-1' }).length, 0, 'primary obligation navigation must not require the optional generic actions menu');
await act(async () => { panels.root.findByProps({ 'data-testid': 'open-obligation-obligation-1' }).props.onClick(); });
await act(async () => { panels.root.findByProps({ 'data-testid': 'open-payment-payment-1' }).props.onClick(); });
assert.equal(openedObligation, obligation.id);
assert.equal(openedPayment, payment.id);

let allocationPayment: string | undefined;
let allocationObligation: string | undefined;
let history!: ReturnType<typeof create>;
await act(async () => { history = create(React.createElement(FinanceOperationalHistory, { history: [{ kind: 'payment', id: payment.id, occurredAt: payment.effectiveAt, payment }, { kind: 'obligation', id: obligation.id, occurredAt: obligation.effectiveAt, obligation }, { kind: 'allocation', id: allocation.id, occurredAt: allocation.effectiveAt, allocation }] as any, onOpenPayment: id => { allocationPayment = id; }, onOpenObligation: id => { allocationObligation = id; } })); });
await act(async () => { history.root.findByProps({ 'data-testid': 'allocation-open-payment-allocation-1' }).props.onClick(); });
await act(async () => { history.root.findByProps({ 'data-testid': 'allocation-open-obligation-allocation-1' }).props.onClick(); });
assert.equal(allocationPayment, payment.id);
assert.equal(allocationObligation, obligation.id);
const relationship = history.root.findByProps({ 'data-testid': 'allocation-relationship-allocation-1' }).findByType('p');
const relationshipChildren = relationship.children as any[];
assert.equal(relationshipChildren[0].children.join(''), 'Pagamento PAG-1');
assert.equal(relationshipChildren[1], ' → associado à obrigação ');
assert.equal(relationshipChildren[2].children.join(''), 'Propina');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = fs.readFileSync(path.join(root, 'src/components/finance/FinanceWorkspace.tsx'), 'utf8');
const operational = fs.readFileSync(path.join(root, 'src/components/finance/operational/FinanceOperationalContextWorkspace.tsx'), 'utf8');
assert.match(workspace, /operationsReturnContext/);
assert.match(workspace, /returnFromObligationDetail/);
assert.match(workspace, /originLabel=\{origin\?\.businessReference \?\? null\}/);
assert.match(workspace, /initialPaymentId=\{selectedPaymentId\}/);
assert.match(operational, /onOpenObligation\?\.\(obligationId, \{ id: context\.financialAccount\.id, label:/);
assert.match(operational, /onOpenPayment\?\.\(paymentId, \{ id: context\.financialAccount\.id, label:/);
const panelsSource = fs.readFileSync(path.join(root, 'src/components/finance/operational/FinanceOperationalTruthPanels.tsx'), 'utf8');
const paymentsSource = fs.readFileSync(path.join(root, 'src/components/finance/payments/FinancePaymentsWorkspace.tsx'), 'utf8');
const obligationSource = fs.readFileSync(path.join(root, 'src/components/finance/obligations/InvoicePreissuePreview.tsx'), 'utf8');
assert.match(panelsSource, /data-testid=\{`open-obligation-\$\{ob\.id\}`\}[\s\S]*bg-emerald-600/);
assert.match(panelsSource, /data-testid=\{`open-payment-\$\{pay\.id\}`\}[\s\S]*bg-emerald-600/);
assert.match(paymentsSource, /data-testid="selected-payment-context"/);
assert.match(obligationSource, /data-testid="selected-obligation-context"/);

const mountedContext = {
  financialAccount: { id: 'account-1', accountNumber: 'CTA-000001', name: 'Conta da Ana', status: 'active' },
  responsiblePerson: { personId: 'person-1', displayName: 'Ana Silva', role: 'guardian' },
  students: [{ personId: 'student-1', displayName: 'Ana Silva', enrollmentId: 'enrollment-1', enrollmentStatus: 'active' }],
  openObligations: [obligation],
  confirmedUnallocatedPayments: [payment],
  history: [
    { kind: 'payment', id: payment.id, occurredAt: payment.effectiveAt, payment },
    { kind: 'obligation', id: obligation.id, occurredAt: obligation.effectiveAt, obligation },
    { kind: 'allocation', id: allocation.id, occurredAt: allocation.effectiveAt, allocation },
  ],
};
const originalContextLoad = FinanceOperationalContextClient.prototype.getByFinancialAccountId;
try {
  FinanceOperationalContextClient.prototype.getByFinancialAccountId = async (id: string) => {
    assert.equal(id, 'account-1');
    return mountedContext as any;
  };
  let mountedObligation: string | undefined;
  let mountedPayment: string | undefined;
  let mounted!: ReturnType<typeof create>;
  await act(async () => { mounted = create(React.createElement(FinanceOperationalContextWorkspace, { initialFinancialAccountId: 'account-1', onOpenObligation: id => { mountedObligation = id; }, onOpenPayment: id => { mountedPayment = id; } })); await Promise.resolve(); });
  assert.equal(mounted.root.findAllByProps({ 'data-testid': 'open-obligation-obligation-1' }).length, 1, 'mounted financial context must expose the primary obligation drill-down');
  assert.equal(mounted.root.findAllByProps({ 'data-testid': 'obligation-actions-obligation-1' }).length, 1, 'secondary actions may coexist but must not replace the primary drill-down');
  await act(async () => { mounted.root.findByProps({ 'data-testid': 'open-obligation-obligation-1' }).props.onClick(); mounted.root.findByProps({ 'data-testid': 'open-payment-payment-1' }).props.onClick(); mounted.root.findByProps({ 'data-testid': 'allocation-open-payment-allocation-1' }).props.onClick(); mounted.root.findByProps({ 'data-testid': 'allocation-open-obligation-allocation-1' }).props.onClick(); });
  assert.equal(mountedObligation, obligation.id);
  assert.equal(mountedPayment, payment.id);
  const mountedRelationship = mounted.root.findByProps({ 'data-testid': 'allocation-relationship-allocation-1' }).findByType('p').children as any[];
  assert.equal(mountedRelationship[0].children.join(''), 'Pagamento PAG-1');
  assert.equal(mountedRelationship[1], ' → associado à obrigação ');
  assert.equal(mountedRelationship[2].children.join(''), 'Propina');

  let obligationWorkspace!: ReturnType<typeof create>;
  await act(async () => { obligationWorkspace = create(React.createElement(FinanceWorkspace, { initialFinancialAccountId: 'account-1' })); await Promise.resolve(); });
  await act(async () => { obligationWorkspace.root.findByProps({ 'data-testid': 'open-obligation-obligation-1' }).props.onClick(); });
  assert.equal(obligationWorkspace.root.findByType(FinancialObligationsWorkspace).props.selectedObligationId, obligation.id);
  assert.match(obligationWorkspace.root.findByProps({ 'data-testid': 'return-from-obligation-detail' }).children.join(''), /CTA-000001.*Conta da Ana/);

  let paymentWorkspace!: ReturnType<typeof create>;
  await act(async () => { paymentWorkspace = create(React.createElement(FinanceWorkspace, { initialFinancialAccountId: 'account-1' })); await Promise.resolve(); });
  await act(async () => { paymentWorkspace.root.findByProps({ 'data-testid': 'open-payment-payment-1' }).props.onClick(); });
  assert.equal(paymentWorkspace.root.findByType(FinancePaymentsWorkspace).props.initialPaymentId, payment.id);
  assert.match(paymentWorkspace.root.findByProps({ 'data-testid': 'return-to-financial-situation' }).children.join(''), /CTA-000001.*Conta da Ana/);
} finally {
  FinanceOperationalContextClient.prototype.getByFinancialAccountId = originalContextLoad;
}
console.log('FINANCE_F1A_CONTEXTUAL_DRILLDOWN_UI=PASS');
