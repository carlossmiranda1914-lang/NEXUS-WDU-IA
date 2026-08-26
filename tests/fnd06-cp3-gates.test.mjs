import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const root = mkdtempSync(path.join(os.tmpdir(), 'nexus-cp3-'));
const diff = path.resolve('scripts/check-committed-diff.mjs'); const artifacts = path.resolve('scripts/check-artifacts.mjs');
try {
  const runArtifact = (...files) => spawnSync(process.execPath, [artifacts, '--files', ...files], { encoding: 'utf8' });
  assert.equal(runArtifact('src/clean.ts').status, 0); assert.notEqual(runArtifact('.env').status, 0); assert.notEqual(runArtifact('logs/recovery.log').status, 0);
  execFileSync('git', ['init'], { cwd: root }); execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root }); execFileSync('git', ['config', 'user.name', 'test'], { cwd: root });
  writeFileSync(path.join(root, 'file.txt'), 'clean\n'); execFileSync('git', ['add', '.'], { cwd: root }); execFileSync('git', ['commit', '-m', 'base'], { cwd: root, stdio: 'ignore' }); const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(spawnSync(process.execPath, [diff, '--base', base], { cwd: root }).status, 0);
  writeFileSync(path.join(root, 'file.txt'), 'bad  \n'); execFileSync('git', ['add', '.'], { cwd: root }); execFileSync('git', ['commit', '-m', 'whitespace'], { cwd: root, stdio: 'ignore' });
  assert.notEqual(spawnSync(process.execPath, [diff, '--base', base], { cwd: root }).status, 0); assert.notEqual(spawnSync(process.execPath, [diff, '--base', 'missing-base'], { cwd: root }).status, 0);
  console.log('FND-06 CP3 diff and artifact controlled failures: PASS.');
} finally { rmSync(root, { recursive: true, force: true }); }
