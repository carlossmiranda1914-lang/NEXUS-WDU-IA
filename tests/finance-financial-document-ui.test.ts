import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = path.join(root, 'src/modules/finance/financial-document-client.ts');
const workspace = path.join(root, 'src/components/finance/documents/FinancialDocumentsWorkspace.tsx');
const financeWorkspace = path.join(root, 'src/components/finance/FinanceWorkspace.tsx');

assert.ok(fs.existsSync(client), 'F7-07 requires an authorized Financial Document client');
assert.ok(fs.existsSync(workspace), 'F7-07 requires a minimal Financial Document workspace');
const clientSource = fs.readFileSync(client, 'utf8');
const workspaceSource = fs.readFileSync(workspace, 'utf8');
const financeWorkspaceSource = fs.readFileSync(financeWorkspace, 'utf8');

assert.match(clientSource, /\/api\/finance\/documents/, 'document reads must use the authoritative HTTP boundary');
assert.match(workspaceSource, /Visualizar|View/, 'the workspace must offer a read-only document preview');
assert.match(workspaceSource, /PDF/, 'the workspace must offer the private official artifact action');
assert.doesNotMatch(workspaceSource, /Word|Excel|PowerPoint/, 'the Finance UX must not expose office editing');
assert.match(financeWorkspaceSource, /finance-tab-documents/, 'the Finance workspace must expose the authorized document history entrypoint');
console.log('FINANCIAL_DOCUMENT_UI_AUTHORIZED_BOUNDARY=PASS');
