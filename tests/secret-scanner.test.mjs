import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { isWithinRoot } from '../scripts/scan-secrets.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'nexus-secret-scan-'));
const run = file => spawnSync(process.execPath, ['scripts/scan-secrets.mjs', '--root', root, '--files', file], { cwd: process.cwd(), encoding: 'utf8' });
const fixture = (name, content) => { mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); writeFileSync(path.join(root, name), content); return name; };
const assertDetected = (name, content, rule) => { const result = run(fixture(name, content)); assert.notEqual(result.status, 0); assert.match(result.stderr, new RegExp(`\\[${rule}\\]`)); assert.ok(!result.stderr.includes('SYNTHETIC_SENTINEL')); };
try {
  assert.equal(isWithinRoot('/tmp/nexus-secret-scan', '/tmp/nexus-secret-scan/url.txt'), true);
  assert.equal(isWithinRoot('/tmp/nexus-secret-scan', '/tmp/nexus-secret-scan-nested/url.txt'), false);
  assert.equal(isWithinRoot('/tmp/nexus-secret-scan', '/tmp/other/url.txt'), false);
  assert.equal(run(fixture('clean.env.example', 'TOKEN=__REQUIRED_TOKEN__\n')).status, 0);
  assertDetected('url.txt', 'postgresql://user:SYNTHETIC_SENTINEL@remote.example/app', 'credential-bearing-url');
  assertDetected('key.txt', '-----BEGIN PRIVATE KEY-----\nSYNTHETIC_SENTINEL', 'private-key-marker');
  assertDetected('.env', 'TOKEN=SYNTHETIC_SENTINEL', 'tracked-env-file');
  assert.equal(run(fixture('firebase.json', '{"apiKey":"public-browser-config","projectId":"example"}')).status, 0);
  assert.equal(run(fixture('.github/workflows/ci.yml', 'postgresql://postgres:postgres@127.0.0.1:5432/nexus_test')).status, 0);
  console.log('FND-06 deterministic secret scanner fixtures: PASS.');
} finally { rmSync(root, { recursive: true, force: true }); }
