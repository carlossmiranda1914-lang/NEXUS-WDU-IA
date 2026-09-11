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
import { DiscountPolicyApiClient } from '../src/modules/finance/discount-policy-client.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const schema = `finance_discount_policy_http_${randomUUID().replaceAll('-', '')}`;
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
  } finally {
    client.release();
  }

  const app = express();
  app.use(express.json());
  registerDiscountPolicyRoutes(app, pool, authMiddleware);

  server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}`;

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

  // 1. Unauthenticated request -> 401
  const unauth = await request(undefined, '/api/finance/discount-policies');
  assert.equal(unauth.status, 401);

  // 2. Teacher (unauthorized role) -> 403
  const teacher = await request('teacherA', '/api/finance/discount-policies');
  assert.equal(teacher.status, 403);

  // 3. Director (read only role) -> 200 on GET, 403 on POST
  const directorGet = await request('directorA', '/api/finance/discount-policies');
  assert.equal(directorGet.status, 200);
  assert.equal(directorGet.body.policies.length, 0);

  const directorPost = await request('directorA', '/api/finance/discount-policies', {
    method: 'POST',
    body: {
      code: 'BOLSA-20',
      name: 'Bolsa 20%',
      calculationMode: 'percentage',
      value: '20.00',
    },
  });
  assert.equal(directorPost.status, 403);

  // 4. Admin A creates discount policy -> 201
  const createRes = await request('adminA', '/api/finance/discount-policies', {
    method: 'POST',
    body: {
      code: 'BOLSA-20',
      name: 'Bolsa Mérito 20%',
      description: 'Desconto de mérito',
      calculationMode: 'percentage',
      value: '20.00',
      effectiveFrom: '2026-01-01T00:00:00Z',
      effectiveTo: '2026-12-31T23:59:59Z',
    },
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.policy.code, 'BOLSA-20');
  assert.equal(createRes.body.policy.version.version, 1);
  const policyId = createRes.body.policy.id;

  // 5. Code conflict on same tenant -> 409
  const dupRes = await request('adminA', '/api/finance/discount-policies', {
    method: 'POST',
    body: {
      code: 'BOLSA-20',
      name: 'Duplicate Bolsa',
      calculationMode: 'percentage',
      value: '20.00',
    },
  });
  assert.equal(dupRes.status, 409);

  // 6. Same code on different tenant (Tenant B) -> 201 (Tenant Isolation)
  const tenantBRes = await request('adminB', '/api/finance/discount-policies', {
    method: 'POST',
    body: {
      code: 'BOLSA-20',
      name: 'Tenant B Bolsa',
      calculationMode: 'percentage',
      value: '20.00',
    },
  });
  assert.equal(tenantBRes.status, 201);

  // 7. Versioning: Create version 2 scheduled for future
  const ver2Res = await request('adminA', `/api/finance/discount-policies/${policyId}/versions`, {
    method: 'POST',
    body: {
      name: 'Bolsa Mérito 25% (2027)',
      calculationMode: 'percentage',
      value: '25.00',
      effectiveFrom: '2027-01-01T00:00:00Z',
    },
  });
  assert.equal(ver2Res.status, 201);
  assert.equal(ver2Res.body.version.version, 2);

  // 8. Overlapping interval version creation -> 422
  const overlapRes = await request('adminA', `/api/finance/discount-policies/${policyId}/versions`, {
    method: 'POST',
    body: {
      name: 'Overlapping Bolsa',
      calculationMode: 'percentage',
      value: '30.00',
      effectiveFrom: '2026-06-01T00:00:00Z',
    },
  });
  assert.equal(overlapRes.status, 422);

  // 9. Typed Client Integration
  const clientInstance = new DiscountPolicyApiClient({
    getToken: async () => 'adminA',
    fetcher: (input, init) => fetch(`${base}${String(input)}`, init),
  });

  const list = await clientInstance.listDiscountPolicies(new Date('2026-06-01T00:00:00Z'));
  assert.equal(list.length, 1);
  assert.equal(list[0]!.code, 'BOLSA-20');
  assert.equal(list[0]!.latestVersion.version, 2);
  assert.equal(list[0]!.currentApplicableVersion?.version, 1);

  // 10. Archive policy -> 200
  const archived = await clientInstance.archiveDiscountPolicy(policyId);
  assert.equal(archived.status, 'archived');

  console.log('Finance discount policy HTTP & client: PASS');
} finally {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  await pool.end();
}
