import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

test('F7-01 migration provides Finance-owned document, source, correction and series authority', async () => {
  const migration = await readFile(new URL('../src/db/migrations/0041_finance_financial_documents.sql', import.meta.url), 'utf8');
  for (const table of ['finance_financial_documents', 'finance_financial_document_sources', 'finance_financial_document_series']) assert.match(migration, new RegExp(`CREATE TABLE ${table}`));
  assert.match(migration, /UNIQUE \(institution_id, series_id, sequence_number\)/);
});

test('F7-01 migration rejects an incomplete issued document fact', async () => {
  await verifyApprovedTestConnection();
  const schema = `finance_document_issued_shape_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
  const institutionId = randomUUID();
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
      await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Issued shape','issued-shape','active')", [institutionId]);
      await assert.rejects(() => client.query("INSERT INTO finance_financial_documents(institution_id,document_type,status,source_snapshot) VALUES($1,'receipt','issued','{}')", [institutionId]), /issued_shape/i);
    } finally { client.release(); }
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});
