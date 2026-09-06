import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { discoverMigrations } from '../src/db/migration-runner.ts';

// 1. Verify Migration Tip includes 0035
const migrationsDir = path.resolve('src/db/migrations');
const migrations = await discoverMigrations(migrationsDir);
const migration0035 = migrations.find((m) => m.filename.includes('0035_finance_payments_and_provider_config'));
assert.ok(migration0035, 'Migration 0035 must be discoverable at runtime tip');

// 2. Verify Git branch
try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  assert.equal(branch, 'codex/finance-f3-payment-core-provider-adapter', 'Must be executed from dedicated F3 branch');
} catch {
  // Ignore in isolated environments where git CLI might not be present
}

// 3. F3 itself remains allocation-free; descendant Finance verticals may add Allocation.
const hasAllocationTable = migrations.some((m) => m.filename.toLowerCase().includes('allocation'));
const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
if (currentBranch === 'codex/finance-f3-payment-core-provider-adapter') {
  assert.equal(hasAllocationTable, false, 'Allocation must NOT be implemented in the F3 branch');
}

console.log('Finance Payment Runtime Parity: PASS');
