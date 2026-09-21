import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import path from 'node:path';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { PostgresFeeCatalogueRepository } from '../src/modules/finance/fee-catalogue-repository.ts';
import { PostgresFeeTypeRepository } from '../src/modules/finance/fee-type-repository.ts';
import { FeeCatalogueValidationError } from '../src/modules/finance/fee-catalogue-model.ts';

await verifyApprovedTestConnection();
const schema = `fee_con_${randomUUID().replaceAll('-', '')}`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${schema},public`,
});

try {
  const c = await pool.connect();
  try {
    await c.query(`CREATE SCHEMA "${schema}"`);
    await runMigrations(c, await discoverMigrations(path.resolve('src/db/migrations')));

    const instA = randomUUID();
    const instB = randomUUID();
    const personA = randomUUID();

    await c.query(
      `INSERT INTO institutions(id, name, slug, status) VALUES($1, 'Inst A', 'a', 'active'), ($2, 'Inst B', 'b', 'active')`,
      [instA, instB],
    );
    await c.query(`INSERT INTO people(id, name) VALUES($1, 'Person A')`, [personA]);
    await c.query(
      `INSERT INTO finance_profile_versions(institution_id, version, effective_from, primary_jurisdiction, functional_currency, financial_timezone, monetary_policy_version, enabled_currencies)
       VALUES($1, 1, now() - interval '1 day', 'PT', 'EUR', 'UTC', 'v', '["EUR"]'),
             ($2, 1, now() - interval '1 day', 'PT', 'EUR', 'UTC', 'v', '["EUR"]')`,
      [instA, instB],
    );

    const profiles: any = {
      resolveEffective: async (id: string) => ({
        institutionId: id,
        version: 1,
        effectiveFrom: '2020-01-01T00:00:00Z',
        effectiveTo: null,
        primaryJurisdiction: 'PT',
        functionalCurrency: 'EUR',
        financialTimezone: 'UTC',
        monetaryPolicyVersion: 'v',
        enabledCurrencies: ['EUR'],
      }),
    };

    const typeRepo = new PostgresFeeTypeRepository(pool);
    const catRepo = new PostgresFeeCatalogueRepository(pool, profiles);

    const actorA = { institutionId: instA, personId: personA, role: 'financial' };
    const actorB = { institutionId: instB, personId: personA, role: 'financial' };

    // Get baseline types for Inst A & Inst B
    const typesA = await typeRepo.list(actorA);
    const typesB = await typeRepo.list(actorB);

    const tuitionTypeA = typesA.find((t) => t.codePrefix === 'PROP')!;
    const matriculaTypeA = typesA.find((t) => t.codePrefix === 'MATR')!;
    const tuitionTypeB = typesB.find((t) => t.codePrefix === 'PROP')!;

    // 1. Version Update Race Concurrency: Exactly one transaction succeeds
    const initialItem = (
      await catRepo.create(
        actorA,
        {
          feeTypeId: tuitionTypeA.id,
          name: 'Propina Base',
          amount: '100.00',
          currency: 'EUR',
          effectiveFrom: '2026-01-01T00:00:00Z',
        },
        'init-create',
      )
    ).result;

    const update1 = {
      name: 'Propina Update 1',
      description: null,
      amount: '110.00',
      currency: 'EUR',
      effectiveFrom: '2026-02-01T00:00:00Z',
      expectedVersion: 1,
    };
    const update2 = {
      name: 'Propina Update 2',
      description: null,
      amount: '120.00',
      currency: 'EUR',
      effectiveFrom: '2026-02-01T00:00:00Z',
      expectedVersion: 1,
    };

    const updateResults = await Promise.allSettled([
      catRepo.update(actorA, initialItem.id, update1, 'u1'),
      catRepo.update(actorA, initialItem.id, update2, 'u2'),
    ]);

    assert.equal(
      updateResults.filter((x) => x.status === 'fulfilled').length,
      1,
      'Exactly one concurrent update must succeed',
    );
    assert.equal((await catRepo.get(actorA, initialItem.id)).currentVersion, 2);

    // 2. Code Generation Concurrency: 10 concurrent creates on same type & institution
    const concurrentCreatePromises = Array.from({ length: 10 }).map((_, idx) =>
      catRepo.create(
        actorA,
        {
          feeTypeId: tuitionTypeA.id,
          name: `Propina Concorrente ${idx + 1}`,
          amount: `${100 + idx}.00`,
          currency: 'EUR',
          effectiveFrom: `2026-03-${String(idx + 1).padStart(2, '0')}T00:00:00Z`,
        },
        `concurrent-create-${idx}`,
      ),
    );

    const concurrentResults = await Promise.all(concurrentCreatePromises);
    const generatedCodes = concurrentResults.map((r) => r.result.code);

    // Assert all 10 items received unique codes starting with PROP-
    const uniqueCodes = new Set(generatedCodes);
    assert.equal(uniqueCodes.size, 10, 'All 10 concurrent creates must generate unique codes');
    assert.ok(
      generatedCodes.every((c) => c.startsWith('PROP-')),
      'All generated codes must start with prefix PROP-',
    );

    // 3. Different Fee Type in same institution has independent sequence starting at 000001
    const matriculaItem = (
      await catRepo.create(
        actorA,
        {
          feeTypeId: matriculaTypeA.id,
          name: 'MatrÃƒÂ­cula Inicial',
          amount: '50.00',
          currency: 'EUR',
          effectiveFrom: '2026-01-01T00:00:00Z',
        },
        'matr-create-1',
      )
    ).result;
    assert.equal(matriculaItem.code, 'MATR-000001', 'Independent type sequence must start at 000001');

    // 4. Different Institution has independent sequence starting at 000001
    const tuitionItemB = (
      await catRepo.create(
        actorB,
        {
          feeTypeId: tuitionTypeB.id,
          name: 'Propina Inst B',
          amount: '80.00',
          currency: 'EUR',
          effectiveFrom: '2026-01-01T00:00:00Z',
        },
        'inst-b-create-1',
      )
    ).result;
    assert.equal(tuitionItemB.code, 'PROP-000001', 'Cross-tenant sequence must start at 000001 in Inst B');

    // 5. Inactive Fee Type rejects new item creation
    await typeRepo.setStatus(actorA, tuitionTypeA.id, 'inactive', 'deact-tuition');
    await assert.rejects(
      () =>
        catRepo.create(
          actorA,
          {
            feeTypeId: tuitionTypeA.id,
            name: 'Propina Rejeitada',
            amount: '90.00',
            currency: 'EUR',
            effectiveFrom: '2026-01-01T00:00:00Z',
          },
          'create-inactive',
        ),
      FeeCatalogueValidationError,
      'Creation with inactive fee type must fail with FeeCatalogueValidationError',
    );

    console.log('Finance fee catalogue concurrency: PASS');
  } finally {
    c.release();
  }
} finally {
  const c = await pool.connect().catch(() => undefined);
  if (c) {
    try {
      await c.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      c.release();
    }
  }
  await pool.end();
}
