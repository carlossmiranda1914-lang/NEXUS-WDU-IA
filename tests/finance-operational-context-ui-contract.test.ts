import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const workspacePath = path.join(baseDir, 'src/components/finance/operational/FinanceOperationalContextWorkspace.tsx');
const headerPath = path.join(baseDir, 'src/components/finance/operational/FinanceOperationalContextHeader.tsx');
const panelsPath = path.join(baseDir, 'src/components/finance/operational/FinanceOperationalTruthPanels.tsx');
const historyPath = path.join(baseDir, 'src/components/finance/operational/FinanceOperationalHistory.tsx');
const topWorkspacePath = path.join(baseDir, 'src/components/finance/FinanceWorkspace.tsx');

// Check that files exist
assert.ok(fs.existsSync(workspacePath), 'FinanceOperationalContextWorkspace.tsx must exist');
assert.ok(fs.existsSync(headerPath), 'FinanceOperationalContextHeader.tsx must exist');
assert.ok(fs.existsSync(panelsPath), 'FinanceOperationalTruthPanels.tsx must exist');
assert.ok(fs.existsSync(historyPath), 'FinanceOperationalHistory.tsx must exist');
assert.ok(fs.existsSync(topWorkspacePath), 'FinanceWorkspace.tsx must exist');

const workspaceSrc = fs.readFileSync(workspacePath, 'utf8');
const headerSrc = fs.readFileSync(headerPath, 'utf8');
const panelsSrc = fs.readFileSync(panelsPath, 'utf8');
const historySrc = fs.readFileSync(historyPath, 'utf8');
const topWorkspaceSrc = fs.readFileSync(topWorkspacePath, 'utf8');

const allOperationalSrc = `${workspaceSrc}\n${headerSrc}\n${panelsSrc}\n${historySrc}`;

// 1. Required School-Operational Terminology
assert.match(allOperationalSrc, /Conta financeira/i, 'Must contain "Conta financeira"');
assert.match(allOperationalSrc, /Responsável financeiro/i, 'Must contain "Responsável financeiro"');
assert.match(allOperationalSrc, /Aluno/i, 'Must contain student reference');
assert.match(allOperationalSrc, /Cobranças em aberto/i, 'Must contain "Cobranças em aberto"');
assert.match(allOperationalSrc, /Recebimentos por associar|Recebimentos/i, 'Must contain unallocated payments section');
assert.match(allOperationalSrc, /Histórico financeiro/i, 'Must contain "Histórico financeiro"');
assert.match(allOperationalSrc, /Registar recebimento/i, 'Must contain action "Registar recebimento"');

// 2. Strict Forbidden Terms (No Allocation / No Fake Debt Balance)
assert.doesNotMatch(allOperationalSrc, /Liquidado/i, 'Must NOT contain "Liquidado"');
assert.doesNotMatch(allOperationalSrc, /Saldo pago/i, 'Must NOT contain "Saldo pago"');
assert.doesNotMatch(allOperationalSrc, /Dívida restante após pagamento/i, 'Must NOT contain "Dívida restante após pagamento"');
assert.doesNotMatch(allOperationalSrc, /partially_applied|fully_applied/i, 'Must NOT contain allocation statuses');

// 3. Top-Level FinanceWorkspace defaults to operational context surface
assert.match(topWorkspaceSrc, /FinanceOperationalContextWorkspace/, 'FinanceWorkspace must import FinanceOperationalContextWorkspace');
assert.match(topWorkspaceSrc, /initialTab\s*=\s*'operations'/, 'FinanceWorkspace default tab must be operations');

// 4. P1-03: No silent first-account default
assert.ok(
  !workspaceSrc.includes('setSelectedAccountId(list[0].id)'),
  'Must NOT contain silent first-account selection default setSelectedAccountId(list[0].id)'
);
assert.match(
  workspaceSrc,
  /data-testid="finance-explicit-account-selection"/,
  'Must render explicit account selection state when no account is selected'
);
assert.match(
  workspaceSrc,
  /data-testid="finance-account-search-input"/,
  'Must provide account search input for institution-safe lookup'
);
assert.match(
  workspaceSrc,
  /initialContextQuery/,
  'Must support initialContextQuery for direct resolved account flow'
);

console.log('Finance Operational Context UI contract tests passed successfully.');
