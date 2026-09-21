import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDocumentSourceInstitution, validateCorrectionInstitution } from '../src/modules/finance/financial-document-model.ts';

test('Financial Document rejects foreign source and correction relationships', () => {
  assert.throws(() => validateDocumentSourceInstitution('institution-a', 'institution-b'));
  assert.throws(() => validateCorrectionInstitution('institution-a', 'institution-b'));
});
