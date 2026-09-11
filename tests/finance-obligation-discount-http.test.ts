import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { registerDiscountPolicyRoutes } from '../src/modules/finance/discount-policy-http.ts';
import { registerObligationDiscountRoutes } from '../src/modules/finance/obligation-discount-http.ts';
import { ObligationDiscountApiClient } from '../src/modules/finance/obligation-discount-client.ts';
import { PostgresDiscountPolicyRepository } from '../src/modules/finance/discount-policy-repository.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const schema = `finance_ob_discount_http_${randomUUID().replaceAll('-', '')}`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});

const institutionA = randomUUID();
const institutionB = randomUUID();
const adminA = randomUUID();
const directorA = randomUUID();
const teacherA = randomUUID();
const adminB = randomUUID();
const accountA = randomUUID();
let feeItemId = '';
let server: http.Server | undefined;

const tokenMap: Record<string, any> = {
  adminA: {
    institutionId: institutionA,
    personId: adminA,
    personName: 'Admin A',
    identityEmail: null,
    membershipId: randomUUID(),
    institutionName: 'Inst A',
    institutionSlug: 'inst-a',
    role: 'institution_admin',
  },
  directorA: {
    institutionId: institutionA,
    personId: directorA,
    personName: 'Director A',
    identityEmail: null,
    membershipId: randomUUID(),
    institutionName: 'Inst A',
    institutionSlug: 'inst-a',
    role: 'director',
  },
  teacherA: {
    institutionId: institutionA,
    personId: teacherA,
    personName: 'Teacher A',
    identityEmail: null,
    membershipId: randomUUID(),
    institutionName: 'Inst A',
    institutionSlug: 'inst-a',
    role: 'teacher',
  },
  adminB: {
    institutionId: institutionB,
    personId: adminB,
    personName: 'Admin B',
    identityEmail: null,
    membershipId: randomUUID(),
    institutionName: 'Inst B',
    institutionSlug: 'inst-b',
    role: 'institution_admin',
  },
};

const authMiddleware: any = (req: any, _res: any, next: any) => {
  const value = req.header('Authorization');
  const token = value?.startsWith('Bearer ') ? value.slice(7) : '';
  if (tokenMap[token]) {
    req.institutionalContext = tokenMap[token];
  }
  next();
};

