import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import type { FinancialProfileStore } from '../src/modules/finance/financial-context.ts';
import { registerPaymentRoutes } from '../src/modules/finance/payment-http.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_pay_http_${randomUUID().replaceAll('-', '')}`;
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionA = '00000000-0000-0000-0000-000000000601';
const institutionB = '00000000-0000-0000-0000-000000000602';
const actorAdminA = '00000000-0000-0000-0000-000000000611';
const actorDirectorA = '00000000-0000-0000-0000-000000000612';
const actorTeacherA = '00000000-0000-0000-0000-000000000613';
const actorAdminB = '00000000-0000-0000-0000-000000000614';
const personPayer = '00000000-0000-0000-0000-000000000621';

const tokenMap: Record<string, any> = {
  'token-admin-a': {
    institutionId: institutionA,
    personId: actorAdminA,
    personName: 'Admin A',
    identityEmail: 'admin.a@test.local',
    membershipId: randomUUID(),
    institutionName: 'Inst A',
    institutionSlug: 'inst-a',
    role: 'institution_admin',
  },
  'token-dir-a': {
    institutionId: institutionA,
    personId: actorDirectorA,
    personName: 'Director A',
    identityEmail: 'dir.a@test.local',
    membershipId: randomUUID(),
    institutionName: 'Inst A',
    institutionSlug: 'inst-a',
    role: 'director',
  },
  'token-teacher-a': {
    institutionId: institutionA,
    personId: actorTeacherA,
    personName: 'Teacher A',
    identityEmail: 'teach.a@test.local',
    membershipId: randomUUID(),
    institutionName: 'Inst A',
    institutionSlug: 'inst-a',
    role: 'teacher',
  },
  'token-admin-b': {
    institutionId: institutionB,
    personId: actorAdminB,
    personName: 'Admin B',
    identityEmail: 'admin.b@test.local',
    membershipId: randomUUID(),
    institutionName: 'Inst B',
    institutionSlug: 'inst-b',
    role: 'institution_admin',
  },
};

const profiles: FinancialProfileStore = {
  async resolveEffective(instId: string) {
    if (instId !== institutionA && instId !== institutionB) return null;
    return {
      institutionId: instId,
      version: 1,
      effectiveFrom: new Date(Date.now() - 86400000).toISOString(),
      effectiveTo: null,
      primaryJurisdiction: instId === institutionA ? 'PT' : 'AO',
      functionalCurrency: instId === institutionA ? 'EUR' : 'AOA',
      financialTimezone: instId === institutionA ? 'Europe/Lisbon' : 'Africa/Luanda',
      monetaryPolicyVersion: '1',
      enabledCurrencies: instId === institutionA ? ['EUR', 'USD'] : ['AOA'],
    };
  },
};

const testAuth: any = (req: any, _res: any, next: any) => {
  const header = req.header('Authorization');
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    if (tokenMap[token]) {
      req.institutionalContext = tokenMap[token];
    }
  }
  next();
};

const app = express();
app.use(express.json());
registerPaymentRoutes(app, pool, profiles, testAuth);

