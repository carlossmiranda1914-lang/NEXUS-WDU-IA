import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { FinanceWorkspace } from '../src/components/finance/FinanceWorkspace.tsx';
import { financialObligationClient } from '../src/modules/finance/financial-obligation-client.ts';

const obligation = {
  id: 'obligation-1', institutionId: 'institution-1', financialAccountId: 'account-1', accountNumber: 'CTA-000001', accountName: 'Conta Familiar', beneficiaryPersonId: 'person-1', beneficiaryName: 'Ana Silva', feeCatalogueItemId: 'fee-1', feeCatalogueVersion: 2, feeItemCode: 'PROP-001', feeItemName: 'Propina anual', sourceType: 'manual_finance', sourceRef: 'MAN-001', money: { amount: '120.00', currency: 'EUR' }, effectiveAt: '2026-09-01T00:00:00.000Z', dueAt: '2026-09-30T00:00:00.000Z', status: 'open', notes: null, financialProfileVersion: 1, createdByPersonId: 'admin-1', idempotencyKey: 'idempotency-1', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
};
const originalList = financialObligationClient.listObligations;
const originalGet = financialObligationClient.getObligation;
try {
  (financialObligationClient as any).listObligations = async () => [obligation];
  (financialObligationClient as any).getObligation = async (id: string) => { assert.equal(id, obligation.id); return obligation; };
  let view!: ReturnType<typeof create>;
  await act(async () => { view = create(React.createElement(FinanceWorkspace, { initialTab: 'obligations' })); await Promise.resolve(); });
  assert.equal(view.root.findAllByProps({ 'data-testid': 'obligations-list-title' }).length, 1, 'collection must be the initial primary view');
  await act(async () => { view.root.findByProps({ 'data-testid': 'open-obligation-obligation-1' }).props.onClick(); await Promise.resolve(); });
  assert.equal(view.root.findAllByProps({ 'data-testid': 'obligations-list-title' }).length, 0, 'collection must leave the primary surface during detail');
  assert.equal(view.root.findAllByProps({ 'data-testid': 'financial-obligation-detail-view' }).length, 1, 'exact obligation detail must be the primary view');
  const text = JSON.stringify(view.toJSON());
  assert.match(text, /Propina anual/);
  assert.match(text, /120,00 EUR/);
  assert.match(text, /CTA-000001/);
  assert.match(text, /Pré-visualizar fatura/);
  assert.doesNotMatch(text, /paymentReference|Abrir pagamento|Abrir documento/);
  await act(async () => { view.root.findByProps({ 'data-testid': 'return-from-obligation-detail' }).props.onClick(); });
  assert.equal(view.root.findAllByProps({ 'data-testid': 'obligations-list-title' }).length, 1, 'return must restore the collection');
} finally {
  (financialObligationClient as any).listObligations = originalList;
  (financialObligationClient as any).getObligation = originalGet;
}
console.log('FINANCE_OBLIGATION_DEDICATED_VIEW_UI=PASS');
