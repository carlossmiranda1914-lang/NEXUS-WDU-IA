import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envTestLocal = path.resolve(process.cwd(), '.env.test.local');
if (existsSync(envTestLocal)) dotenv.config({ path: envTestLocal, override: true });

const suites = [
  'tests/finance-money-model.test.ts',
  'tests/finance-discount-policy-schema-postgres.test.ts',
  'tests/finance-discount-policy-postgres.test.ts',
  'tests/finance-obligation-discount-schema-postgres.test.ts',
  'tests/finance-obligation-discount-postgres.test.ts',
  'tests/finance-obligation-financial-position.test.ts',
  'tests/finance-discount-concurrency-postgres.test.ts',
  'tests/finance-discount-policy-http.test.ts',
  'tests/finance-obligation-discount-http.test.ts',
  'tests/finance-discount-policy-ui.test.ts',
  'tests/finance-obligation-discount-ui.test.ts',
  'tests/finance-f6-real-flow-integration.test.ts',
];

for (const suite of suites) {
  console.log(`\n>>> Running test suite: ${suite}`);
  const result = spawnSync('npx', ['tsx', '--test', suite], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`\n[FINANCE-F6-DISCOUNT-POLICY] Suite failed on ${suite}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n========================================');
console.log('FINANCE_F6_01_AGGREGATE=PASS');
console.log('========================================');