async function seedObligation(amount = '100', currency = 'EUR') {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,status,financial_profile_version,created_by_person_id,idempotency_key)
     VALUES($1,$2,$3,$4,1,'manual_finance',$5,$6,$7,'open',1,$8,$9)`,
    [id, institutionA, accountA, feeItemId, `http-${id}`, amount, currency, adminA, `ob-${id}`]
  );
  return id;
}

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await runMigrations(
      client,
      await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations'))
    );
    await client.query(
      `INSERT INTO institutions(id,name,slug,status) VALUES($1,'Inst A','inst-a','active'),($2,'Inst B','inst-b','active')`,
      [institutionA, institutionB]
    );
    await client.query(
      `INSERT INTO people(id,name) VALUES($1,'Admin A'),($2,'Director A'),($3,'Teacher A'),($4,'Admin B')`,
      [adminA, directorA, teacherA, adminB]
    );
    await client.query(
      `INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies)
       VALUES($1,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR","USD"]'),($2,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR"]')`,
      [institutionA, institutionB]
    );
    await client.query(
      `INSERT INTO finance_financial_accounts(id,institution_id,account_number,name) VALUES($1,$2,'CTA-A','A')`,
      [accountA, institutionA]
    );
    const feeType = randomUUID();
    feeItemId = randomUUID();
    await client.query(
      `INSERT INTO finance_fee_types(id,institution_id,source,display_name,code_prefix) VALUES($1,$2,'institution_custom','Fee','FEE')`,
      [feeType, institutionA]
    );
    await client.query(
      `INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'FEE-1',1,$4)`,
      [feeItemId, institutionA, feeType, adminA]
    );
    await client.query(
      `INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'Fee','fee',100,'EUR',now(),$4)`,
      [institutionA, feeItemId, feeType, adminA]
    );
  } finally {
    client.release();
  }

  const app = express();
  app.use(express.json());
  registerDiscountPolicyRoutes(app, pool, authMiddleware);
  registerObligationDiscountRoutes(app, pool, authMiddleware);

  server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}`;

  const policyRepo = new PostgresDiscountPolicyRepository(pool);
  const bolsa20 = await policyRepo.createDiscountPolicy(
    tokenMap['adminA'],
    {
      code: 'BOLSA-20',
      name: 'Bolsa de Mérito 20%',
      calculationMode: 'percentage',
      value: '20.00',
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    }
  );

  const request = async (token: string | undefined, route: string, options: any = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(base + route, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };

  const ob1 = await seedObligation('100.00');

  // 1. Unauthenticated -> 401
  const unauth = await request(undefined, `/api/finance/obligations/${ob1}/discounts`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'k-unauth' },
    body: { discountPolicyId: bolsa20.id, reason: 'Bolsa de Mérito' },
  });
  assert.equal(unauth.status, 401);

  // 2. Director -> 403 (write forbidden)
  const director = await request('directorA', `/api/finance/obligations/${ob1}/discounts`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'k-dir' },
    body: { discountPolicyId: bolsa20.id, reason: 'Bolsa de Mérito' },
  });
  assert.equal(director.status, 403);

  // 3. Missing Idempotency-Key -> 422
  const noKey = await request('adminA', `/api/finance/obligations/${ob1}/discounts`, {
    method: 'POST',
    body: { discountPolicyId: bolsa20.id, reason: 'Bolsa de Mérito' },
  });
  assert.equal(noKey.status, 422);

  // 4. Admin A applies discount -> 201
  const applyRes = await request('adminA', `/api/finance/obligations/${ob1}/discounts`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'k-apply-1' },
    body: { discountPolicyId: bolsa20.id, reason: 'Bolsa de Mérito' },
  });
  assert.equal(applyRes.status, 201);
  assert.equal(applyRes.body.discount.policyCode, 'BOLSA-20');
  assert.equal(applyRes.body.position.effectiveDue.amount, '80');
  const discountId = applyRes.body.discount.id;

  // 5. Idempotent replay -> 200
  const replayRes = await request('adminA', `/api/finance/obligations/${ob1}/discounts`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'k-apply-1' },
    body: { discountPolicyId: bolsa20.id, reason: 'Bolsa de Mérito' },
  });
  assert.equal(replayRes.status, 200);
  assert.equal(replayRes.body.replayed, true);
  assert.equal(replayRes.body.discount.id, discountId);

  // 6. Applying second discount on same obligation -> 409 (DISCOUNT_ALREADY_ACTIVE)
  const secondRes = await request('adminA', `/api/finance/obligations/${ob1}/discounts`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'k-apply-2' },
    body: { discountPolicyId: bolsa20.id, reason: 'Second discount' },
  });
  assert.equal(secondRes.status, 409);
  assert.equal(secondRes.body.code, 'DISCOUNT_ALREADY_ACTIVE');

  // 7. Non-disclosure: cross-tenant obligation access -> 404
  const crossTenantRes = await request('adminB', `/api/finance/obligations/${ob1}/discounts`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'k-cross' },
    body: { discountPolicyId: bolsa20.id, reason: 'Cross tenant' },
  });
  assert.equal(crossTenantRes.status, 404);

  // 8. Typed Client integration & Revocation flow
  const clientInstance = new ObligationDiscountApiClient({
    getToken: async () => 'adminA',
    fetcher: (input, init) => fetch(`${base}${String(input)}`, init),
  });

  const revokeResult = await clientInstance.revokeDiscount(
    ob1,
    discountId,
    'Cancelamento da bolsa de mérito',
    'k-revoke-1'
  );
  assert.equal(revokeResult.replayed, false);
  assert.equal(revokeResult.revocation.originalDiscountId, discountId);
  assert.equal(revokeResult.position.effectiveDue.amount, '100');

  // 9. Replay revocation -> 200
  const revokeReplay = await clientInstance.revokeDiscount(
    ob1,
    discountId,
    'Cancelamento da bolsa de mérito',
    'k-revoke-1'
  );
  assert.equal(revokeReplay.replayed, true);

  // 10. Second distinct revocation -> 409 (DISCOUNT_ALREADY_REVOKED)
  await assert.rejects(
    () =>
      clientInstance.revokeDiscount(
        ob1,
        discountId,
        'Second distinct revocation',
        'k-revoke-2'
      ),
    /already revoked|DISCOUNT_ALREADY_REVOKED/i
  );

  console.log('Finance obligation discount HTTP & client: PASS');
} finally {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  await pool.end();
}
