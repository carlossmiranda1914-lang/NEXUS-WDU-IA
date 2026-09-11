import assert from 'node:assert/strict';
import test from 'node:test';
import { productTerm } from '../src/lib/product-terminology.ts';

test('provides explicit Portuguese terminology for issued financial documents', () => {
  assert.equal(productTerm('financial_document.receipt').label, 'Recibo');
  assert.equal(productTerm('financial_document.credit_note').label, 'Nota de crédito');
  assert.equal(productTerm('financial_document.status.issued').label, 'Emitido');
});

test('provides product actions without deriving labels from internal enum strings', () => {
  assert.equal(productTerm('payment').label, 'Pagamento');
  assert.equal(productTerm('document.recipient').label, 'Destinatário do documento');
  assert.equal(productTerm('document.issuer').label, 'Emitente');
});
