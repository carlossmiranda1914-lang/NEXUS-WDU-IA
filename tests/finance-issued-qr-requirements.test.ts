import assert from 'node:assert/strict';
import test from 'node:test';
import { requireIssuedAngolaQrInputs } from '../src/modules/finance/financial-document-presentation.ts';

test('pre-issue previews cannot create Angola QR inputs', () => {
  assert.throws(() => requireIssuedAngolaQrInputs({ issued: false, issuerTaxIdentifier: '5000000000', officialDocumentNumber: 'RC/1' }), /ISSUED_DOCUMENT_REQUIRED/);
});

test('issued document QR requirements demand persisted issuer NIF and official number', () => {
  assert.throws(() => requireIssuedAngolaQrInputs({ issued: true, issuerTaxIdentifier: null, officialDocumentNumber: 'RC/1' }), /ISSUER_TAX_IDENTIFIER_REQUIRED/);
  assert.throws(() => requireIssuedAngolaQrInputs({ issued: true, issuerTaxIdentifier: '5000000000', officialDocumentNumber: '' }), /OFFICIAL_DOCUMENT_NUMBER_REQUIRED/);
  assert.deepEqual(requireIssuedAngolaQrInputs({ issued: true, issuerTaxIdentifier: '5000000000', officialDocumentNumber: 'RC/1' }), { issuerTaxIdentifier: '5000000000', officialDocumentNumber: 'RC/1' });
});
