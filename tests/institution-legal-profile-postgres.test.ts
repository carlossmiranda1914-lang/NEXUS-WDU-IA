import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import pg from 'pg';
import test from 'node:test';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { InstitutionLegalProfileRepository } from '../src/modules/institution/institution-legal-profile.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

test('legal profiles are institution-scoped, effective-dated, and historically versioned', async () => {
  await verifyApprovedTestConnection();
  const schema = `institution_legal_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(path.resolve(process.cwd(), 'src/db/migrations')));
      const firstInstitution = randomUUID();
      const secondInstitution = randomUUID();
      await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','legal-a','active'),($2,'B','legal-b','active')", [firstInstitution, secondInstitution]);
      const repository = new InstitutionLegalProfileRepository(client);
      const first = await repository.createVersion({ institutionId: firstInstitution, legalName: 'Nexus Escola A', taxIdentifier: 'A-1', registeredAddress: { countryCode: 'PT', line1: 'Rua A' }, effectiveFrom: new Date('2026-01-01T00:00:00Z') });
      const second = await repository.createVersion({ institutionId: firstInstitution, legalName: 'Nexus Escola A Nova', taxIdentifier: 'A-2', registeredAddress: { countryCode: 'PT', line1: 'Rua B' }, effectiveFrom: new Date('2026-02-01T00:00:00Z') });
      assert.equal(first.version, 1);
      assert.equal(second.version, 2);
      assert.equal((await repository.resolveEffective(firstInstitution, new Date('2026-01-15T00:00:00Z')))?.legalName, 'Nexus Escola A');
      assert.equal((await repository.resolveEffective(firstInstitution, new Date('2026-02-15T00:00:00Z')))?.legalName, 'Nexus Escola A Nova');
      assert.equal(await repository.resolveEffective(secondInstitution, new Date('2026-02-15T00:00:00Z')), null);
    } finally { client.release(); }
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});
