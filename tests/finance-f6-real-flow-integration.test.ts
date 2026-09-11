import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import { PostgresDiscountPolicyRepository } from '../src/modules/finance/discount-policy-repository.ts';
import { PostgresObligationDiscountRepository, ObligationDiscountValidationError } from '../src/modules/finance/obligation-discount-repository.ts';
import { PostgresFinanceOperationalContextRepository } from '../src/modules/finance/finance-operational-context-repository.ts';

if (process.env.TEST_DATABASE_LOCAL_AUTHORIZED !== 'true') {
  console.log('Skipping Postgres integration test: TEST_DATABASE_LOCAL_AUTHORIZED is not true.');
  process.exit(0);
}

await verifyApprovedTestConnection();

const schema = `finance_f6_flow_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const institutionId = randomUUID();
const personId = randomUUID();
const accountId = randomUUID();

const actor: InstitutionalContext = {
  personId,
  personName: 'Flow Integration Operator',
  identityEmail: null,
  membershipId: randomUUID(),
  institutionId,
  institutionName: 'Flow Integration Institution',
  institutionSlug: 'f6-flow-inst',
  role: 'institution_admin',
};

const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const discountPolicies = new PostgresDiscountPolicyRepository(pool);
const obligationDiscounts = new PostgresObligationDiscountRepository(pool);
const operationalContextRepo = new PostgresFinanceOperationalContextRepository(pool);

let feeItemId: string;
let testObligationId: string;
let policyBolsa20Id: string;
let policyIrmaos10Id: string;
let policyExcedente70Id: string;

describe('Finance F6-01: Real Flow Integration (End-to-End)', () => {
  before(async () => {
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA ${quote(schema)}`);
      await runMigrations(client, await discoverMigrations(migrationsDir));
      await client.query(`INSERT INTO institutions(id,name,slug,status) VALUES($1,'Flow Integration Institution','f6-flow-inst','active')`, [institutionId]);
      await client.query(`INSERT INTO people(id,name) VALUES($1,'Flow Integration Operator')`, [personId]);
      await client.query(
        `INSERT INTO finance_profile_versions(institution_id,version,effective_from,primary_jurisdiction,functional_currency,financial_timezone,monetary_policy_version,enabled_currencies)
         VALUES($1,1,now(),'PT','EUR','Europe/Lisbon','v1','["EUR"]')`,
        [institutionId]
      );
      await client.query(`INSERT INTO finance_financial_accounts(id,institution_id,account_number,name,status) VALUES($1,$2,'CTA-F6-FLOW','Conta Financeira Flow Test','active')`, [accountId, institutionId]);
      await client.query(`INSERT INTO finance_financial_account_parties(id,institution_id,financial_account_id,person_id,role,status) VALUES($1,$2,$3,$4,'primary_debtor','active')`, [randomUUID(), institutionId, accountId, personId]);

      const feeTypeId = randomUUID();
      feeItemId = randomUUID();
      await client.query(`INSERT INTO finance_fee_types(id,institution_id,source,display_name,code_prefix) VALUES($1,$2,'institution_custom','Propina Teste','PROP')`, [feeTypeId, institutionId]);
      await client.query(`INSERT INTO finance_fee_catalogue_items(id,institution_id,fee_type_id,code,current_version,created_by_person_id) VALUES($1,$2,$3,'PROP-000001',1,$4)`, [feeItemId, institutionId, feeTypeId, personId]);
      await client.query(`INSERT INTO finance_fee_catalogue_versions(institution_id,item_id,fee_type_id,version,name,kind,amount,currency,effective_from,created_by_person_id) VALUES($1,$2,$3,1,'Propina Mensal 100 EUR','fee',100,'EUR',now(),$4)`, [institutionId, feeItemId, feeTypeId, personId]);

      // Seed 100 EUR obligation
      testObligationId = randomUUID();
      await client.query(
        `INSERT INTO finance_obligations(id,institution_id,financial_account_id,fee_catalogue_item_id,fee_catalogue_version,source_type,source_ref,amount,currency,status,financial_profile_version,created_by_person_id,idempotency_key)
         VALUES($1,$2,$3,$4,1,'manual_finance','REF-OB-100',100.00,'EUR','open',1,$5,'idemp-ob-1')`,
        [testObligationId, institutionId, accountId, feeItemId, personId]
      );

      // Seed 40 EUR payment and allocation
      const paymentId = randomUUID();
      const journalId = randomUUID();
      await client.query(
        `INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at)
         VALUES($1,$2,'confirmed','EUR',40.00,'cmd-pay-40','foundation_value_received',$3,1,now())`,
        [journalId, institutionId, personId]
      );
      await client.query(
        `INSERT INTO finance_payments(id,institution_id,payment_reference,journal_transaction_id,source_type,method,amount,currency,status,allocation_status,financial_account_id,payer_person_id,effective_at,financial_profile_version,actor_person_id)
         VALUES($1,$2,'PAY-40-REF',$3,'manual_offline','cash',40.00,'EUR','confirmed','unapplied',$4,$5,now(),1,$5)`,
        [paymentId, institutionId, journalId, accountId, personId]
      );
      const allocJournalId = randomUUID();
      await client.query(
        `INSERT INTO finance_journal_transactions(id,institution_id,status,currency,amount,command_id,journal_type,actor_person_id,financial_profile_version,confirmed_at)
         VALUES($1,$2,'confirmed','EUR',40.00,'cmd-alloc-40','payment_allocation',$3,1,now())`,
        [allocJournalId, institutionId, personId]
      );
      await client.query(
        `INSERT INTO finance_allocations(id,institution_id,financial_account_id,payment_id,obligation_id,journal_transaction_id,amount,currency,effective_at,actor_person_id)
         VALUES($1,$2,$3,$4,$5,$6,40.00,'EUR',now(),$7)`,
        [randomUUID(), institutionId, accountId, paymentId, testObligationId, allocJournalId, personId]
      );
    } finally {
      client.release();
    }

    // Create 3 discount policies
    const p1 = await discountPolicies.createDiscountPolicy(actor, {
      code: 'BOLSA-20',
      name: 'Bolsa de Mérito (20%)',
      description: 'Desconto de 20% sobre o valor da propina.',
      calculationMode: 'percentage',
      value: '20',
    });
    policyBolsa20Id = p1.id;

    const p2 = await discountPolicies.createDiscountPolicy(actor, {
      code: 'IRMAOS-10',
      name: 'Desconto de Irmãos (10 EUR)',
      description: 'Desconto fixo de 10 EUR.',
      calculationMode: 'fixed_amount',
      value: '10.00',
      currency: 'EUR',
    });
    policyIrmaos10Id = p2.id;

    const p3 = await discountPolicies.createDiscountPolicy(actor, {
      code: 'EXCEDENTE-70',
      name: 'Desconto Extraordinário (70 EUR)',
      description: 'Desconto fixo de 70 EUR para teste de boundary floor.',
      calculationMode: 'fixed_amount',
      value: '70.00',
      currency: 'EUR',
    });
    policyExcedente70Id = p3.id;
  });

  after(async () => {
    try {
      await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
    } finally {
      await pool.end();
    }
  });

  it('Step 1: Initial position is 100 EUR original, 40 EUR covered, 60 EUR remaining', async () => {
    const ctx = await operationalContextRepo.getByFinancialAccountId(actor, accountId);
    const ob = ctx.openObligations.find((o) => o.id === testObligationId);
    assert.ok(ob, 'Obligation should be found');
    assert.equal(ob.original?.amount, '100');
    assert.equal(ob.effectiveDue?.amount, '100');
    assert.equal(ob.covered?.amount, '40');
    assert.equal(ob.remainingCoverable?.amount, '60');
    assert.equal(ob.activeDiscount, null);
  });

  let activeDiscountId: string;

  it('Step 2: Apply BOLSA-20 (20%) -> 80 EUR effective, 40 EUR covered, 40 EUR remaining', async () => {
    const result = await obligationDiscounts.applyObligationDiscount(
      actor,
      {
        obligationId: testObligationId,
        discountPolicyId: policyBolsa20Id,
        reason: 'Atribuição de bolsa por mérito académico comprovado.',
      },
      'idemp-apply-bolsa-20'
    );

    activeDiscountId = result.discount.id;
    assert.equal(result.discount.amount.canonicalAmount(), '20');
    assert.equal(result.position.effectiveDue.canonicalAmount(), '80');
    assert.equal(result.position.remainingCoverable.canonicalAmount(), '40');

    // Verify operational context projection
    const ctx = await operationalContextRepo.getByFinancialAccountId(actor, accountId);
    const ob = ctx.openObligations.find((o) => o.id === testObligationId);
    assert.ok(ob);
    assert.equal(ob.netDiscounts?.amount, '20');
    assert.equal(ob.effectiveDue?.amount, '80');
    assert.equal(ob.remainingCoverable?.amount, '40');
    assert.ok(ob.activeDiscount);
    assert.equal(ob.activeDiscount.amount.amount, '20');

    // Verify history has discount_applied
    const historyItem = ctx.history.find((h) => h.kind === 'discount_applied' && h.id === activeDiscountId);
    assert.ok(historyItem, 'discount_applied must appear in history');
  });

  it('Step 3: Attempt applying IRMAOS-10 while BOLSA-20 is active -> rejected DISCOUNT_ALREADY_ACTIVE', async () => {
    await assert.rejects(
      async () => {
        await obligationDiscounts.applyObligationDiscount(
          actor,
          {
            obligationId: testObligationId,
            discountPolicyId: policyIrmaos10Id,
            reason: 'Tentativa concorrente de segundo desconto.',
          },
          'idemp-apply-irmaos-rejected'
        );
      },
      (err: Error) => {
        assert.ok(err instanceof ObligationDiscountValidationError);
        assert.ok(err.message.includes('DISCOUNT_ALREADY_ACTIVE'));
        return true;
      }
    );
  });

  it('Step 4: Revoke BOLSA-20 -> position restored to 100 EUR effective, 60 EUR remaining', async () => {
    const result = await obligationDiscounts.revokeObligationDiscount(
      actor,
      {
        obligationId: testObligationId,
        discountId: activeDiscountId,
        reason: 'Correção de bolsa atribuída por lapso.',
      },
      'idemp-revoke-bolsa-20'
    );

    assert.equal(result.revocation.amount.canonicalAmount(), '20');
    assert.equal(result.position.effectiveDue.canonicalAmount(), '100');
    assert.equal(result.position.remainingCoverable.canonicalAmount(), '60');

    // Verify operational context projection
    const ctx = await operationalContextRepo.getByFinancialAccountId(actor, accountId);
    const ob = ctx.openObligations.find((o) => o.id === testObligationId);
    assert.ok(ob);
    assert.equal(ob.effectiveDue?.amount, '100');
    assert.equal(ob.remainingCoverable?.amount, '60');
    assert.equal(ob.activeDiscount, null);

    // Verify history has discount_revoked
    const revHistoryItem = ctx.history.find((h) => h.kind === 'discount_revoked' && h.id === result.revocation.id);
    assert.ok(revHistoryItem, 'discount_revoked must appear in history');
  });

  let secondDiscountId: string;

  it('Step 5: Apply IRMAOS-10 (10 EUR fixed) -> 90 EUR effective, 50 EUR remaining', async () => {
    const result = await obligationDiscounts.applyObligationDiscount(
      actor,
      {
        obligationId: testObligationId,
        discountPolicyId: policyIrmaos10Id,
        reason: 'Desconto de irmãos validado pelos serviços administrativos.',
      },
      'idemp-apply-irmaos-10'
    );

    secondDiscountId = result.discount.id;
    assert.equal(result.discount.amount.canonicalAmount(), '10');
    assert.equal(result.position.effectiveDue.canonicalAmount(), '90');
    assert.equal(result.position.remainingCoverable.canonicalAmount(), '50');

    const ctx = await operationalContextRepo.getByFinancialAccountId(actor, accountId);
    const ob = ctx.openObligations.find((o) => o.id === testObligationId);
    assert.ok(ob);
    assert.equal(ob.netDiscounts?.amount, '10');
    assert.equal(ob.effectiveDue?.amount, '90');
    assert.equal(ob.remainingCoverable?.amount, '50');
  });

  it('Step 6: Revoke IRMAOS-10 -> restored to 100 EUR / 60 EUR remaining', async () => {
    const result = await obligationDiscounts.revokeObligationDiscount(
      actor,
      {
        obligationId: testObligationId,
        discountId: secondDiscountId,
        reason: 'Revogação do desconto de irmãos.',
      },
      'idemp-revoke-irmaos-10'
    );

    assert.equal(result.revocation.amount.canonicalAmount(), '10');
    assert.equal(result.position.effectiveDue.canonicalAmount(), '100');
    assert.equal(result.position.remainingCoverable.canonicalAmount(), '60');
  });

  it('Step 7: Attempt applying EXCEDENTE-70 (70 EUR > 60 EUR remaining) -> rejected DISCOUNT_FLOOR_VIOLATION with 0 facts created', async () => {
    const journalCountBefore = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM finance_journal_transactions WHERE institution_id = $1`,
      [actor.institutionId]
    );
    const discountCountBefore = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM finance_obligation_discounts WHERE institution_id = $1 AND obligation_id = $2`,
      [actor.institutionId, testObligationId]
    );

    await assert.rejects(
      async () => {
        await obligationDiscounts.applyObligationDiscount(
          actor,
          {
            obligationId: testObligationId,
            discountPolicyId: policyExcedente70Id,
            reason: 'Tentativa de aplicar desconto maior que o saldo em aberto.',
          },
          'idemp-apply-excedente-rejected'
        );
      },
      (err: Error) => {
        assert.ok(err instanceof ObligationDiscountValidationError);
        assert.ok(err.message.includes('DISCOUNT_FLOOR_VIOLATION'));
        return true;
      }
    );

    const journalCountAfter = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM finance_journal_transactions WHERE institution_id = $1`,
      [actor.institutionId]
    );
    const discountCountAfter = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM finance_obligation_discounts WHERE institution_id = $1 AND obligation_id = $2`,
      [actor.institutionId, testObligationId]
    );

    assert.equal(journalCountAfter.rows[0].count, journalCountBefore.rows[0].count, 'No journal transaction should be created on rejection');
    assert.equal(discountCountAfter.rows[0].count, discountCountBefore.rows[0].count, 'No discount fact should be created on rejection');
  });
});
