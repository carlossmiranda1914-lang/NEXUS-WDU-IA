import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envTestLocal = path.resolve(process.cwd(), '.env.test.local');
if (existsSync(envTestLocal)) {
  dotenv.config({ path: envTestLocal, override: true });
}

const files = [
  'tests/finance-allocation-safety.test.ts',
  'tests/finance-allocation-model.test.ts',
  'tests/finance-allocation-schema-postgres.test.ts',
  'tests/finance-allocation-postgres.test.ts',
  'tests/finance-allocation-concurrency-postgres.test.ts',
  'tests/finance-allocation-http.test.ts',
  'tests/finance-allocation-client.test.ts',
  'tests/finance-allocation-ui.test.ts',
  'tests/finance-allocation-reversal-ui.test.ts',
];

for (const file of files) {
  const result = spawnSync('npx', ['tsx', file], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`\n[FINANCE-F4-ALLOCATION] Suite failed on ${file}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n[FINANCE-F4-ALLOCATION] All Allocation v1 tests passed successfully.');
