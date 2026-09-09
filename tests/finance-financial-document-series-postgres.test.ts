import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('F7-02 provides a Finance-owned effective series configuration migration', async () => {
  await assert.doesNotReject(() => readFile(new URL('../src/db/migrations/0043_finance_document_series_configuration.sql', import.meta.url), 'utf8'));
});
