import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import path from 'node:path';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { PostgresFinancialAccountRepository } from '../src/modules/finance/financial-account-repository.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();
const schema = `fin_acc_${randomUUID().replaceAll('-', '')}`;
const quote = (x: string) => `"${x}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});

const institutionA = '00000000-0000-0000-0000-000000000001';
const institutionB = '00000000-0000-0000-0000-000000000002';
const personA = '00000000-0000-0000-0000-000000000011';
const personB = '00000000-0000-0000-0000-000000000022';

const actorA: InstitutionalContext = {
  institutionId: institutionA,
  personId: personA,
  personName: 'Admin A',
  identityEmail: 'admin.a@test.local',
  membershipId: '00000000-0000-0000-0000-000000000091',
  institutionName: 'Inst A',
  institutionSlug: 'inst-a',
  role: 'institution_admin',
};

const actorB: InstitutionalContext = {
  institutionId: institutionB,
  personId: personB,
  personName: 'Admin B',
  identityEmail: 'admin.b@test.local',
  membershipId: '00000000-0000-0000-0000-000000000092',
  institutionName: 'Inst B',
  institutionSlug: 'inst-b',
  role: 'institution_admin',
};

async function runTests() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)},public`);
    await runMigrations(client, await discoverMigrations(path.resolve('src/db/migrations')));

    // Seed institutions, people, and memberships
    await client.query(`
      INSERT INTO institutions (id, name, slug) VALUES 
        ('${institutionA}', 'Inst A', 'inst-a'),
        ('${institutionB}', 'Inst B', 'inst-b')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO people (id, name, email) VALUES
        ('${personA}', 'Person A', 'person.a@test.local'),
        ('${personB}', 'Person B', 'person.b@test.local')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO memberships (institution_id, person_id, role, status) VALUES
        ('${institutionA}', '${personA}', 'institution_admin', 'active'),
        ('${institutionB}', '${personB}', 'institution_admin', 'active')
      ON CONFLICT DO NOTHING;
    `);

    const repo = new PostgresFinancialAccountRepository(pool);

    // 1. Create Financial Account in Institution A
    const acc1 = await repo.create(actorA, {
      name: 'Conta Familia Santos',
      primaryPersonId: personA,
    }, 'key-acc-1');

    assert.ok(acc1.id);
    assert.equal(acc1.institutionId, institutionA);
    assert.equal(acc1.name, 'Conta Familia Santos');
    assert.equal(acc1.status, 'active');
    assert.ok(acc1.accountNumber.startsWith('CTA-'), 'Account number must start with CTA-');
    assert.equal(acc1.primaryParty?.personId, personA);

    // 2. Second account gets incremented sequence
    const acc2 = await repo.create(actorA, {
      name: 'Conta Empresa Alpha',
      primaryPersonId: personA,
    }, 'key-acc-2');
    assert.notEqual(acc1.accountNumber, acc2.accountNumber);

    // 3. List accounts in Institution A
    const listA = await repo.list(actorA);
    assert.ok(listA.length >= 2);
    assert.ok(listA.some((a) => a.id === acc1.id));

    // 4. Tenant isolation: Institution B cannot see Institution A accounts
    const listB = await repo.list(actorB);
    assert.ok(!listB.some((a) => a.id === acc1.id));

    // 5. Institution B cannot getById Institution A account (404)
    await assert.rejects(async () => {
      await repo.getById(actorB, acc1.id);
    }, (err: any) => err.code === 'FINANCIAL_ACCOUNT_NOT_FOUND');

    // 6. Update account name
    const updated = await repo.update(actorA, acc1.id, { name: 'Conta Familia Santos Renovada' });
    assert.equal(updated.name, 'Conta Familia Santos Renovada');

    // 7. Deactivate and activate status
    const deact = await repo.setStatus(actorA, acc1.id, 'inactive');
    assert.equal(deact.status, 'inactive');

    const react = await repo.setStatus(actorA, acc1.id, 'active');
    assert.equal(react.status, 'active');

    console.log('Finance financial account PostgreSQL tests: PASS');
  } finally {
    client.release();
    await pool.end();
  }
}

runTests().catch((e) => {
  console.error('Test failure:', e);
  process.exit(1);
});
