import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envTestLocal = path.resolve(process.cwd(), '.env.test.local');
if (existsSync(envTestLocal)) {
  dotenv.config({ path: envTestLocal, override: true });
}

const files = [
  'tests/finance-payment-model.test.ts',
  'tests/finance-payment-schema-postgres.test.ts',
  'tests/finance-payment-postgres.test.ts',
  'tests/finance-payment-concurrency-postgres.test.ts',
  'tests/finance-payment-provider-config-postgres.test.ts',
  'tests/finance-payment-http.test.ts',
  'tests/finance-payment-emis-contract.test.ts',
  'tests/finance-payment-adyen-adapter.test.ts',
  'tests/finance-payment-adyen-webhook-postgres.test.ts',
  'tests/finance-payment-webhook-http.test.ts',
  'tests/finance-payment-secret-resolver.test.ts',
  'tests/finance-payment-client.test.ts',
  'tests/finance-payment-ui.test.ts',
  'tests/finance-payment-runtime-parity.test.ts',
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

console.log('\n[FINANCE-F3-01] All Payment Core & Provider Adapter Foundation tests passed successfully.');
