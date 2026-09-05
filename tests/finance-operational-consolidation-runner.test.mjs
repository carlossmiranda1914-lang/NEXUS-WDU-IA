import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const runnerContent = readFileSync(resolve('scripts/run-finance-operational-consolidation.mjs'), 'utf8');

const requiredFiles = [
  'tests/finance-operational-consolidation-characterization.test.ts',
  'tests/finance-payment-client-fetch-regression.test.ts',
  'tests/finance-operational-context-postgres.test.ts',
  'tests/finance-operational-context-http.test.ts',
  'tests/finance-operational-context-client.test.ts',
  'tests/finance-operational-context-ui-contract.test.ts',
  'tests/finance-contextual-payment-ui-contract.test.ts',
  'tests/finance-context-entrypoints-contract.test.ts',
];

for (const file of requiredFiles) {
  assert.ok(
    runnerContent.includes(file),
    `Runner script must include ${file}`
  );
}

assert.ok(
  runnerContent.includes('[FINANCE-OPERATIONAL-CONSOLIDATION] All Finance Operational Consolidation tests passed successfully.'),
  'Runner must log success message upon passing all tests'
);

console.log('finance-operational-consolidation-runner.test.mjs: PASS');
