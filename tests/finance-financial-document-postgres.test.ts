import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('F7-01 migration provides Finance-owned document, source, correction and series authority', async () => {
  const migration = await readFile(new URL('../src/db/migrations/0041_finance_financial_documents.sql', import.meta.url), 'utf8');
  for (const table of ['finance_financial_documents', 'finance_financial_document_sources', 'finance_financial_document_series']) assert.match(migration, new RegExp(`CREATE TABLE ${table}`));
  assert.match(migration, /UNIQUE \(institution_id, series_id, sequence_number\)/);
});
