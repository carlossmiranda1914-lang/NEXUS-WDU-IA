import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runner = resolve(root, 'scripts', 'run-fnd04-baseline.mjs');
const passFixture = resolve(root, 'tests', 'fixtures', 'fnd04-runner-pass.test.mjs');
const failFixture = resolve(root, 'tests', 'fixtures', 'fnd04-runner-fail.test.mjs');
const missingFixture = resolve(root, 'tests', 'fixtures', 'fnd04-runner-missing.test.mjs');

const execute = (file) => spawnSync(process.execPath, [runner, '--test-file', file], {
  cwd: root,
  encoding: 'utf8',
  shell: false,
  timeout: 10_000,
});

const pass = execute(passFixture);
assert.equal(pass.status, 0, pass.stderr);

const failure = execute(failFixture);
assert.equal(failure.status, 17, failure.stderr);
assert.match(failure.stderr, /FND-04 baseline failed/);

const missing = execute(missingFixture);
assert.notEqual(missing.status, 0);
assert.match(missing.stderr, /missing or unreadable/);

console.log('FND-04 baseline runner contract: PASS.');
