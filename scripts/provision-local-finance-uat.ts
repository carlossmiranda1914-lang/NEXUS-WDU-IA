import pg from 'pg';
import { readApprovedTestTarget } from './nexus-test-db-safety.mjs';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import { PostgresFinancialProfileStore } from '../src/modules/finance/financial-context.ts';
import { PostgresFinancialAccountRepository } from '../src/modules/finance/financial-account-repository.ts';
import { PostgresFeeTypeRepository } from '../src/modules/finance/fee-type-repository.ts';
import { PostgresFeeCatalogueRepository } from '../src/modules/finance/fee-catalogue-repository.ts';
import { PostgresFinancialObligationRepository } from '../src/modules/finance/financial-obligation-repository.ts';
import { PostgresPaymentRepository } from '../src/modules/finance/payment-repository.ts';
import { PostgresAllocationRepository } from '../src/modules/finance/allocation-repository.ts';
import { PostgresFinanceOperationalContextRepository } from '../src/modules/finance/finance-operational-context-repository.ts';

if (process.env.TEST_DATABASE_LOCAL_AUTHORIZED !== 'true') {
  throw new Error('Local Finance UAT provisioning requires TEST_DATABASE_LOCAL_AUTHORIZED=true.');
}

const { connectionString, target } = readApprovedTestTarget();
if (target.host !== '127.0.0.1' || target.port !== '54329' || target.database !== 'nexus_fnd01_test') {
  throw new Error('Local Finance UAT provisioning is restricted to the approved disposable PostgreSQL target.');
}

const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
const fixture = {
  accountName: 'UAT — Finance Adjustment 100-40-60',
  feeName: 'UAT — Correção Financeira 100 EUR',
  obligationRef: 'UAT-F5-ADJUSTMENT-100-40-60',
  effectiveAt: '2026-09-08T12:00:00.000Z',
  dueAt: '2026-10-08T12:00:00.000Z',
  feeEffectiveFrom: '2026-09-01T00:00:00.000Z',
  keys: {
    account: 'local-uat-finance-v1-account', fee: 'local-uat-finance-v1-fee',
    obligation: 'local-uat-finance-v1-obligation', payment: 'local-uat-finance-v1-payment', allocation: 'local-uat-finance-v1-allocation',
  },
};

async function resolveActor(): Promise<InstitutionalContext> {
  const result = await pool.query<{
    institution_id: string; institution_name: string; institution_slug: string; membership_id: string; person_id: string; person_name: string;
  }>(`SELECT i.id AS institution_id, i.name AS institution_name, i.slug AS institution_slug,
             m.id AS membership_id, p.id AS person_id, p.name AS person_name
        FROM institutions i
        JOIN memberships m ON m.institution_id = i.id AND m.status = 'active' AND m.role = 'institution_admin'
        JOIN people p ON p.id = m.person_id
       WHERE i.slug = 'nexus-local-iam-uat' AND i.status = 'active'
       ORDER BY m.created_at ASC LIMIT 1`);
  const row = result.rows[0];
  if (!row) throw new Error('Canonical local IAM UAT administrator is missing; run the authorized IAM UAT bootstrap first.');
  return { institutionId: row.institution_id, institutionName: row.institution_name, institutionSlug: row.institution_slug,
    membershipId: row.membership_id, personId: row.person_id, personName: row.person_name, identityEmail: null, role: 'institution_admin' };
}

async function ensureProfile(actor: InstitutionalContext): Promise<void> {
  const existing = await pool.query('SELECT 1 FROM finance_profile_versions WHERE institution_id = $1 AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now()) LIMIT 1', [actor.institutionId]);
  if (existing.rows[0]) return;
  // Local/test configuration only; all business facts below are created through Finance authorities.
  await pool.query(`INSERT INTO finance_profile_versions (institution_id, version, effective_from, primary_jurisdiction, functional_currency, financial_timezone, monetary_policy_version, enabled_currencies)
                    VALUES ($1, 1, now(), 'PT', 'EUR', 'Europe/Lisbon', 'local-uat-v1', '["EUR"]')`, [actor.institutionId]);
}

