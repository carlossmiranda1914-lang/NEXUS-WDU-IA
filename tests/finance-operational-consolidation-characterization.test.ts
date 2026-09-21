import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const obligationModelSource = readFileSync(path.join(rootDir, 'src/modules/finance/financial-obligation-model.ts'), 'utf8');
const obligationRepoSource = readFileSync(path.join(rootDir, 'src/modules/finance/financial-obligation-repository.ts'), 'utf8');
const paymentModelSource = readFileSync(path.join(rootDir, 'src/modules/finance/payment-model.ts'), 'utf8');
const paymentRepoSource = readFileSync(path.join(rootDir, 'src/modules/finance/payment-repository.ts'), 'utf8');
const accountModelSource = readFileSync(path.join(rootDir, 'src/modules/finance/financial-account-model.ts'), 'utf8');
const accountRepoSource = readFileSync(path.join(rootDir, 'src/modules/finance/financial-account-repository.ts'), 'utf8');

// 1. Obligation contract supports filtering by financialAccountId
assert.match(obligationRepoSource, /financialAccountId\?: string/, 'Obligation list filter must support financialAccountId');
assert.match(obligationRepoSource, /o\.financial_account_id/, 'Obligation query must filter by o.financial_account_id');
assert.match(obligationModelSource, /financialAccountId: string/, 'FinancialObligation model must contain financialAccountId');

// 2. Payment contract supports filtering by financialAccountId
assert.match(paymentRepoSource, /financialAccountId\?: string/, 'Payment list filter must support financialAccountId');
assert.match(paymentRepoSource, /financial_account_id/, 'Payment query must filter by financial_account_id');
assert.match(paymentModelSource, /financialAccountId\?: string/, 'Payment model must support financialAccountId');

// 3. Payment allocation is an up-to-date projection of append-only allocation facts.
assert.match(paymentModelSource, /'unapplied' \| 'partially_allocated' \| 'fully_allocated'/, 'PaymentAllocationStatus must represent the current allocation position');
assert.match(paymentRepoSource, /finance_allocations/, 'Payment repository must read the allocation authority');
assert.match(paymentRepoSource, /finance_allocation_reversals/, 'Payment repository must subtract reversal authority');
assert.match(paymentRepoSource, /derivePaymentAllocationPosition/, 'Payment repository must derive the current status instead of reusing confirmation-time state');

// 4. Financial Account exposes canonical account number, name, and party identity
assert.match(accountModelSource, /accountNumber: string/, 'FinancialAccount model must expose accountNumber');
assert.match(accountModelSource, /name: string/, 'FinancialAccount model must expose name');
assert.match(accountModelSource, /status: FinancialAccountStatus/, 'FinancialAccount model must expose status');
assert.match(accountRepoSource, /finance_financial_account_parties/, 'FinancialAccount repository must manage account parties');

console.log('Finance Operational Consolidation Characterization: PASS');
