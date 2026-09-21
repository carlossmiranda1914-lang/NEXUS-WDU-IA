import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveFinanceDocumentReadiness } from '../src/modules/finance/finance-readiness.ts';

const complete = {
  documentType: 'receipt',
  primaryJurisdiction: 'AO',
  legalProfilePresent: true,
  financialProfilePresent: true,
  institutionFactsPresent: true,
  agtOnboardingPresent: true,
  signingMaterialPresent: true,
  fiscalConfigurationPresent: true,
  productionSeriesDocumentTypes: ['receipt'],
  sourceEligible: true,
  documentPartiesResolved: true,
  documentaryDataComplete: true,
} as const;

test('AO support alone never grants per-document issuance readiness', () => {
  const result = resolveFinanceDocumentReadiness({ ...complete, agtOnboardingPresent: false });
  assert.deepEqual([result.status, result.reasonCode], ['BLOCKED', 'AGT_ONBOARDING_REQUIRED']);
});

test('per-document readiness fails closed at each authoritative prerequisite', () => {
  assert.equal(resolveFinanceDocumentReadiness({ ...complete, legalProfilePresent: false }).reasonCode, 'LEGAL_PROFILE_REQUIRED');
  assert.equal(resolveFinanceDocumentReadiness({ ...complete, financialProfilePresent: false }).reasonCode, 'FINANCIAL_PROFILE_REQUIRED');
  assert.equal(resolveFinanceDocumentReadiness({ ...complete, primaryJurisdiction: 'NEXUS_TEST' }).reasonCode, 'JURISDICTION_POLICY_UNAVAILABLE');
  assert.equal(resolveFinanceDocumentReadiness({ ...complete, institutionFactsPresent: false }).reasonCode, 'INSTITUTION_DATA_REQUIRED');
  assert.equal(resolveFinanceDocumentReadiness({ ...complete, signingMaterialPresent: false }).reasonCode, 'AGT_SIGNING_MATERIAL_REQUIRED');
  assert.equal(resolveFinanceDocumentReadiness({ ...complete, fiscalConfigurationPresent: false }).reasonCode, 'FISCAL_CONFIGURATION_REQUIRED');
  assert.equal(resolveFinanceDocumentReadiness({ ...complete, productionSeriesDocumentTypes: [] }).reasonCode, 'AGT_PRODUCTION_SERIES_REQUIRED');
  assert.equal(resolveFinanceDocumentReadiness({ ...complete, sourceEligible: false }).reasonCode, 'SOURCE_NOT_ELIGIBLE');
  assert.equal(resolveFinanceDocumentReadiness({ ...complete, documentPartiesResolved: false }).reasonCode, 'DOCUMENT_PARTY_REQUIRED');
  assert.equal(resolveFinanceDocumentReadiness({ ...complete, documentaryDataComplete: false }).reasonCode, 'DOCUMENTARY_DATA_REQUIRED');
});

test('series readiness is per-document rather than a global Angola switch', () => {
  const receipt = resolveFinanceDocumentReadiness({ ...complete, documentType: 'receipt', productionSeriesDocumentTypes: ['receipt'] });
  const invoice = resolveFinanceDocumentReadiness({ ...complete, documentType: 'invoice', productionSeriesDocumentTypes: ['receipt'] });
  assert.equal(receipt.status, 'READY');
  assert.deepEqual([invoice.status, invoice.reasonCode], ['BLOCKED', 'AGT_PRODUCTION_SERIES_REQUIRED']);
});

test('unsupported document types do not become ready from otherwise complete inputs', () => {
  const result = resolveFinanceDocumentReadiness({ ...complete, documentType: 'unknown-document' });
  assert.deepEqual([result.status, result.reasonCode], ['BLOCKED', 'DOCUMENT_TYPE_UNSUPPORTED']);
});

test('the server-composed NEXUS_TEST policy can be ready without claiming Angola production readiness', () => {
  const result = resolveFinanceDocumentReadiness({
    ...complete,
    documentType: 'invoice_receipt',
    primaryJurisdiction: 'NEXUS_TEST',
    jurisdictionPolicyAvailable: true,
    externalProductionPrerequisitesRequired: false,
    agtOnboardingPresent: false,
    signingMaterialPresent: false,
    productionSeriesDocumentTypes: ['invoice_receipt'],
  });
  assert.equal(result.status, 'READY');
  assert.equal(result.prerequisites.jurisdictionPolicy, true);
  assert.equal(result.prerequisites.agtOnboarding, false);
});
