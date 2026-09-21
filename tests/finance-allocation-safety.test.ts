import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');
const allocationSources = [
  'src/modules/finance/allocation-client.ts',
  'src/modules/finance/allocation-http.ts',
  'src/modules/finance/allocation-model.ts',
  'src/modules/finance/allocation-repository.ts',
  'src/modules/finance/allocation-service.ts',
  'src/components/finance/operational/FinanceAllocationCreateView.tsx',
  'src/components/finance/operational/FinanceAllocationHistory.tsx',
  'src/components/finance/operational/FinanceAllocationReverseView.tsx',
].map(source).join('\n');
const httpSource = source('src/modules/finance/allocation-http.ts');

assert.match(httpSource, /app\.get\('\/api\/finance\/allocations'/);
assert.match(httpSource, /app\.post\('\/api\/finance\/allocations'/);
assert.match(httpSource, /app\.post\('\/api\/finance\/allocations\/:allocationId\/reversals'/);
assert.doesNotMatch(httpSource, /app\.(?:delete|put|patch)\(/i, 'Allocation authority is append-only; no destructive or mutable route is allowed.');

for (const prohibitedTerm of [/\bcredit\b/i, /\brefund\b/i, /\breconciliation\b/i, /auto(?:matic)?[-\s]?allocation/i]) {
  assert.doesNotMatch(allocationSources, prohibitedTerm, `Allocation v1 must not introduce ${prohibitedTerm.source}.`);
}

assert.match(allocationSources, /currency must match/i, 'Allocation confirmation must enforce the same-currency boundary.');
assert.match(allocationSources, /financialAccountId/i, 'Allocation facts must retain their Financial Account boundary.');

console.log('finance-allocation-safety: PASS');
