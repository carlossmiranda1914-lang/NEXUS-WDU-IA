import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const root = mkdtempSync(path.join(os.tmpdir(), 'nexus-quality-gate-'));
const runner = path.resolve('scripts/run-quality-gate.mjs');
const invoke = gates => { const manifest = path.join(root, `${Math.random()}.json`); writeFileSync(manifest, JSON.stringify({ gates })); return spawnSync(process.execPath, [runner, '--base', 'HEAD', '--manifest', manifest], { encoding: 'utf8', timeout: 5000 }); };
try {
  assert.equal(invoke([{ name: 'pass', command: [process.execPath, '-e', 'process.exit(0)'] }]).status, 0);
  const failed = invoke([{ name: 'fail', command: [process.execPath, '-e', 'process.exit(9)'] }, { name: 'later', command: [process.execPath, '-e', 'console.log("later")'] }]);
  assert.notEqual(failed.status, 0); assert.ok(!failed.stdout.includes('quality-gate: later'));
  console.log('FND-06 CP3-R quality-gate subgate failure propagation: PASS.');
} finally { rmSync(root, { recursive: true, force: true }); }
