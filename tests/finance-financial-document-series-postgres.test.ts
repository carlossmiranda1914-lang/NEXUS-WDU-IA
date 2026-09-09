import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PostgresFinancialDocumentSeriesStore } from '../src/modules/finance/financial-document-series.ts';

test('F7-02 provides a Finance-owned effective series configuration migration', async () => {
  await assert.doesNotReject(() => readFile(new URL('../src/db/migrations/0043_finance_document_series_configuration.sql', import.meta.url), 'utf8'));
});

test('F7-02 series resolution fails closed when no active effective series exists', async () => {
  const store = new PostgresFinancialDocumentSeriesStore({ query: async () => ({ rows: [] }) } as never);
  await assert.rejects(() => store.requireEffective('institution-a', 'series-a', 'receipt', new Date('2026-01-01T00:00:00.000Z')), /FINANCIAL_DOCUMENT_SERIES_NOT_EFFECTIVE/);
});
