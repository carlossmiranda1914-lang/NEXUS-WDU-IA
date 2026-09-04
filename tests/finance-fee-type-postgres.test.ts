import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import path from 'node:path';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import {
  PostgresFeeTypeRepository,
  FeeTypeConflictError,
  FeeTypeNotFoundError,
} from '../src/modules/finance/fee-type-repository.ts';

await verifyApprovedTestConnection();
const schema = `fee_type_${randomUUID().replaceAll('-', '')}`;
const quote = (x: string) => `"${x}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${schema},public`,
});

try {
  const c = await pool.connect();
  try {
    await c.query(`CREATE SCHEMA ${quote(schema)}`);
    await c.query(`SET search_path TO ${quote(schema)},public`);
    await runMigrations(c, await discoverMigrations(path.resolve('src/db/migrations')));

    const instA = randomUUID();
    const instB = randomUUID();
    const personA = randomUUID();
    const personB = randomUUID();

    await c.query(`INSERT INTO institutions(id, name, slug, status) VALUES($1, 'Inst A', 'a', 'active'), ($2, 'Inst B', 'b', 'active')`, [instA, instB]);
    await c.query(`INSERT INTO people(id, name) VALUES($1, 'Person A'), ($2, 'Person B')`, [personA, personB]);

    const repo = new PostgresFeeTypeRepository(pool);
    const actorA = { institutionId: instA, personId: personA, role: 'financial' };
    const actorB = { institutionId: instB, personId: personB, role: 'financial' };

    // 1. Auto-provision baseline classifications for Institution A
    const listA = await repo.list(actorA);
    assert.equal(listA.length, 10, 'Must auto-provision 10 Nexus baseline fee types');
    assert.ok(listA.every((t) => t.source === 'nexus_base'));
    assert.ok(listA.every((t) => t.status === 'active'));

    const tuitionA = listA.find((t) => t.codePrefix === 'PROP');
    assert.ok(tuitionA, 'Must find PROP baseline type');
    assert.equal(tuitionA.canonicalKey, 'tuition');

    // 2. Custom Type Creation
    const customCreate = await repo.create(
      actorA,
      { displayName: 'Laboratório de Ciências', codePrefix: 'LAB' },
      'key-create-lab',
    );
    assert.equal(customCreate.result.codePrefix, 'LAB');
    assert.equal(customCreate.result.source, 'institution_custom');
    assert.equal(customCreate.result.status, 'active');

    // Replay idempotency
    const replayed = await repo.create(
      actorA,
      { displayName: 'Laboratório de Ciências', codePrefix: 'LAB' },
      'key-create-lab',
    );
    assert.equal(replayed.replayed, true);
    assert.equal(replayed.result.id, customCreate.result.id);

    // 3. Duplicate Prefix Rejection for same institution
    await assert.rejects(
      () =>
        repo.create(
          actorA,
          { displayName: 'Outro Laboratório', codePrefix: 'LAB' },
          'key-create-lab-dup',
        ),
      FeeTypeConflictError,
      'Duplicate prefix in same institution must throw FeeTypeConflictError',
    );

    // Duplicate baseline prefix rejection
    await assert.rejects(
      () =>
        repo.create(
          actorA,
          { displayName: 'Propinas Custom', codePrefix: 'PROP' },
          'key-create-prop-dup',
        ),
      FeeTypeConflictError,
      'Duplicate prefix matching baseline must throw FeeTypeConflictError',
    );

    // 4. Cross-Tenant Isolation: Institution B can independently use prefix 'LAB'
    const customB = await repo.create(
      actorB,
      { displayName: 'Laboratório B', codePrefix: 'LAB' },
      'key-create-lab-b',
    );
    assert.equal(customB.result.codePrefix, 'LAB');
    assert.notEqual(customB.result.id, customCreate.result.id, 'IDs must be distinct across institutions');

    // Institution B cannot access Institution A custom type
    await assert.rejects(
      () => repo.getById(actorB, customCreate.result.id),
      FeeTypeNotFoundError,
      'Cross-tenant read must fail with FeeTypeNotFoundError',
    );

    // 5. Activation and Deactivation
    const deact = await repo.setStatus(actorA, customCreate.result.id, 'inactive', 'key-deact-lab');
    assert.equal(deact.result.status, 'inactive');

    const activeOnlyA = await repo.list(actorA, 'active');
    assert.ok(!activeOnlyA.some((t) => t.id === customCreate.result.id), 'Deactivated type must not appear in active list');

    const allA = await repo.list(actorA, 'all');
    assert.ok(allA.some((t) => t.id === customCreate.result.id && t.status === 'inactive'), 'Must appear in all list');

    // Reactivate
    const react = await repo.setStatus(actorA, customCreate.result.id, 'active', 'key-act-lab');
    assert.equal(react.result.status, 'active');

    console.log('Finance fee type PostgreSQL repository: PASS');
  } finally {
    c.release();
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
