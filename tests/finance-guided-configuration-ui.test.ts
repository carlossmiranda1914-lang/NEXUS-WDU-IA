import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = fs.readFileSync(path.join(root, 'src/components/finance/configuration/FinanceConfigurationWorkspace.tsx'), 'utf8');
const client = fs.readFileSync(path.join(root, 'src/modules/finance/finance-readiness-client.ts'), 'utf8');

assert.match(workspace, /Configuração necessária/, 'guided Finance setup must explain incomplete readiness');
assert.match(workspace, /Série de recibos/, 'guided Finance setup must name the missing receipt-series requirement');
assert.match(workspace, /Concluir configuração/, 'only the canonical setup surface may offer remediation');
assert.match(workspace, /canManageConfiguration/, 'mutation presentation must come from server-derived capabilities');
assert.match(workspace, /readinessClient\.get\(\)/, 'the workspace must refresh readiness from the backend after mutation');
assert.doesNotMatch(workspace, /institutionId|nextSequenceNumber/, 'guided UX must not expose browser tenant or sequence authority');
assert.match(client, /\/api\/finance\/document-series/, 'guided configuration must reuse the canonical document-series route');
console.log('FINANCE_GUIDED_CONFIGURATION_UI=PASS');
