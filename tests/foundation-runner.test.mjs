import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const root = mkdtempSync(path.join(os.tmpdir(), 'nexus-foundation-'));
const runner = path.resolve('scripts/run-foundation.mjs');
const run = manifest => spawnSync(process.execPath, [runner, '--manifest', manifest], { cwd: process.cwd(), encoding: 'utf8', timeout: 5000 });
const manifest = (name, gates) => { const file = path.join(root, name); writeFileSync(file, JSON.stringify({ totalTimeoutMs: 5000, gates })); return file; };
try {
  assert.equal(run(manifest('pass.json', [{ name: 'pass', command: ['node', '-e', 'process.exit(0)'], timeoutMs: 1000 }])).status, 0);
  const failed = run(manifest('failure.json', [{ name: 'fail', command: ['node', '-e', 'process.exit(7)'], timeoutMs: 1000 }, { name: 'later', command: ['node', '-e', 'console.log("later")'], timeoutMs: 1000 }]));
  assert.notEqual(failed.status, 0); assert.ok(!failed.stdout.includes('foundation: later'));
  assert.notEqual(run(manifest('missing-file.json', [{ name: 'missing', file: path.join(root, 'none.ts'), command: ['node', '-e', 'process.exit(0)'], timeoutMs: 1000 }])).status, 0);
  assert.notEqual(run(manifest('missing-script.json', [{ name: 'missing-script', script: 'test:not-present', command: ['node', '-e', 'process.exit(0)'], timeoutMs: 1000 }])).status, 0);
  assert.notEqual(run(manifest('timeout.json', [{ name: 'timeout', command: ['node', '-e', 'setInterval(()=>{},1000)'], timeoutMs: 30 }])).status, 0);
  console.log('FND-06 Foundation runner failure propagation: PASS.');
} finally { rmSync(root, { recursive: true, force: true }); }
