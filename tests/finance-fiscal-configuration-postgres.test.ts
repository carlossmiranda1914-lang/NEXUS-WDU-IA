import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { PostgresFiscalConfigurationStore } from '../src/modules/finance/fiscal-configuration.ts';
import { FiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';

test('F7-02 starts with a Finance-owned versioned fiscal configuration migration', async () => {
  await assert.doesNotReject(() => readFile(new URL('../src/db/migrations/0042_finance_fiscal_configuration.sql', import.meta.url), 'utf8'));
});

test('F7-02 fiscal configurations reject overlapping effective versions per institution', async () => {
  await verifyApprovedTestConnection();
  const schema = `finance_fiscal_config_${randomUUID().replaceAll('-', '')}`;
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
  const institutionId = randomUUID();
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations')));
      await client.query("INSERT INTO institutions(id,name,slug,status) VALUES($1,'Fiscal config','fiscal-config','active')", [institutionId]);
      await client.query("INSERT INTO finance_fiscal_configuration_versions(institution_id,version,adapter_key,effective_from,effective_to) VALUES($1,1,'core',TIMESTAMPTZ '2026-01-01',TIMESTAMPTZ '2026-12-31')", [institutionId]);
      await assert.rejects(() => client.query("INSERT INTO finance_fiscal_configuration_versions(institution_id,version,adapter_key,effective_from,effective_to) VALUES($1,2,'core',TIMESTAMPTZ '2026-06-01',TIMESTAMPTZ '2027-01-01')", [institutionId]), /overlap|exclude/i);
    } finally { client.release(); }
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => undefined); await pool.end(); }
});

test('F7-02 resolves only the effective fiscal configuration for its institution', async () => {
  const store = new PostgresFiscalConfigurationStore({ query: async () => ({ rows: [] }) } as never);
  await assert.rejects(() => store.requireEffective('institution-a', new Date('2026-01-01T00:00:00.000Z')), /FISCAL_CONFIGURATION_NOT_EFFECTIVE/);
});

test('F7-02 adapter selection is derived from the financial profile and fails closed', () => {
  const registry = new FiscalAdapterRegistry([{ key: 'core', supportedJurisdictions: ['NEXUS_TEST'] }]);
  assert.equal(registry.select({ primaryJurisdiction: 'NEXUS_TEST' }, { adapterKey: 'core' }).key, 'core');
  assert.throws(() => registry.select({ primaryJurisdiction: 'UNSUPPORTED' }, { adapterKey: 'core' }), /FISCAL_ADAPTER_UNSUPPORTED_JURISDICTION/);
});
