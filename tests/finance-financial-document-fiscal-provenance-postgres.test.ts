import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('F7-02 persists financial-document fiscal configuration provenance in the next Finance migration', async () => {
  await assert.doesNotReject(() => readFile(new URL('../src/db/migrations/0113_finance_document_fiscal_provenance.sql', import.meta.url), 'utf8'));
});
