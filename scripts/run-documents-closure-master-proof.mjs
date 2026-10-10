import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env.test.local');
if (!existsSync(envPath)) {
  console.error('[DOCUMENTS-CLOSURE] Missing .env.test.local.');
  process.exit(1);
}

dotenv.config({ path: envPath, override: true });
process.env.TEST_DATABASE_LOCAL_AUTHORIZED = 'true';
process.env.TEST_DATABASE_CONFIRMATION = 'NEXUS_TEST_DATABASE';
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://fence_guard:fence_guard@127.0.0.1:54329/fence_guard';
}

const npmCommand = process.platform === 'win32' ? process.execPath : 'node';
const result = spawnSync(
  npmCommand,
  ['--import', 'tsx', 'tests/documents-closure-master-proof.ts'],
  {
    stdio: 'inherit',
    env: process.env,
    shell: false,
  },
);

if (result.error) {
  console.error(`[DOCUMENTS-CLOSURE] Failed to run test: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 0);

