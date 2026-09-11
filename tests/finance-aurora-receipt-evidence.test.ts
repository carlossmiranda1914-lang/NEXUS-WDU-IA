import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const payments = readFileSync(resolve('src/components/finance/payments/FinancePaymentsWorkspace.tsx'), 'utf8');
const workspace = readFileSync(resolve('src/components/finance/FinanceWorkspace.tsx'), 'utf8');

assert.match(payments, /onOpenFinancialDocuments/, 'confirmed receipt evidence must have a route to official document history');
assert.match(payments, /Abrir documento financeiro/, 'a confirmed issue must expose a verifiable evidence action');
assert.match(workspace, /onOpenFinancialDocuments=\{\(\) => setActiveTab\('documents'\)\}/, 'Finance workspace must wire the evidence action to its document projection');

console.log('FINANCE_AURORA_RECEIPT_EVIDENCE=PASS');
