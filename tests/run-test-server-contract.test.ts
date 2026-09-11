import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('test runtime uses the approved normalized disposable connection authority', () => {
  const source = readFileSync(new URL('../scripts/run-test-server.ts', import.meta.url), 'utf8');
  assert.match(source, /readApprovedTestTarget/, 'test runtime must reuse the approved target guardrail');
  assert.match(source, /connectionString: testUrl/, 'test runtime must use the normalized connection string');
  assert.doesNotMatch(source, /process\.env\.DATABASE_URL\s*=\s*process\.env\.TEST_DATABASE_URL/, 'raw test URLs must not bypass normalization');
});
