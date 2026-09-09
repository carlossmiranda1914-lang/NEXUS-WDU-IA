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
assert.match(clientSource, /async detail\(/, 'the client must obtain source provenance and corrections from the authorized detail route');
assert.match(clientSource, /listArtifacts\(/, 'the client must obtain private artifact metadata from the authorized route');
assert.match(clientSource, /issueReceipt\(/, 'issuance must be delegated to the authoritative endpoint');
assert.match(clientSource, /Idempotency-Key/, 'issuance must carry an idempotency key for double-click and timeout recovery');
assert.match(clientSource, /listActiveReceiptSeries\(/, 'the client must derive effective receipt series from the authoritative API');
assert.match(clientSource, /generateArtifact\(/, 'the client must generate versioned evidence through the authoritative route');
assert.match(clientSource, /issueCorrection\(/, 'correction must be delegated to the immutable server authority');
assert.match(workspaceSource, /Criar correção autorizada/, 'the document preview must expose the bounded correction action');
const paymentsListSource = fs.readFileSync(path.join(root, 'src/components/finance/payments/FinancePaymentsListView.tsx'), 'utf8');
assert.match(paymentsListSource, /Emitir recibo oficial/, 'a confirmed payment must expose the bounded source-context action');
assert.match(workspaceSource, /Visualizar|View/, 'the workspace must offer a read-only document preview');
assert.match(workspaceSource, /PDF/, 'the workspace must offer the private official artifact action');
assert.match(workspaceSource, /Imprimir/, 'the workspace must offer print only for private artifact bytes');
assert.match(workspaceSource, /Proveniência/, 'the preview must expose persisted source provenance');
assert.match(workspaceSource, /Correç/, 'the preview must expose an authoritative correction relationship');
assert.doesNotMatch(workspaceSource, /Word|Excel|PowerPoint/, 'the Finance UX must not expose office editing');
assert.match(financeWorkspaceSource, /finance-tab-documents/, 'the Finance workspace must expose the authorized document history entrypoint');
console.log('FINANCIAL_DOCUMENT_UI_AUTHORIZED_BOUNDARY=PASS');
