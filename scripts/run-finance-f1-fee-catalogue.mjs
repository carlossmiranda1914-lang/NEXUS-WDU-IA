import { spawnSync } from 'node:child_process';

const files = [
  'tests/finance-fee-catalogue-safety.test.ts',
  'tests/finance-fee-catalogue-date.test.ts',
  'tests/finance-fee-type-model.test.ts',
  'tests/finance-fee-catalogue-model.test.ts',
  'tests/finance-fee-catalogue-policy.test.ts',
  'tests/finance-fee-catalogue-schema-postgres.test.ts',
  'tests/finance-fee-catalogue-legacy-reconciliation.test.ts', // P1-01
  'tests/finance-fee-type-postgres.test.ts',
  'tests/finance-fee-type-prefix-immutability.test.ts',        // P1-02
  'tests/finance-fee-catalogue-postgres.test.ts',
  'tests/finance-fee-catalogue-inactive-type.test.ts',         // P1-03, P1-04
  'tests/finance-fee-catalogue-concurrency-postgres.test.ts',
  'tests/finance-fee-catalogue-http.test.ts',
  'tests/finance-fee-catalogue-client.test.ts',
  'tests/finance-fee-catalogue-ui.test.ts',
];

for (const file of files) {
  const result = spawnSync('npx', ['tsx', file], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\n[FINANCE-F1-01] All Fee Catalogue tests passed successfully.');
