import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PostgresFinancialDocumentSeriesStore } from '../src/modules/finance/financial-document-series.ts';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

test('F7-02 provides a Finance-owned effective series configuration migration', async () => {
  await assert.doesNotReject(() => readFile(new URL('../src/db/migrations/0043_finance_document_series_configuration.sql', import.meta.url), 'utf8'));
});

test('F7-02 series resolution fails closed when no active effective series exists', async () => {
  const store = new PostgresFinancialDocumentSeriesStore({ query: async () => ({ rows: [] }) } as never);
  await assert.rejects(() => store.requireEffective('institution-a', 'series-a', 'receipt', new Date('2026-01-01T00:00:00.000Z')), /FINANCIAL_DOCUMENT_SERIES_NOT_EFFECTIVE/);
});

test('F7-02 PostgreSQL series resolution is tenant-scoped and effective-dated', async () => {
  await verifyApprovedTestConnection(); const schema=`finance_series_${randomUUID().replaceAll('-','')}`; const q=(v:string)=>`"${v.replaceAll('"','""')}"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${q(schema)},public`}); const a=randomUUID(),b=randomUUID(),local=randomUUID(),foreign=randomUUID();
  try { const c=await pool.connect(); try { await c.query(`CREATE SCHEMA ${q(schema)}`); await runMigrations(c,await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/db/migrations'))); await c.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','series-a','active'),($2,'B','series-b','active')",[a,b]); await c.query("INSERT INTO finance_financial_document_series(id,institution_id,code,document_type,status,effective_from) VALUES($1,$2,'LOCAL','receipt','active',now()),($3,$4,'FOREIGN','receipt','active',now())",[local,a,foreign,b]); } finally {c.release()}; const store=new PostgresFinancialDocumentSeriesStore(pool); const afterCreation=new Date(Date.now()+60_000); assert.equal((await store.requireEffective(a,local,'receipt',afterCreation)).id,local); await assert.rejects(()=>store.requireEffective(a,foreign,'receipt',afterCreation),/SERIES_NOT_EFFECTIVE/); } finally {await pool.query(`DROP SCHEMA IF EXISTS ${q(schema)} CASCADE`).catch(()=>undefined);await pool.end()}
});
