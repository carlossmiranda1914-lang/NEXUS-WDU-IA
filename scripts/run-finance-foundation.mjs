import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envTestLocal = path.resolve(process.cwd(), '.env.test.local');
if (existsSync(envTestLocal)) {
  dotenv.config({ path: envTestLocal, override: true });
}

const tests = [
  'tests/finance-money-model.test.ts',
  'tests/finance-financial-context.test.ts',
  'tests/finance-foundation-schema-postgres.test.ts',
  'tests/finance-journal-postgres.test.ts',
  'tests/finance-idempotency-concurrency-postgres.test.ts',
  'tests/finance-reversal-concurrency-postgres.test.ts',
  'tests/finance-reversal-target-eligibility-postgres.test.ts',
  'tests/finance-projection-recovery-postgres.test.ts',
  'tests/finance-foundation-authority-fence.test.ts',
];

for (const test of tests) {
  const result = spawnSync('npx', ['tsx', test], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\n[FINANCE-FOUNDATION] All Finance Foundation tests passed successfully.');
