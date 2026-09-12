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
import { InstitutionLegalProfileRepository } from '../src/modules/institution/institution-legal-profile.ts';
import { FinancialDocumentEligibilityService } from '../src/modules/finance/financial-document-eligibility.ts';
import { createSyntheticUatFiscalAdapterRegistry } from '../src/modules/finance/fiscal-adapter-registry.ts';

if (process.env.TEST_DATABASE_LOCAL_AUTHORIZED !== 'true') {
  throw new Error('Local Finance UAT provisioning requires TEST_DATABASE_LOCAL_AUTHORIZED=true.');
}

const { connectionString, target } = readApprovedTestTarget();
if (target.host !== '127.0.0.1' || target.port !== '54329' || target.database !== 'nexus_fnd01_test') {
  throw new Error('Local Finance UAT provisioning is restricted to the approved disposable PostgreSQL target.');
}

const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
const uatFirebaseUid = process.env.NEXUS_UAT_FIREBASE_UID?.trim();
if (!uatFirebaseUid || !/^[A-Za-z0-9_-]{1,128}$/.test(uatFirebaseUid)) {
  throw new Error('NEXUS_UAT_FIREBASE_UID is required to resolve the active local UAT institution.');
}
const angolaPreviewMode = process.argv.includes('--angola-preview');
const fixture = {
  accountName: angolaPreviewMode ? 'UAT AO — Finance Adjustment 100-40-60' : 'UAT — Finance Adjustment 100-40-60',
  feeName: angolaPreviewMode ? 'UAT AO — Recibo pré-emissão 100 AOA' : 'UAT — Correção Financeira 100 EUR',
  obligationRef: angolaPreviewMode ? 'UAT-G02-AO-100-40-60' : 'UAT-F5-ADJUSTMENT-100-40-60',
  currency: angolaPreviewMode ? 'AOA' : 'EUR',
  effectiveAt: '2026-09-08T12:00:00.000Z',
  dueAt: '2026-10-08T12:00:00.000Z',
  keys: {
    account: angolaPreviewMode ? 'local-uat-g02-ao-account' : 'local-uat-finance-v1-account', fee: angolaPreviewMode ? 'local-uat-g02-ao-fee' : 'local-uat-finance-v1-fee',
    obligation: angolaPreviewMode ? 'local-uat-g02-ao-obligation' : 'local-uat-finance-v1-obligation', payment: angolaPreviewMode ? 'local-uat-g02-ao-payment' : 'local-uat-finance-v1-payment', allocation: angolaPreviewMode ? 'local-uat-g02-ao-allocation' : 'local-uat-finance-v1-allocation',
    receiptPayment: angolaPreviewMode ? 'local-uat-g02-ao-receipt-payment' : 'local-uat-finance-v2-receipt-payment',
  },
};

async function resolveActor(): Promise<InstitutionalContext> {
  const result = await pool.query<{
    institution_id: string; institution_name: string; institution_slug: string; membership_id: string; person_id: string; person_name: string;
  }>(`SELECT i.id AS institution_id, i.name AS institution_name, i.slug AS institution_slug,
             m.id AS membership_id, p.id AS person_id, p.name AS person_name
        FROM identities identity
        JOIN people p ON p.id = identity.person_id
        JOIN memberships m ON m.person_id = p.id AND m.status = 'active' AND m.role = 'institution_admin'
        JOIN institutions i ON i.id = m.institution_id AND i.status = 'active'
       WHERE identity.provider = 'firebase' AND identity.provider_subject = $1
       ORDER BY i.slug`, [uatFirebaseUid]);
  if (result.rows.length !== 1) {
    throw new Error('The configured local UAT identity must have exactly one active institution_admin context.');
  }
  const row = result.rows[0];
  return { institutionId: row.institution_id, institutionName: row.institution_name, institutionSlug: row.institution_slug,
    membershipId: row.membership_id, personId: row.person_id, personName: row.person_name, identityEmail: null, role: 'institution_admin' };
}

