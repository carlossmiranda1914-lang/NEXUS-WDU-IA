import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envTestLocal = path.resolve(process.cwd(), '.env.test.local');
if (existsSync(envTestLocal)) {
  dotenv.config({ path: envTestLocal, override: true });
}

const files = [
  'tests/finance-operational-consolidation-characterization.test.ts',
  'tests/finance-payment-client-fetch-regression.test.ts',
  'tests/finance-operational-context-postgres.test.ts',
  'tests/finance-operational-context-http.test.ts',
  'tests/finance-operational-context-client.test.ts',
  'tests/finance-operational-context-ui-contract.test.ts',
  'tests/finance-contextual-payment-ui-contract.test.ts',
  'tests/finance-context-entrypoints-contract.test.ts',
  'tests/finance-operational-context-atomicity-contract.test.ts',
  'tests/finance-operational-context-atomicity-behavior.test.ts',
];

for (const file of files) {
  const result = spawnSync('npx', ['tsx', file], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`\n[FINANCE-OPERATIONAL-CONSOLIDATION] Suite failed on ${file}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n[FINANCE-OPERATIONAL-CONSOLIDATION] All Finance Operational Consolidation tests passed successfully.');
