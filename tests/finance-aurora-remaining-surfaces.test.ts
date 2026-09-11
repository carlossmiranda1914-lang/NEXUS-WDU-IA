import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sources = [
  'src/components/finance/operational/FinanceOperationalContextWorkspace.tsx',
  'src/components/finance/obligations/FinancialObligationsListView.tsx',
  'src/components/finance/fee-catalogue/FeeCatalogueList.tsx',
];

for (const sourcePath of sources) {
  const source = readFileSync(resolve(sourcePath), 'utf8');
  assert.match(source, /AuroraPageHeader/, `${sourcePath} must provide clear Aurora page orientation`);
}

const overview = readFileSync(resolve(sources[0]), 'utf8');
assert.match(overview, /Situação Financeira/, 'the overview must name the authoritative financial context');

const obligations = readFileSync(resolve(sources[1]), 'utf8');
assert.match(obligations, /Obrigações Financeiras/, 'the obligation collection must name its operational job');

const catalogue = readFileSync(resolve(sources[2]), 'utf8');
assert.match(catalogue, /Catálogo de Emolumentos/, 'the catalogue must name its configuration collection');

console.log('FINANCE_AURORA_REMAINING_SURFACES=PASS');