async function ensureProfile(actor: InstitutionalContext): Promise<void> {
  const existing = await pool.query<{ primary_jurisdiction: string }>(
    `SELECT primary_jurisdiction FROM finance_profile_versions
     WHERE institution_id=$1 AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())
     ORDER BY version DESC LIMIT 1`,
    [actor.institutionId],
  );
  if (angolaPreviewMode) {
    if (existing.rows[0]?.primary_jurisdiction === 'AO') return;
    await new PostgresFinancialProfileStore(pool).createVersion({ institutionId: actor.institutionId, effectiveFrom: new Date().toISOString(), primaryJurisdiction: 'AO', functionalCurrency: 'AOA', financialTimezone: 'Africa/Luanda', monetaryPolicyVersion: 'local-uat-g02-ao', enabledCurrencies: ['AOA'] });
    return;
  }
  if (existing.rows[0]?.primary_jurisdiction === 'NEXUS_TEST') return;
  // This synthetic jurisdiction is exclusively for the host-restricted disposable UAT database.
  // It is deliberately not a real-country policy or a production adapter configuration.
  await pool.query(`INSERT INTO finance_profile_versions (institution_id, version, effective_from, primary_jurisdiction, functional_currency, financial_timezone, monetary_policy_version, enabled_currencies)
                    SELECT $1, COALESCE(MAX(version), 0) + 1, now(), 'NEXUS_TEST', 'EUR', 'Europe/Lisbon', 'local-uat-v2', '["EUR"]'
                    FROM finance_profile_versions WHERE institution_id=$1`, [actor.institutionId]);
}

async function ensureLegalProfile(actor: InstitutionalContext): Promise<void> {
  const profiles = new InstitutionLegalProfileRepository(pool);
  const existing = await profiles.resolveEffective(actor.institutionId, new Date());
  if (angolaPreviewMode) {
    if (existing?.registeredAddress.countryCode === 'AO' && existing.taxIdentifier) return;
    await profiles.createVersion({ institutionId: actor.institutionId, legalName: `${actor.institutionName} — UAT AO`, taxIdentifier: 'AO-UAT-LOCAL-0001', registeredAddress: { countryCode: 'AO', line1: 'Ambiente local descartável — não produtivo' }, effectiveFrom: new Date() });
    return;
  }
  if (existing) return;
  await profiles.createVersion({
    institutionId: actor.institutionId,
    legalName: `${actor.institutionName} — UAT`,
    taxIdentifier: null,
    registeredAddress: { countryCode: 'NEXUS_TEST', line1: 'Ambiente local descartável' },
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  });
}

async function ensureDocumentaryUatConfiguration(actor: InstitutionalContext): Promise<void> {
  const active = await pool.query<{ id: string; adapter_key: string }>(
    `SELECT id,adapter_key FROM finance_fiscal_configuration_versions
     WHERE institution_id=$1 AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())
     ORDER BY version DESC LIMIT 1`,
    [actor.institutionId],
  );
  let fiscalConfigurationId = active.rows[0]?.adapter_key === 'core' ? active.rows[0].id : undefined;
  if (!fiscalConfigurationId) {
    if (active.rows[0]) await pool.query(`UPDATE finance_fiscal_configuration_versions SET effective_to=now() WHERE institution_id=$1 AND effective_to IS NULL`, [actor.institutionId]);
    const created = await pool.query<{ id: string }>(
      `INSERT INTO finance_fiscal_configuration_versions (institution_id,version,adapter_key,operational_configuration,effective_from)
       SELECT $1,COALESCE(MAX(version),0)+1,'core','{"environment":"local-uat"}'::jsonb,now()
       FROM finance_fiscal_configuration_versions WHERE institution_id=$1 RETURNING id`,
      [actor.institutionId],
    );
    fiscalConfigurationId = created.rows[0]?.id;
  }
  if (!fiscalConfigurationId) throw new Error('Canonical local Finance UAT fiscal configuration could not be resolved.');
  await pool.query(
    `INSERT INTO finance_financial_document_series (institution_id,code,document_type,status,effective_from,fiscal_configuration_id)
     VALUES($1,'000-UAT-REC','receipt','active',now(),$2)
     ON CONFLICT (institution_id,code) DO NOTHING`,
    [actor.institutionId, fiscalConfigurationId],
  );
  await pool.query(
    `INSERT INTO finance_financial_document_series (institution_id,code,document_type,status,effective_from,fiscal_configuration_id)
     VALUES($1,'000-UAT-CN','credit_note','active',now(),$2)
     ON CONFLICT (institution_id,code) DO NOTHING`,
    [actor.institutionId, fiscalConfigurationId],
  );
}

async function verifyFixture(actor: InstitutionalContext, accountId: string, obligationId: string, paymentReference: string): Promise<void> {
  const context = await new PostgresFinanceOperationalContextRepository(pool).getByFinancialAccountId(actor, accountId);
  const position = context.openObligations.find((item) => item.id === obligationId);
  const adjustmentCount = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM finance_obligation_adjustments WHERE institution_id = $1 AND obligation_id = $2', [actor.institutionId, obligationId]);
  if (!position || position.original.amount !== '100' || position.covered.amount !== '40' || position.remainingCoverable.amount !== '60' || adjustmentCount.rows[0]?.count !== '0') {
    throw new Error('Canonical Finance UAT fixture verification failed.');
  }
  console.log(JSON.stringify({ fixture: angolaPreviewMode ? 'FINANCE_G02_AO_PREVIEW_100_40_60_READY' : 'FINANCE_UAT_100_40_60_READY', accountId, obligationId, paymentReference, original: position.original.amount, covered: position.covered.amount, remaining: position.remainingCoverable.amount, currency: fixture.currency }));
}

