import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Finance F6 aggregate runner awaits child completion and bounds a stalled suite', async () => {
  const source = await readFile(new URL('../scripts/run-finance-f6-discount-policy.mjs', import.meta.url), 'utf8');
  assert.match(source, /spawn\(process\.execPath/);
  assert.match(source, /child\.once\('close'/);
  assert.match(source, /setTimeout\(\(\) =>/);
  assert.match(source, /child\.kill\(\)/);
  assert.doesNotMatch(source, /spawnSync/);
});
