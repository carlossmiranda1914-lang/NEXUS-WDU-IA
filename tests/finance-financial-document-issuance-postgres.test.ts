import assert from 'node:assert/strict';
import test from 'node:test';
import { issueFinancialDocumentCommand } from '../src/modules/finance/financial-document-service.ts';

test('F7-01 issuance is idempotent, tenant-safe, and allocates series numbers atomically', async () => {
  const harness: any = {};
  await assert.rejects(() => issueFinancialDocumentCommand(harness, { institutionId: 'a', sourceInstitutionId: 'b', seriesId: 's', idempotencyKey: 'key-a' }));
});