async function ensureReceiptEligiblePayment(actor: InstitutionalContext, accountId: string): Promise<{ id: string; reference: string }> {
  const existing = await pool.query<{ id: string; payment_reference: string }>(
    `SELECT id,payment_reference FROM finance_payments
     WHERE institution_id=$1 AND notes='UAT-F7-RECEIPT-SOURCE' AND status='confirmed'
     ORDER BY effective_at DESC LIMIT 1`,
    [actor.institutionId],
  );
  if (existing.rows[0]) {
    if (!angolaPreviewMode) await new FinancialDocumentEligibilityService(pool, createSyntheticUatFiscalAdapterRegistry()).requireReceipt(actor.institutionId, existing.rows[0].id);
    return { id: existing.rows[0].id, reference: existing.rows[0].payment_reference };
  }
  const profiles = new PostgresFinancialProfileStore(pool);
  const payments = new PostgresPaymentRepository(pool);
  const result = await payments.confirmPaymentInCommand(actor, {
    sourceType: 'manual_offline', method: 'cash', amount: '10.00', currency: fixture.currency,
    financialAccountId: accountId, payerPersonId: actor.personId, notes: 'UAT-F7-RECEIPT-SOURCE', effectiveAt: new Date().toISOString(),
  }, fixture.keys.receiptPayment, profiles);
  if (!angolaPreviewMode) await new FinancialDocumentEligibilityService(pool, createSyntheticUatFiscalAdapterRegistry()).requireReceipt(actor.institutionId, result.payment.id);
  return { id: result.payment.id, reference: result.payment.paymentReference };
}

async function provision(): Promise<void> {
  const actor = await resolveActor();
  await ensureProfile(actor);
  await ensureLegalProfile(actor);
  if (!angolaPreviewMode) await ensureDocumentaryUatConfiguration(actor);
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
    const receiptPayment = angolaPreviewMode
      ? { id: '', reference: existing.rows[0].payment_reference }
      : await ensureReceiptEligiblePayment(actor, existing.rows[0].account_id);
    console.log(JSON.stringify({ fixture: angolaPreviewMode ? 'FINANCE_G02_AO_PREVIEW_SOURCE_READY' : 'FINANCE_UAT_RECEIPT_SOURCE_READY', paymentReference: receiptPayment.reference, receiptEligibility: !angolaPreviewMode, jurisdiction: angolaPreviewMode ? 'AO' : 'NEXUS_TEST', externalIssuance: angolaPreviewMode ? 'BLOCKED' : undefined }));
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
  const fee = (await catalogue.create(actor, { feeTypeId: type.id, name: fixture.feeName, amount: '100.00', currency: fixture.currency, effectiveFrom: new Date().toISOString() }, fixture.keys.fee)).result;
  const obligation = await obligations.issue(actor, { financialAccountId: account.id, beneficiaryPersonId: actor.personId, feeCatalogueItemId: fee.id, sourceType: 'manual_finance', sourceRef: fixture.obligationRef, dueAt: fixture.dueAt }, fixture.keys.obligation);
  const payment = (await payments.confirmPaymentInCommand(actor, { sourceType: 'manual_offline', method: 'cash', amount: '40.00', currency: fixture.currency, financialAccountId: account.id, payerPersonId: actor.personId, notes: fixture.obligationRef, effectiveAt: fixture.effectiveAt }, fixture.keys.payment, profiles)).payment;
  await allocations.confirmAllocationInCommand(actor, { paymentId: payment.id, effectiveAt: fixture.effectiveAt, lines: [{ obligationId: obligation.id, amount: '40.00', currency: fixture.currency }] }, fixture.keys.allocation);

  await verifyFixture(actor, account.id, obligation.id, payment.paymentReference);
  const receiptPayment = angolaPreviewMode
    ? { id: payment.id, reference: payment.paymentReference }
    : await ensureReceiptEligiblePayment(actor, account.id);
  console.log(JSON.stringify({ fixture: angolaPreviewMode ? 'FINANCE_G02_AO_PREVIEW_SOURCE_READY' : 'FINANCE_UAT_RECEIPT_SOURCE_READY', paymentReference: receiptPayment.reference, receiptEligibility: !angolaPreviewMode, jurisdiction: angolaPreviewMode ? 'AO' : 'NEXUS_TEST', externalIssuance: angolaPreviewMode ? 'BLOCKED' : undefined }));
}

provision().finally(() => pool.end()).catch((error) => {
  console.error('[LOCAL-FINANCE-UAT]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
