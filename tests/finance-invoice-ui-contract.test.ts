import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const obligations = fs.readFileSync(path.join(root, 'src/components/finance/obligations/FinancialObligationsListView.tsx'), 'utf8');
const preview = fs.readFileSync(path.join(root, 'src/components/finance/obligations/InvoicePreissuePreview.tsx'), 'utf8');
const documents = fs.readFileSync(path.join(root, 'src/components/finance/documents/FinancialDocumentsWorkspace.tsx'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'src/components/finance/FinanceWorkspace.tsx'), 'utf8');

assert.match(obligations, /Pré-visualizar fatura/, 'an open obligation needs an operator entrypoint for the non-official server preview');
assert.match(obligations, /onPreviewInvoice\(item\)/, 'the browser may select only the existing obligation context');
assert.match(preview, /invoicePreview\(obligationId\)/, 'invoice pre-issue facts must come from the authorized server projection');
assert.match(preview, /Pré-visualização — ainda não emitido/, 'preview must not impersonate an issued invoice');
assert.match(preview, /não atribui número/i, 'preview must explain that no definitive number exists yet');
assert.match(preview, /issueInvoice\(\{ obligationId, seriesId: selected\.id, idempotencyKey \}\)/, 'issuance may provide only server-owned source identity, server series and idempotency intent');
assert.match(preview, /preview\.readiness\.status === 'READY' && preview\.series\.available/, 'the official issue action must be absent until server readiness permits it');
assert.doesNotMatch(preview, /institutionId|adapterKey|snapshotVersion|storageReference/, 'the invoice UI cannot author internal or tenant authority');
assert.match(documents, /invoice: 'Fatura'/, 'history must translate the invoice type for operators');
assert.match(documents, /Obrigação \$\{source\.obligationReference/, 'invoice provenance must use the persisted obligation reference, not a source UUID');
assert.match(documents, /Abrir obrigação/, 'an invoice must navigate to its persisted obligation context');
assert.match(workspace, /onOpenFinancialDocument/, 'post-issuance navigation must return the issued document identity to document history');
console.log('FINANCE_INVOICE_UI_CONTRACT=PASS');
