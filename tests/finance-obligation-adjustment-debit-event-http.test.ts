import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { registerObligationAdjustmentRoutes } from '../src/modules/finance/obligation-adjustment-http.ts';
import { ObligationAdjustmentApiClient } from '../src/modules/finance/obligation-adjustment-client.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_adjustment_debit_http_${randomUUID().replaceAll('-', '')}`;
const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quoteIdentifier(schema)},public` });
const institutionA = randomUUID(), institutionB = randomUUID(), adminA = randomUUID(), directorA = randomUUID(), accountA = randomUUID(), feeTypeId = randomUUID(), feeId = randomUUID();
const context = (institutionId: string, personId: string, role: string) => ({ institutionId, personId, personName: 'Finance actor', identityEmail: null, membershipId: randomUUID(), institutionName: 'Test', institutionSlug: 'test', role });
const contexts: Record<string, unknown> = { admin: context(institutionA, adminA, 'institution_admin'), director: context(institutionA, directorA, 'director'), foreign: context(institutionB, randomUUID(), 'institution_admin') };
let server: http.Server | undefined;

async function createObligation() {
  const id = randomUUID();
  await pool.query(`INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,status,financial_profile_version,created_by_person_id,idempotency_key) VALUES($1,$2,$3,$4,1,'manual_finance',$5,'100','EUR','open',1,$6,$7)`, [id, institutionA, accountA, feeId, `http-${id}`, adminA, `key-${id}`]);
  return id;
}

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
    await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','a','active'),($2,'B','b','active')`, [institutionA, institutionB]);
    await client.query(`INSERT INTO people(id,name) VALUES($1,'Admin'),($2,'Director')`, [adminA, directorA]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES($1,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR"]')`, [institutionA]);
    await client.query(`INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'A','A')`, [accountA, institutionA]);
    await client.query(`INSERT INTO finance_fee_types(id,institution_id,source,display_name,code_prefix) VALUES($1,$2,'institution_custom','Fee','FEE')`, [feeTypeId, institutionA]);
    await client.query(`INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'FEE-1',1,$4)`, [feeId, institutionA, feeTypeId, adminA]);
    await client.query(`INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'Fee','fee','100','EUR',now(),$4)`, [institutionA, feeId, feeTypeId, adminA]);
  } finally { client.release(); }
  const app = express(); app.use(express.json());
  registerObligationAdjustmentRoutes(app, pool, ((req: any, _res: any, next: any) => { const token = req.header('Authorization')?.replace('Bearer ', ''); if (token && contexts[token]) req.institutionalContext = contexts[token]; next(); }) as any);
  server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = async (token: string | undefined, obligationId: string, body: unknown, key: string) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Idempotency-Key': key };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${baseUrl}/api/finance/obligations/${obligationId}/adjustments`, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  };
  const obligationId = await createObligation();
  const general = await request('admin', obligationId, { direction: 'increase', amount: '1', currency: 'EUR', reason: 'General' }, 'general');
  assert.equal(general.status, 201); assert.equal(general.body.adjustment.basisType, 'general');
  const debitEvent = await request('admin', obligationId, { direction: 'increase', amount: '2', currency: 'EUR', reason: 'Event', basisType: 'debit_event' }, 'event');
  assert.equal(debitEvent.status, 201); assert.equal(debitEvent.body.adjustment.basisType, 'debit_event');
  assert.equal((await request('admin', obligationId, { direction: 'decrease', amount: '1', currency: 'EUR', reason: 'No', basisType: 'debit_event' }, 'decrease')).status, 422);
  assert.equal((await request('admin', obligationId, { direction: 'increase', amount: '1', currency: 'EUR', reason: 'No', basisType: 'invoice' }, 'unknown')).status, 422);
  assert.equal((await request('foreign', obligationId, { direction: 'increase', amount: '1', currency: 'EUR', reason: 'Foreign', institutionId: institutionA }, 'foreign')).status, 404);
  assert.equal((await request('director', obligationId, { direction: 'increase', amount: '1', currency: 'EUR', reason: 'Denied' }, 'director')).status, 403);
  let capturedBody = '';
  const apiClient = new ObligationAdjustmentApiClient(async (_path, init) => { capturedBody = String(init?.body); return new Response(JSON.stringify({ adjustment: { basisType: 'debit_event' }, position: {}, replayed: false }), { status: 201, headers: { 'Content-Type': 'application/json' } }); }, async () => 'token');
  await apiClient.record(obligationId, { direction: 'increase', amount: '1', currency: 'EUR', reason: 'Client', basisType: 'debit_event' }, 'client-event');
  assert.match(capturedBody, /"basisType":"debit_event"/);
  console.log('FINANCE_OBLIGATION_ADJUSTMENT_DEBIT_EVENT_HTTP=PASS');
} finally {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  const client = await pool.connect().catch(() => undefined);
  if (client) { try { await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`); } finally { client.release(); } }
  await pool.end();
}
