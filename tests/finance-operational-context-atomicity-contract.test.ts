import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const workspacePath = path.join(baseDir, 'src/components/finance/operational/FinanceOperationalContextWorkspace.tsx');
const headerPath = path.join(baseDir, 'src/components/finance/operational/FinanceOperationalContextHeader.tsx');
const panelsPath = path.join(baseDir, 'src/components/finance/operational/FinanceOperationalTruthPanels.tsx');
const historyPath = path.join(baseDir, 'src/components/finance/operational/FinanceOperationalHistory.tsx');
const paymentCreatePath = path.join(baseDir, 'src/components/finance/payments/FinancePaymentCreateView.tsx');
const topWorkspacePath = path.join(baseDir, 'src/components/finance/FinanceWorkspace.tsx');

const workspaceSrc = fs.readFileSync(workspacePath, 'utf8');
const headerSrc = fs.readFileSync(headerPath, 'utf8');
const panelsSrc = fs.readFileSync(panelsPath, 'utf8');
const historySrc = fs.readFileSync(historyPath, 'utf8');
const paymentCreateSrc = fs.readFileSync(paymentCreatePath, 'utf8');
const topWorkspaceSrc = fs.readFileSync(topWorkspacePath, 'utf8');

const allUiSrc = `${workspaceSrc}\n${headerSrc}\n${panelsSrc}\n${historySrc}\n${paymentCreateSrc}\n${topWorkspaceSrc}`;

// ----------------------------------------------------
// SCOPE 1: SERVER-SIDE BOUNDED ACCOUNT SEARCH
// ----------------------------------------------------

// GENERIC_FINANCE_INITIAL_FULL_ACCOUNT_FETCH = NO
assert.ok(
  !workspaceSrc.includes("client.listFinancialAccounts('active')"),
  'Must NOT unconditionally fetch full account list into browser on mount'
);

// BOUNDED_SERVER_ACCOUNT_SEARCH = PASS
assert.match(
  workspaceSrc,
  /searchFinancialAccounts/,
  'Workspace must use searchFinancialAccounts for bounded server-side lookup'
);

// EXPLICIT_ACCOUNT_SELECTION = PASS
assert.match(
  workspaceSrc,
  /data-testid="finance-explicit-account-selection"/,
  'Must render explicit search and selection view when no account is selected'
);
assert.match(
  workspaceSrc,
  /data-testid="finance-account-search-input"/,
  'Must provide account search input'
);

// ----------------------------------------------------
// SCOPE 2: ONE SELECTED ACCOUNT = ONE ATOMIC CONTEXT
// ----------------------------------------------------

// Stale request protection & atomicity
assert.match(
  workspaceSrc,
  /requestSeq|abortController|requestId/i,
  'Workspace must implement request sequencing / cancellation to prevent stale response overwrites'
);

// Context clearing on account switch
assert.match(
  workspaceSrc,
  /setContext\s*\(\s*null\s*\)/,
  'Workspace must clear context immediately when switching or clearing account'
);

// Payment action binds strictly to current account context
assert.match(
  workspaceSrc,
  /financialAccount=\{\s*\{\s*id:\s*context\.financialAccount\.id/,
  'Payment view must bind to current context financialAccount ID'
);
assert.match(
  workspaceSrc,
  /payerPerson=\{\s*context\.responsiblePerson/,
  'Payment view must bind to current context responsiblePerson'
);

// ----------------------------------------------------
// SCOPE 3: DIRECT CROSS-MODULE CONTEXT
// ----------------------------------------------------

assert.match(
  workspaceSrc,
  /initialContextQuery/,
  'Workspace must accept initialContextQuery for direct Student/Enrollment context resolution'
);

// Controlled error & ambiguity handling
assert.match(
  workspaceSrc,
  /AMBIGUOUS_FINANCIAL_ACCOUNT|múltiplas contas|ambígua/i,
  'Workspace must handle ambiguous account resolution with controlled feedback'
);

// ----------------------------------------------------
// SCOPE 4: OPERATIONAL TERMINOLOGY PASS
// ----------------------------------------------------

// 1. "Conta Financeira"
assert.match(headerSrc, /Conta [Ff]inanceira/, 'Header must use "Conta financeira"');

// 2. "Responsável financeiro"
assert.match(headerSrc, /Responsável [Ff]inanceiro/i, 'Header must use "Responsável financeiro"');

// 3. "Responsável principal" (instead of "Titular principal" for primary_debtor)
assert.match(headerSrc, /Responsável principal/, 'Header must use "Responsável principal" for primary debtor role');
assert.ok(
  !headerSrc.includes("'Titular principal'"),
  'Header must NOT use "Titular principal" when "Responsável principal" is required'
);

// 4. "Alunos associados"
assert.match(headerSrc, /Alunos associados/i, 'Header must use "Alunos associados"');

// 5. "Cobranças em aberto" (preferred operational label)
assert.match(panelsSrc, /Cobranças em aberto/i, 'Panels must use "Cobranças em aberto"');
assert.ok(
  !panelsSrc.includes('Obrigações em aberto'),
  'Panels must use "Cobranças em aberto" instead of "Obrigações em aberto"'
);

// 6. "Recebimentos por associar" (preferred UI label)
assert.match(panelsSrc, /Recebimentos por associar/i, 'Panels must use "Recebimentos por associar"');

// 7. Explanatory sentence
assert.match(
  panelsSrc,
  /Pagamentos recebidos que ainda não foram associados a uma cobrança\./,
  'Panels must contain explanatory sentence: "Pagamentos recebidos que ainda não foram associados a uma cobrança."'
);

// 8. "Registar recebimento" (not manual/offline)
assert.match(headerSrc, /Registar recebimento/, 'Header action must be "Registar recebimento"');
assert.ok(
  !paymentCreateSrc.includes('Registar Recebimento Manual / Offline'),
  'Payment create view title must NOT include "Manual / Offline"'
);
assert.match(
  paymentCreateSrc,
  /Registar [Rr]ecebimento/,
  'Payment create view must use "Registar recebimento"'
);

// 9. "Referência do pagamento"
assert.match(
  paymentCreateSrc,
  /Referência do [Pp]agamento/,
  'Payment create view must use "Referência do pagamento"'
);

// 10. "Data do recebimento"
assert.match(
  paymentCreateSrc,
  /Data do [Rr]ecebimento/,
  'Payment create view must use "Data do recebimento"'
);

// 11. "Histórico financeiro"
assert.match(historySrc, /Histórico financeiro/i, 'History must use "Histórico financeiro"');

// 12. "Situação financeira" in top workspace navigation tab
assert.match(
  topWorkspaceSrc,
  /Situação [Ff]inanceira/i,
  'FinanceWorkspace navigation tab must use "Situação financeira"'
);

// 13. Strict Invariant: No Allocation / No Fake Debt Balance
assert.doesNotMatch(allUiSrc, /Saldo em dívida/i, 'Must NEVER display "Saldo em dívida"');
assert.doesNotMatch(allUiSrc, /Liquidado/i, 'Must NEVER display "Liquidado"');
assert.doesNotMatch(allUiSrc, /Saldo pago/i, 'Must NEVER display "Saldo pago"');

console.log('finance-operational-context-atomicity-contract: PASS');
