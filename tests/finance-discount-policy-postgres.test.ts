import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDiscountPolicyRepository } from '../src/modules/finance/discount-policy-repository.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_discount_policy_${randomUUID().replaceAll('-', '')}`;
const q = (v: string) => `"${v.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${q(schema)},public` });
const institutionId = randomUUID();
const personId = randomUUID();
const actor = {
  personId,
  personName: 'Financial Admin',
  identityEmail: null,
  membershipId: randomUUID(),
  institutionId,
  institutionName: 'Discount School',
  institutionSlug: 'discount-school',
  role: 'financial' as const,
};

const repo = new PostgresDiscountPolicyRepository(pool);

try {
  const c = await pool.connect();
  try {
    await c.query(`CREATE SCHEMA ${q(schema)}`);
    await runMigrations(c, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
    await c.query(`INSERT INTO institutions(id, name, slug, status) VALUES ($1, 'Discount School', 'discount-school', 'active')`, [institutionId]);
    await c.query(`INSERT INTO people(id, name) VALUES ($1, 'Admin')`, [personId]);
  } finally {
    c.release();
  }

  // 1. Create policy with version 1
  const policy = await repo.createDiscountPolicy(actor, {
    code: 'BOLSA-20',
    name: 'Bolsa de Mérito 20%',
    description: 'Bolsa de mérito inicial',
    calculationMode: 'percentage',
    value: '20.00',
    currency: null,
    effectiveFrom: new Date('2026-09-01T00:00:00Z'),
    effectiveTo: new Date('2027-08-31T23:59:59Z'),
  });

  assert.equal(policy.code, 'BOLSA-20');
  assert.equal(policy.status, 'active');
  assert.equal(policy.version.version, 1);
  assert.equal(policy.version.value, '20');

  // 2. Reject overlapping version interval
  await assert.rejects(
    () =>
      repo.createDiscountPolicyVersion(actor, policy.id, {
        name: 'Bolsa 25% Overlap',
        description: null,
        calculationMode: 'percentage',
        value: '25.00',
        currency: null,
        effectiveFrom: new Date('2027-01-01T00:00:00Z'),
        effectiveTo: new Date('2027-12-31T23:59:59Z'),
      }),
    /overlap|DISCOUNT_POLICY_OVERLAPPING_INTERVAL/i
  );

  // 3. Create non-overlapping future version
  const v2 = await repo.createDiscountPolicyVersion(actor, policy.id, {
    name: 'Bolsa de Mérito 25%',
    description: 'Atualização para 25%',
    calculationMode: 'percentage',
    value: '25.00',
    currency: null,
    effectiveFrom: new Date('2027-09-01T00:00:00Z'),
    effectiveTo: new Date('2028-08-31T23:59:59Z'),
  });

  assert.equal(v2.version, 2);
  assert.equal(v2.value, '25');

  // 4. Resolve applicable version at different instants
  const appInstant2026 = new Date('2026-10-15T12:00:00Z');
  const res2026 = await repo.resolveApplicablePolicyVersion(institutionId, policy.id, appInstant2026);
  assert.ok(res2026);
  assert.equal(res2026.version, 1);
  assert.equal(res2026.value, '20');

  const appInstant2027 = new Date('2027-10-15T12:00:00Z');
  const res2027 = await repo.resolveApplicablePolicyVersion(institutionId, policy.id, appInstant2027);
  assert.ok(res2027);
  assert.equal(res2027.version, 2);
  assert.equal(res2027.value, '25');

  const appInstantExpired = new Date('2029-01-01T00:00:00Z');
  const resExpired = await repo.resolveApplicablePolicyVersion(institutionId, policy.id, appInstantExpired);
  assert.equal(resExpired, null);

  // 5. Concurrent version creation race test (CONCURRENT_POLICY_VERSION_CREATE)
  const concurrentPolicy = await repo.createDiscountPolicy(actor, {
    code: 'IRMAOS-10',
    name: 'Desconto Irmãos 10 EUR',
    description: null,
    calculationMode: 'fixed_amount',
    value: '10.00',
    currency: 'EUR',
    effectiveFrom: new Date('2026-09-01T00:00:00Z'),
    effectiveTo: new Date('2027-08-31T23:59:59Z'),
  });

  // Both attempt to create version 2 overlapping in 2027-09-01 to 2028-08-31
  const results = await Promise.allSettled([
    repo.createDiscountPolicyVersion(actor, concurrentPolicy.id, {
      name: 'Irmãos 15 EUR Option A',
      description: null,
      calculationMode: 'fixed_amount',
      value: '15.00',
      currency: 'EUR',
      effectiveFrom: new Date('2027-09-01T00:00:00Z'),
      effectiveTo: new Date('2028-08-31T23:59:59Z'),
    }),
    repo.createDiscountPolicyVersion(actor, concurrentPolicy.id, {
      name: 'Irmãos 12 EUR Option B',
      description: null,
      calculationMode: 'fixed_amount',
      value: '12.00',
      currency: 'EUR',
      effectiveFrom: new Date('2027-09-01T00:00:00Z'),
      effectiveTo: new Date('2028-08-31T23:59:59Z'),
    }),
  ]);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');
  assert.equal(fulfilled.length, 1, 'Exactly one concurrent version creation must succeed');
  assert.equal(rejected.length, 1, 'Exactly one concurrent version creation must fail due to overlap check');

  // 6. Archive policy
  const archived = await repo.archiveDiscountPolicy(actor, policy.id);
  assert.equal(archived.status, 'archived');
  await assert.rejects(
    () =>
      repo.createDiscountPolicyVersion(actor, policy.id, {
        name: 'New ver on archived',
        description: null,
        calculationMode: 'percentage',
        value: '30.00',
        currency: null,
        effectiveFrom: new Date('2029-09-01T00:00:00Z'),
        effectiveTo: new Date('2030-08-31T23:59:59Z'),
      }),
    /archived/i
  );

  console.log('Finance discount policy PostgreSQL: PASS');
} finally {
  const c = await pool.connect().catch(() => undefined);
  if (c) {
    try { await c.query(`DROP SCHEMA IF EXISTS ${q(schema)} CASCADE`); } finally { c.release(); }
  }
  await pool.end();
}
