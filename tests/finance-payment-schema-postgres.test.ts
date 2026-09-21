import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
const schema = `finance_pay_schema_${randomUUID().replaceAll('-', '')}`;
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${quote(schema)},public` });
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionA = '00000000-0000-0000-0000-000000000201';
const institutionB = '00000000-0000-0000-0000-000000000202';
const actorA = '00000000-0000-0000-0000-000000000211';
const actorB = '00000000-0000-0000-0000-000000000212';

try {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)}, public`);

    // Verify migrations discovery and run
    const migrations = await discoverMigrations(migrationsDir);
    const has0035 = migrations.some(m => m.filename.includes('0104_finance_payments_and_provider_config'));
    assert.ok(has0035, 'Migration 0035 must be discoverable');

    await runMigrations(client, migrations);

    // Setup base data
    await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES ($1,'Inst A','inst-a','active'),($2,'Inst B','inst-b','active')`, [institutionA, institutionB]);
    await client.query(`INSERT INTO people(id,name) VALUES ($1,'Actor A'),($2,'Actor B')`, [actorA, actorB]);
    await client.query(`INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies) VALUES ($1,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR"]'),($2,1,now(),'AO','AOA','Africa/Luanda','v1','["AOA"]')`, [institutionA, institutionB]);

    // Create journal transaction for Inst A
    const journalTxA = randomUUID();
    await client.query(`INSERT INTO finance_journal_transactions (id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at) VALUES ($1,$2,'confirmed','EUR','100.00','cmd-1','foundation_value_received',$3,1,now())`, [journalTxA, institutionA, actorA]);

    // Create financial account for Inst A
    const accountA = randomUUID();
    await client.query(`INSERT INTO finance_financial_accounts (id, institution_id, account_number, name) VALUES ($1, $2, 'CTA-000001', 'Conta A')`, [accountA, institutionA]);

    // 1. Insert valid manual payment
    const paymentId1 = randomUUID();
    await client.query(`
      INSERT INTO finance_payments (
        id, institution_id, payment_reference, journal_transaction_id, source_type, method,
        amount, currency, status, allocation_status, financial_account_id, payer_person_id,
        effective_at, financial_profile_version, actor_person_id
      ) VALUES (
        $1, $2, 'PAY-000001', $3, 'manual_offline', 'cash',
        100.00, 'EUR', 'confirmed', 'unapplied', $4, $5,
        now(), 1, $6
      )
    `, [paymentId1, institutionA, journalTxA, accountA, actorA, actorA]);

    // 2. Reject manual payment with provider_key (source invariants check)
    await assert.rejects(
      () => client.query(`
        INSERT INTO finance_payments (
          id, institution_id, payment_reference, journal_transaction_id, source_type, method,
          amount, currency, status, allocation_status, provider_key,
          effective_at, financial_profile_version, actor_person_id
        ) VALUES (
          gen_random_uuid(), $1, 'PAY-000002', $2, 'manual_offline', 'cash',
          50.00, 'EUR', 'confirmed', 'unapplied', 'adyen',
          now(), 1, $3
        )
      `, [institutionA, journalTxA, actorA]),
      /chk_finance_payments_source_invariants/i
    );

    // 3. Reject provider payment with missing provider_event_id
    await assert.rejects(
      () => client.query(`
        INSERT INTO finance_payments (
          id, institution_id, payment_reference, journal_transaction_id, source_type, method,
          amount, currency, status, allocation_status, provider_key,
          effective_at, financial_profile_version, actor_person_id
        ) VALUES (
          gen_random_uuid(), $1, 'PAY-000003', $2, 'provider', 'card',
          50.00, 'EUR', 'confirmed', 'unapplied', 'adyen',
          now(), 1, $3
        )
      `, [institutionA, journalTxA, actorA]),
      /chk_finance_payments_source_invariants/i
    );

    // 4. Reject zero / negative amount
    await assert.rejects(
      () => client.query(`
        INSERT INTO finance_payments (
          id, institution_id, payment_reference, journal_transaction_id, source_type, method,
          amount, currency, status, allocation_status,
          effective_at, financial_profile_version, actor_person_id
        ) VALUES (
          gen_random_uuid(), $1, 'PAY-000004', $2, 'manual_offline', 'cash',
          0, 'EUR', 'confirmed', 'unapplied',
          now(), 1, $3
        )
      `, [institutionA, journalTxA, actorA]),
      /finance_payments_amount_exact_envelope/i
    );

    // 5. Foreign tenant journal transaction rejection
    await assert.rejects(
      () => client.query(`
        INSERT INTO finance_payments (
          id, institution_id, payment_reference, journal_transaction_id, source_type, method,
          amount, currency, status, allocation_status,
          effective_at, financial_profile_version, actor_person_id
        ) VALUES (
          gen_random_uuid(), $1, 'PAY-000005', $2, 'manual_offline', 'cash',
          10.00, 'AOA', 'confirmed', 'unapplied',
          now(), 1, $3
        )
      `, [institutionB, journalTxA, actorB]), // Inst B using Journal Tx of Inst A
      /fk_finance_payments_journal_tenant/i
    );

    // 6. Foreign tenant financial account rejection
    await assert.rejects(
      () => client.query(`
        INSERT INTO finance_payments (
          id, institution_id, payment_reference, journal_transaction_id, source_type, method,
          amount, currency, status, allocation_status, financial_account_id,
          effective_at, financial_profile_version, actor_person_id
        ) VALUES (
          gen_random_uuid(), $1, 'PAY-000006', $2, 'manual_offline', 'cash',
          10.00, 'EUR', 'confirmed', 'unapplied', $3,
          now(), 1, $4
        )
      `, [institutionA, journalTxA, randomUUID(), actorA]), // non-existent or foreign account
      /fk_finance_payments_financial_account_tenant/i
    );

    // 7. Immutability trigger: rejection of UPDATE to economic fields and DELETE
    await assert.rejects(
      () => client.query(`UPDATE finance_payments SET amount = 200 WHERE id = $1`, [paymentId1]),
      /immutable/i
    );

    await assert.rejects(
      () => client.query(`DELETE FROM finance_payments WHERE id = $1`, [paymentId1]),
      /immutable/i
    );

    // 8. Provider configuration table validation
    const configId = randomUUID();
    await client.query(`
      INSERT INTO finance_payment_provider_configs (
        id, institution_id, provider_key, environment, status, merchant_account_ref,
        supported_currencies, enabled_methods, operational_availability, secret_reference_id
      ) VALUES (
        $1, $2, 'adyen', 'test', 'active', 'MERCHANT_NEXUS_PT',
        '["EUR"]'::jsonb, '["card", "mbway"]'::jsonb, 'available', 'vault://adyen/inst-a/secret'
      )
    `, [configId, institutionA]);

    // Unique provider per institution
    await assert.rejects(
      () => client.query(`
        INSERT INTO finance_payment_provider_configs (
          id, institution_id, provider_key, environment, status, merchant_account_ref,
          supported_currencies, enabled_methods, operational_availability, secret_reference_id
        ) VALUES (
          gen_random_uuid(), $1, 'adyen', 'test', 'active', 'MERCHANT_NEXUS_PT_2',
          '["EUR"]'::jsonb, '["card"]'::jsonb, 'available', 'vault://adyen/inst-a/secret2'
        )
      `, [institutionA]),
      /uq_finance_provider_configs_inst_provider/i
    );

    // 9. Migration 0036: actor_kind invariants in journal and payments
    // Journal: provider actor must have null actor_person_id
    const journalProviderId = randomUUID();
    await client.query(`
      INSERT INTO finance_journal_transactions (
        id, institution_id, status, currency, amount, command_id, journal_type,
        actor_kind, actor_person_id, financial_profile_version, confirmed_at
      ) VALUES (
        $1, $2, 'confirmed', 'EUR', '50.00', 'cmd-prov', 'foundation_value_received',
        'provider', NULL, 1, now()
      )
    `, [journalProviderId, institutionA]);

    // Journal: human actor without actor_person_id rejected
    await assert.rejects(
      () => client.query(`
        INSERT INTO finance_journal_transactions (
          id, institution_id, status, currency, amount, command_id, journal_type,
          actor_kind, actor_person_id, financial_profile_version, confirmed_at
        ) VALUES (
          gen_random_uuid(), $1, 'confirmed', 'EUR', '50.00', 'cmd-fail', 'foundation_value_received',
          'human', NULL, 1, now()
        )
      `, [institutionA]),
      /finance_journal_transactions_actor_provenance/i
    );

    // Payments: provider actor without actor_person_id succeeds
    await client.query(`
      INSERT INTO finance_payments (
        id, institution_id, payment_reference, journal_transaction_id, source_type, method,
        amount, currency, status, allocation_status, provider_key, provider_event_id, provider_transaction_ref,
        effective_at, financial_profile_version, actor_kind, actor_person_id
      ) VALUES (
        gen_random_uuid(), $1, 'PAY-PROV-001', $2, 'provider', 'card',
        50.00, 'EUR', 'confirmed', 'unapplied', 'adyen', 'EVT-001', 'TXN-001',
        now(), 1, 'provider', NULL
      )
    `, [institutionA, journalProviderId]);

    // Payments: provider actor with non-null actor_person_id rejected
    await assert.rejects(
      () => client.query(`
        INSERT INTO finance_payments (
          id, institution_id, payment_reference, journal_transaction_id, source_type, method,
          amount, currency, status, allocation_status, provider_key, provider_event_id, provider_transaction_ref,
          effective_at, financial_profile_version, actor_kind, actor_person_id
        ) VALUES (
          gen_random_uuid(), $1, 'PAY-PROV-002', $2, 'provider', 'card',
          50.00, 'EUR', 'confirmed', 'unapplied', 'adyen', 'EVT-002', 'TXN-002',
          now(), 1, 'provider', $3
        )
      `, [institutionA, journalProviderId, actorA]),
      /finance_payments_actor_provenance/i
    );

    // 10. P1-B Proof: premature allocation states rejected in PostgreSQL & F3 exposes no allocation-derived state
    for (const invalidAllocationStatus of ['partially_applied', 'fully_applied', 'applied', 'allocated']) {
      await assert.rejects(
        () => client.query(`
          INSERT INTO finance_payments (
            id, institution_id, payment_reference, journal_transaction_id, source_type, method,
            amount, currency, status, allocation_status, provider_key, provider_event_id, provider_transaction_ref,
            effective_at, financial_profile_version, actor_kind, actor_person_id
          ) VALUES (
            gen_random_uuid(), $1, 'PAY-ALLOC-FAIL', $2, 'provider', 'card',
            50.00, 'EUR', 'confirmed', $3, 'adyen', 'EVT-ALLOC', 'TXN-ALLOC',
            now(), 1, 'provider', NULL
          )
        `, [institutionA, journalProviderId, invalidAllocationStatus]),
        /chk_finance_payments_allocation_status_f3|allocation_status/i
      );
    }

    console.log('Finance Payment Schema PostgreSQL: PASS');
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
