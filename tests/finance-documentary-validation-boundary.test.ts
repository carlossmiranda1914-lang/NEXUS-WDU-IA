import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const service = fs.readFileSync(path.join(root, 'src/modules/finance/financial-document-service.ts'), 'utf8');
const eligibility = fs.readFileSync(path.join(root, 'src/modules/finance/financial-document-eligibility.ts'), 'utf8');

assert.doesNotMatch(service, /builtInFiscalAdapters/, 'issuance must not own a second adapter definition');
assert.match(service, /resolveReceiptEligibility\(client/, 'issuance must use the canonical evaluator inside its transaction');
assert.doesNotMatch(service, /SELECT id,amount::text,currency,payment_reference,effective_at,journal_transaction_id,financial_profile_version FROM finance_payments/, 'issuance must not reconstruct payment eligibility after canonical evaluation');
assert.match(eligibility, /FOR UPDATE/, 'canonical evaluator must support source locking for issuance');
assert.match(eligibility, /FOR UPDATE/, 'canonical evaluator must support series locking for issuance');
console.log('FINANCE_DOCUMENTARY_VALIDATION_BOUNDARY=PASS');
