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
      assert.equal((await repository.resolveEffective(firstInstitution, new Date('2026-02-01T00:00:00Z')))?.legalName, 'Nexus Escola A Nova');
      assert.equal((await repository.resolveEffective(firstInstitution, new Date('2026-02-15T00:00:00Z')))?.legalName, 'Nexus Escola A Nova');
      assert.equal(await repository.resolveEffective(secondInstitution, new Date('2026-02-15T00:00:00Z')), null);
      await assert.rejects(() => client.query("UPDATE institution_legal_profiles SET legal_name='rewritten' WHERE institution_id=$1 AND version=1", [firstInstitution]));
      await assert.rejects(() => client.query('DELETE FROM institution_legal_profiles WHERE institution_id=$1 AND version=1', [firstInstitution]));
      await assert.rejects(() => repository.createVersion({ institutionId: firstInstitution, legalName: 'Overlap', taxIdentifier: null, registeredAddress: { countryCode: 'PT', line1: 'Rua C' }, effectiveFrom: new Date('2026-01-15T00:00:00Z') }));
      assert.equal((await repository.resolveEffective(firstInstitution, new Date('2026-02-15T00:00:00Z')))?.legalName, 'Nexus Escola A Nova');
    } finally { client.release(); }
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});

test('serializes same-institution allocation while independent institutions remain concurrent', async () => {
  await verifyApprovedTestConnection(); const schema=`institution_legal_serial_${randomUUID().replaceAll('-', '')}`; const quote=(value:string)=>`"${value.replaceAll('"','""')}"`; const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${quote(schema)},public`});
  try { const client=await pool.connect(); const a=randomUUID(),b=randomUUID(),c=randomUUID(); try { await client.query(`CREATE SCHEMA ${quote(schema)}`); await runMigrations(client,await discoverMigrations(path.resolve(process.cwd(),'src/db/migrations'))); await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'A','serial-a','active'),($2,'B','serial-b','active'),($3,'C','serial-c','active')",[a,b,c]); } finally { client.release(); }
    const repo=new InstitutionLegalProfileRepository(pool);
    const input=(institutionId:string,name:string,at:string)=>({institutionId,legalName:name,taxIdentifier:null,registeredAddress:{countryCode:'PT',line1:'Rua'},effectiveFrom:new Date(at)});
    const same=await Promise.all([repo.createVersion(input(a,'A1','2026-01-01T00:00:00Z')),repo.createVersion(input(a,'A2','2026-02-01T00:00:00Z'))]); assert.deepEqual(same.map(row=>row.version).sort(),[1,2]);
    const different=await Promise.all([repo.createVersion(input(b,'B1','2026-01-01T00:00:00Z')),repo.createVersion(input(c,'C1','2026-01-01T00:00:00Z'))]); assert.deepEqual(different.map(row=>row.version),[1,1]);
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(()=>undefined); await pool.end(); }
});

test('characterizes that concurrent first legal-profile versions currently race on allocation', async () => {
  await verifyApprovedTestConnection();
  const schema = `institution_legal_race_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
  try {
    const setup = await pool.connect();
    const institutionId = randomUUID();
    try {
      await setup.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(setup, await discoverMigrations(path.resolve(process.cwd(), 'src/db/migrations')));
      await setup.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Race','legal-race','active')", [institutionId]);
    } finally { setup.release(); }
    const [left, right] = await Promise.all([pool.connect(), pool.connect()]);
    try {
      await Promise.all([left.query('BEGIN'), right.query('BEGIN')]);
      await Promise.all([
        left.query('UPDATE institution_legal_profiles SET effective_to=$2 WHERE institution_id=$1 AND effective_to IS NULL AND effective_from < $2', [institutionId, new Date('2026-01-01T00:00:00Z')]),
        right.query('UPDATE institution_legal_profiles SET effective_to=$2 WHERE institution_id=$1 AND effective_to IS NULL AND effective_from < $2', [institutionId, new Date('2026-01-01T00:00:00Z')]),
      ]);
      const [leftMax, rightMax] = await Promise.all([
        left.query<{ version: number }>('SELECT COALESCE(MAX(version),0)::int version FROM institution_legal_profiles WHERE institution_id=$1', [institutionId]),
        right.query<{ version: number }>('SELECT COALESCE(MAX(version),0)::int version FROM institution_legal_profiles WHERE institution_id=$1', [institutionId]),
      ]);
      assert.equal(leftMax.rows[0]?.version, 0);
      assert.equal(rightMax.rows[0]?.version, 0, 'there is no per-institution allocation lock before MAX(version)');
      await left.query("INSERT INTO institution_legal_profiles(institution_id,version,legal_name,registered_address,effective_from) VALUES($1,1,'A',$2,$3)", [institutionId, { countryCode: 'PT', line1: 'Rua' }, new Date('2026-01-01T00:00:00Z')]);
      await left.query('COMMIT');
      await assert.rejects(() => right.query("INSERT INTO institution_legal_profiles(institution_id,version,legal_name,registered_address,effective_from) VALUES($1,1,'B',$2,$3)", [institutionId, { countryCode: 'PT', line1: 'Rua' }, new Date('2026-01-01T00:00:00Z')]));
      await right.query('ROLLBACK');
    } finally { left.release(); right.release(); }
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});
