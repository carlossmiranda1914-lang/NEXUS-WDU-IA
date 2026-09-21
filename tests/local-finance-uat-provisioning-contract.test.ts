import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../scripts/provision-local-finance-uat.ts', import.meta.url), 'utf8');

for (const required of [
  "target.host !== '127.0.0.1'",
  "target.port !== '54329'",
  "primary_jurisdiction === 'NEXUS_TEST'",
  "'NEXUS_TEST'",
  "'000-UAT-REC'",
  "'000-UAT-CN'",
  "'000-UAT-FR'",
  "UAT-F7-RECEIPT-SOURCE",
  'ensureReceiptEligiblePayment',
  'InstitutionLegalProfileRepository',
  'PostgresFinancialAccountRepository',
  'PostgresFinancialObligationRepository',
  'PostgresPaymentRepository',
  'PostgresAllocationRepository',
  'FinancialDocumentEligibilityService',
  'createSyntheticUatFiscalAdapterRegistry',
]) assert.ok(source.includes(required), `Missing local Finance UAT documentary fixture invariant: ${required}`);

assert.match(source, /adapter_key[\s\S]{0,260}'core'/, 'The UAT fiscal configuration must bind the synthetic core adapter.');
assert.equal(source.includes("'PT', 'EUR', 'Europe/Lisbon', 'local-uat-v1'"), false, 'The disposable UAT fixture must not claim a real-country fiscal profile.');
assert.equal(source.includes('issueFinancialDocument'), false, 'The provisioner must not issue an official Financial Document.');
assert.equal(source.includes('productionFiscalAdapterRegistry'), false, 'The provisioner must not enable a production fiscal adapter.');
assert.match(source, /--angola-preview/, 'Task 5 must reuse this provisioner for its AO preview-only local corridor.');
assert.match(source, /primaryJurisdiction: 'AO'/, 'the AO fixture must use the canonical financial-profile authority');
assert.match(source, /externalIssuance: angolaPreviewMode \? 'BLOCKED'/, 'the AO fixture must never report external issuance as ready');
assert.match(source, /NEXUS_UAT_FIREBASE_UID/, 'The provisioner must target the authenticated local UAT identity rather than a hard-coded unrelated institution.');
assert.match(source, /identities[\s\S]*provider_subject = \$1/, 'The provisioner must resolve its institution through the configured local UAT identity.');
assert.equal(source.includes("WHERE i.slug = 'nexus-local-iam-uat'"), false, 'The provisioner must not hard-code a finance fixture tenant that the authenticated UAT identity cannot access.');
console.log('Local Finance UAT provisioning contract: PASS.');