let server: http.Server | undefined;

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);

    const migrations = await discoverMigrations(migrationsDir);
    await runMigrations(client, migrations);

    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES ($1,'Inst A','inst-a','active'),($2,'Inst B','inst-b','active')`, [institutionA, institutionB]);
    await client.query(`INSERT INTO people(id,name) VALUES ($1,'Admin A'),($2,'Director A'),($3,'Teacher A'),($4,'Admin B'),($5,'Payer')`, [actorAdminA, actorDirectorA, actorTeacherA, actorAdminB, personPayer]);
    await client.query(`INSERT INTO memberships(id,institution_id,person_id,role,status) VALUES ($1,$2,$3,'student','active')`, [randomUUID(), institutionA, personPayer]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES ($1,1,now() - interval '1 day','PT','EUR','Europe/Lisbon','v1','["EUR","USD"]'),($2,1,now() - interval '1 day','AO','AOA','Africa/Luanda','v1','["AOA"]')`, [institutionA, institutionB]);

    const accountA = randomUUID();
    await client.query(`INSERT INTO finance_financial_accounts (id, institution_id, account_number, name) VALUES ($1, $2, 'CTA-000001', 'Conta A')`, [accountA, institutionA]);

    server = http.createServer(app);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const makeRequest = async (token: string | null, route: string, options: any = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${baseUrl}${route}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    };

    // 1. 401 Unauthorized when no token
    const res401 = await makeRequest(null, '/api/finance/payments');
    assert.equal(res401.status, 401);

    // 2. 403 Forbidden for teacher role
    const res403 = await makeRequest('token-teacher-a', '/api/finance/payments');
    assert.equal(res403.status, 403);

    // 3. 403 Forbidden for director attempting manual payment write
    const resWrite403 = await makeRequest('token-dir-a', '/api/finance/payments/manual', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idemp-dir-1' },
      body: { sourceType: 'manual_offline', method: 'cash', amount: '50.00', currency: 'EUR' },
    });
    assert.equal(resWrite403.status, 403);

    // 4. 422 Missing Idempotency-Key
    const resNoKey = await makeRequest('token-admin-a', '/api/finance/payments/manual', {
      method: 'POST',
      body: { sourceType: 'manual_offline', method: 'cash', amount: '50.00', currency: 'EUR' },
    });
    assert.equal(resNoKey.status, 422);
    assert.equal(resNoKey.body.code, 'IDEMPOTENCY_KEY_REQUIRED');

    // 5. 201 Success: Manual payment creation
    const resCreate = await makeRequest('token-admin-a', '/api/finance/payments/manual', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idemp-http-001' },
      body: {
        sourceType: 'manual_offline',
        method: 'cash',
        amount: '180.00',
        currency: 'EUR',
        financialAccountId: accountA,
        payerPersonId: personPayer,
        notes: 'Pagamento via balcão HTTP',
      },
    });

    assert.equal(resCreate.status, 201);
    assert.equal(resCreate.body.replayed, false);
    assert.equal(resCreate.body.payment.paymentReference, 'PAG-000001');
    assert.equal(resCreate.body.payment.amount, '180');
    assert.equal(resCreate.body.payment.currency, 'EUR');
    assert.equal(resCreate.body.payment.status, 'confirmed');
    assert.equal(resCreate.body.payment.allocationStatus, 'unapplied');

    const paymentId = resCreate.body.payment.id;

    // 6. New manual receipt without an account is rejected before persistence.
    const resMissingAccount = await makeRequest('token-admin-a', '/api/finance/payments/manual', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idemp-http-missing-account' },
      body: { method: 'cash', amount: '50.00', currency: 'EUR' },
    });
    assert.equal(resMissingAccount.status, 422);
    assert.equal(resMissingAccount.body.code, 'PAYMENT_VALIDATION_ERROR');
    assert.match(resMissingAccount.body.error, /selecionar uma conta financeira ativa/i);
    const missingAccountWrites = await client.query(`SELECT count(*)::int AS count FROM finance_payments WHERE institution_id=$1`, [institutionA]);
    assert.equal(missingAccountWrites.rows[0].count, 1);

    // 7. 200 Replay with same Idempotency-Key
    const resReplay = await makeRequest('token-admin-a', '/api/finance/payments/manual', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idemp-http-001' },
      body: {
        sourceType: 'manual_offline',
        method: 'cash',
        amount: '180.00',
        currency: 'EUR',
        financialAccountId: accountA,
        payerPersonId: personPayer,
        notes: 'Pagamento via balcão HTTP',
      },
    });

    assert.equal(resReplay.status, 200);
    assert.equal(resReplay.body.replayed, true);
    assert.equal(resReplay.body.payment.id, paymentId);

    // 8. 409 Conflict with same key but different amount
    const resConflict = await makeRequest('token-admin-a', '/api/finance/payments/manual', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idemp-http-001' },
      body: {
        sourceType: 'manual_offline',
        method: 'cash',
        amount: '250.00',
        currency: 'EUR',
      },
    });
    assert.equal(resConflict.status, 409);

    // 9. GET /api/finance/payments/:id (success for Inst A, 404 for Inst B)
    const resGetA = await makeRequest('token-admin-a', `/api/finance/payments/${paymentId}`);
    assert.equal(resGetA.status, 200);
    assert.equal(resGetA.body.id, paymentId);

    const resGetB = await makeRequest('token-admin-b', `/api/finance/payments/${paymentId}`);
    assert.equal(resGetB.status, 404);

    // 10. GET /api/finance/payments list
    const resListB = await makeRequest('token-admin-b', '/api/finance/payments');
    assert.equal(resListB.status, 200);
    assert.equal(resListB.body.length, 0);

    const resListA = await makeRequest('token-dir-a', '/api/finance/payments');
    assert.equal(resListA.status, 200);
    assert.equal(resListA.body.length, 1);

    console.log('Finance Payment HTTP Boundary: PASS');
  } finally {
    if (server) {
      server.close();
    }
    client.release();
  }
} finally {
  const c = await pool.connect().catch(() => undefined);
  if (c) {
    try {
      await c.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
    } finally {
      c.release();
    }
  }
  await pool.end();
}
