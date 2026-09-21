import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envTestLocal = path.resolve(process.cwd(), '.env.test.local');
if (existsSync(envTestLocal)) {
  dotenv.config({ path: envTestLocal, override: true });
}

const files = [
  'tests/finance-financial-account-model.test.ts',
  'tests/finance-financial-obligation-model.test.ts',
  'tests/finance-financial-account-postgres.test.ts',
  'tests/finance-financial-obligation-postgres.test.ts',
  'tests/finance-financial-obligation-http.test.ts',
  'tests/finance-financial-obligation-client.test.ts',
  'tests/finance-financial-obligation-ui.test.ts',
  'tests/finance-f2-real-flow-integration.test.ts',
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

console.log('\n[FINANCE-F2-01] All Financial Account & Obligation tests passed successfully.');
