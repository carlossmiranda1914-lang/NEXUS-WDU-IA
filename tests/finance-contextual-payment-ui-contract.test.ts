import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const createViewPath = path.join(baseDir, 'src/components/finance/payments/FinancePaymentCreateView.tsx');
const workspacePath = path.join(baseDir, 'src/components/finance/operational/FinanceOperationalContextWorkspace.tsx');

assert.ok(fs.existsSync(createViewPath), 'FinancePaymentCreateView.tsx must exist');
assert.ok(fs.existsSync(workspacePath), 'FinanceOperationalContextWorkspace.tsx must exist');

const createViewSrc = fs.readFileSync(createViewPath, 'utf8');
const workspaceSrc = fs.readFileSync(workspacePath, 'utf8');

// 1. FinancePaymentCreateView Props Contract
assert.match(createViewSrc, /financialAccount\??:\s*\{/, 'Must define financialAccount prop');
assert.match(createViewSrc, /payerPerson\??:\s*\{/, 'Must define payerPerson prop');

// 2. Bound invocation to paymentClient.confirmManualPayment
assert.match(createViewSrc, /financialAccountId:\s*financialAccount\??\.id/, 'Must pass financialAccountId from financialAccount prop');
assert.match(createViewSrc, /payerPersonId:\s*payerPerson\??\.personId/, 'Must pass payerPersonId from payerPerson prop');

// 3. Prominent Context Banner Rendering
assert.match(createViewSrc, /Conta financeira de destino/i, 'Must render destination account context');
assert.match(createViewSrc, /Responsável \/ Pagador/i, 'Must render payer context');

// 4. Workspace caller passes canonical context and re-fetches on success
assert.match(workspaceSrc, /<FinancePaymentCreateView/, 'Workspace must render FinancePaymentCreateView');
assert.match(workspaceSrc, /financialAccount=\{\s*\{\s*id:\s*context\.financialAccount\.id/, 'Workspace must pass financialAccount id');
assert.match(workspaceSrc, /payerPerson=\{/, 'Workspace must pass payerPerson context');
assert.match(workspaceSrc, /loadContext\(selectedAccountId\)/, 'Workspace must re-fetch context on payment success');

console.log('Finance Contextual Payment UI contract tests passed successfully.');
