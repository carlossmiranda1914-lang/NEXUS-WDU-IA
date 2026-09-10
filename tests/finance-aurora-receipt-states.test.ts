import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = readFileSync(resolve('src/components/finance/payments/FinancePaymentsWorkspace.tsx'), 'utf8');

assert.match(workspace, /receiptEligibilityMessage/, 'safe eligibility codes must be translated at the presentation boundary');
assert.match(workspace, /SOURCE_NOT_ELIGIBLE/, 'payment-specific ineligibility needs an institutional explanation');
assert.match(workspace, /RECEIPT_SERIES_NOT_EFFECTIVE/, 'missing effective series needs an institutional explanation');
assert.doesNotMatch(workspace, /bloqueada pela validação do servidor/, 'the browser must not expose generic server-validation language');
assert.match(workspace, /receiptIssuance\.status === 'BLOCKED'/, 'institution-level readiness remains a single contextual blocker');

console.log('FINANCE_AURORA_RECEIPT_STATES=PASS');