async function verifyFixture(actor: InstitutionalContext, accountId: string, obligationId: string, paymentReference: string): Promise<void> {
  const context = await new PostgresFinanceOperationalContextRepository(pool).getByFinancialAccountId(actor, accountId);
  const position = context.openObligations.find((item) => item.id === obligationId);
  const adjustmentCount = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM finance_obligation_adjustments WHERE institution_id = $1 AND obligation_id = $2', [actor.institutionId, obligationId]);
  if (!position || position.original.amount !== '100' || position.covered.amount !== '40' || position.remainingCoverable.amount !== '60' || adjustmentCount.rows[0]?.count !== '0') {
    throw new Error('Canonical Finance UAT fixture verification failed.');
  }
  console.log(JSON.stringify({ fixture: 'FINANCE_UAT_100_40_60_READY', accountId, obligationId, paymentReference, original: position.original.amount, covered: position.covered.amount, remaining: position.remainingCoverable.amount }));
}

async function provision(): Promise<void> {
  const actor = await resolveActor();
  await ensureProfile(actor);
  const existing = await pool.query<{ account_id: string; obligation_id: string; payment_reference: string }>(
    `SELECT account.id AS account_id, obligation.id AS obligation_id, payment.payment_reference
       FROM finance_financial_accounts account
       JOIN finance_obligations obligation ON obligation.institution_id = account.institution_id AND obligation.financial_account_id = account.id
       JOIN finance_allocations allocation ON allocation.institution_id = account.institution_id AND allocation.obligation_id = obligation.id
       JOIN finance_payments payment ON payment.institution_id = account.institution_id AND payment.id = allocation.payment_id
      WHERE account.institution_id = $1 AND account.name = $2 AND obligation.source_ref = $3
      ORDER BY allocation.id ASC LIMIT 1`,
    [actor.institutionId, fixture.accountName, fixture.obligationRef],
  );
  if (existing.rows[0]) {
    await verifyFixture(actor, existing.rows[0].account_id, existing.rows[0].obligation_id, existing.rows[0].payment_reference);
    return;
  }
  const profiles = new PostgresFinancialProfileStore(pool);
  const accounts = new PostgresFinancialAccountRepository(pool);
  const feeTypes = new PostgresFeeTypeRepository(pool);
  const catalogue = new PostgresFeeCatalogueRepository(pool, profiles);
  const obligations = new PostgresFinancialObligationRepository(pool, profiles);
  const payments = new PostgresPaymentRepository(pool);
  const allocations = new PostgresAllocationRepository(pool);

  const account = await accounts.create(actor, { name: fixture.accountName, primaryPersonId: actor.personId }, fixture.keys.account);
  const type = (await feeTypes.list(actor, 'active')).find((item) => item.codePrefix === 'PROP');
  if (!type) throw new Error('The canonical tuition fee type is unavailable.');
  const fee = (await catalogue.create(actor, { feeTypeId: type.id, name: fixture.feeName, amount: '100.00', currency: 'EUR', effectiveFrom: fixture.feeEffectiveFrom }, fixture.keys.fee)).result;
  const obligation = await obligations.issue(actor, { financialAccountId: account.id, beneficiaryPersonId: actor.personId, feeCatalogueItemId: fee.id, sourceType: 'manual_finance', sourceRef: fixture.obligationRef, dueAt: fixture.dueAt }, fixture.keys.obligation);
  const payment = (await payments.confirmPaymentInCommand(actor, { sourceType: 'manual_offline', method: 'cash', amount: '40.00', currency: 'EUR', financialAccountId: account.id, payerPersonId: actor.personId, notes: fixture.obligationRef, effectiveAt: fixture.effectiveAt }, fixture.keys.payment, profiles)).payment;
  await allocations.confirmAllocationInCommand(actor, { paymentId: payment.id, effectiveAt: fixture.effectiveAt, lines: [{ obligationId: obligation.id, amount: '40.00', currency: 'EUR' }] }, fixture.keys.allocation);

  await verifyFixture(actor, account.id, obligation.id, payment.paymentReference);
}

provision().finally(() => pool.end()).catch((error) => {
  console.error('[LOCAL-FINANCE-UAT]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
