import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import {
  PostgresPaymentProviderRepository,
  PaymentProviderConfigNotFoundError,
} from '../src/modules/finance/payment-provider-repository.ts';
import {
  PaymentProviderValidationError,
  toPublicProviderConfigProjection,
} from '../src/modules/finance/payment-provider-model.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_prov_cfg_${randomUUID().replaceAll('-', '')}`;
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionA = '00000000-0000-0000-0000-000000000501';
const institutionB = '00000000-0000-0000-0000-000000000502';
const actorA = '00000000-0000-0000-0000-000000000511';
const actorB = '00000000-0000-0000-0000-000000000512';

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);

    const migrations = await discoverMigrations(migrationsDir);
    await runMigrations(client, migrations);

    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES ($1,'Inst A','inst-a','active'),($2,'Inst B','inst-b','active')`, [institutionA, institutionB]);
    await client.query(`INSERT INTO people(id,name) VALUES ($1,'Actor A'),($2,'Actor B')`, [actorA, actorB]);

    const repo = new PostgresPaymentProviderRepository(pool);

    // 1. Save Adyen sandbox config for Inst A
    const adyenConfig = await repo.save(
      { institutionId: institutionA, personId: actorA, role: 'institution_admin' },
      {
        providerKey: 'adyen',
        environment: 'test',
        status: 'active',
        merchantAccountRef: 'MERCHANT_NEXUS_PT',
        supportedCurrencies: ['EUR', 'USD'],
        enabledMethods: ['card', 'mbway'],
        operationalAvailability: 'available',
        secretReferenceId: 'vault://secrets/adyen/inst-a',
        webhookEndpointRef: 'https://nexus.edu/api/finance/webhooks/adyen',
      }
    );

    assert.equal(adyenConfig.institutionId, institutionA);
    assert.equal(adyenConfig.providerKey, 'adyen');
    assert.equal(adyenConfig.environment, 'test');
    assert.equal(adyenConfig.status, 'active');
    assert.equal(adyenConfig.merchantAccountRef, 'MERCHANT_NEXUS_PT');
    assert.deepEqual(adyenConfig.supportedCurrencies, ['EUR', 'USD']);
    assert.deepEqual(adyenConfig.enabledMethods, ['card', 'mbway']);
    assert.equal(adyenConfig.secretReferenceId, 'vault://secrets/adyen/inst-a');

    // 2. Public projection removes secretReferenceId
    const publicProj = toPublicProviderConfigProjection(adyenConfig);
    assert.equal((publicProj as any).secretReferenceId, undefined);
    assert.equal(publicProj.providerKey, 'adyen');
    assert.equal(publicProj.environment, 'test');

    // 3. Resolve active config
    const active = await repo.resolveActiveConfig(institutionA, 'adyen');
    assert.ok(active);
    assert.equal(active.id, adyenConfig.id);

    // 4. Inactive config resolution returns null
    await repo.save(
      { institutionId: institutionA, personId: actorA, role: 'institution_admin' },
      {
        providerKey: 'emis_multicaixa',
        environment: 'test',
        status: 'inactive',
        merchantAccountRef: 'EMIS_MERCHANT_001',
        supportedCurrencies: ['AOA'],
        enabledMethods: ['multicaixa', 'gpo'],
        operationalAvailability: 'available',
        secretReferenceId: 'vault://secrets/emis/inst-a',
      }
    );

    const activeEmis = await repo.resolveActiveConfig(institutionA, 'emis_multicaixa');
    assert.equal(activeEmis, null, 'Inactive provider must not be resolved as active');

    // 5. Tenant isolation: Inst B cannot see or get Inst A configs
    const instBList = await repo.list({ institutionId: institutionB });
    assert.equal(instBList.length, 0);

    const instAGetFromB = await repo.getByProviderKey({ institutionId: institutionB }, 'adyen');
    assert.equal(instAGetFromB, null);

    // 6. Validation: reject invalid provider key
    await assert.rejects(
      () => repo.save(
        { institutionId: institutionA, personId: actorA, role: 'institution_admin' },
        {
          providerKey: 'stripe' as any,
          environment: 'test',
          status: 'active',
          merchantAccountRef: 'STRIPE_ACC',
          supportedCurrencies: ['EUR'],
          enabledMethods: ['card'],
          operationalAvailability: 'available',
          secretReferenceId: 'vault://stripe',
        }
      ),
      (err: any) => err instanceof PaymentProviderValidationError
    );

    console.log('Finance Payment Provider Config PostgreSQL: PASS');
  } finally {
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
