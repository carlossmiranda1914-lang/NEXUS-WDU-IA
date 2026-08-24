import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env.test.local');
if (!existsSync(envPath)) {
  console.error('[FND-01-CP2] Missing .env.test.local. Copy .env.test.local.example and fill only the local disposable test credential.');
  process.exit(1);
}

dotenv.config({ path: envPath, override: true });

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const steps = [
  ['run', 'nexus:preflight:db:test:safety'],
  ['run', 'test:fnd01:cp2:postgres'],
];

for (const args of steps) {
  const result = spawnSync(npmCommand, args, {
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });

  if (result.error) {
    console.error(`[FND-01-CP2] Failed to start ${npmCommand} ${args.join(' ')}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('[FND-01-CP2] LOCAL PASS: safety gate and real PostgreSQL integration proof succeeded.');
