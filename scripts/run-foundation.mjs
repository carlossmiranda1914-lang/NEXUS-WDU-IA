import { accessSync, constants, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const manifestArg = process.argv.indexOf('--manifest');
const manifestPath = manifestArg >= 0 ? process.argv[manifestArg + 1] : 'scripts/foundation-gates.json';
if (!manifestPath || process.argv.length > (manifestArg >= 0 ? 4 : 2)) throw new Error('Usage: node scripts/run-foundation.mjs [--manifest path]');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
if (!Array.isArray(manifest.gates) || !Number.isFinite(manifest.totalTimeoutMs)) throw new Error('Foundation manifest is invalid.');
for (const gate of manifest.gates) {
  if (!gate.name || !Array.isArray(gate.command) || !Number.isFinite(gate.timeoutMs) || gate.timeoutMs <= 0) throw new Error(`Foundation gate is invalid: ${gate.name || 'unknown'}`);
  if (gate.file) accessSync(resolve(gate.file), constants.R_OK);
  if (gate.script && !packageJson.scripts[gate.script]) throw new Error(`Foundation gate script is missing: ${gate.script}`);
}
const started = Date.now();
const run = gate => new Promise(done => {
  let settled = false;
  const child = spawn(gate.command[0], gate.command.slice(1), { cwd: process.cwd(), shell: process.platform === 'win32', stdio: 'inherit' });
  const finish = result => { if (settled) return; settled = true; clearTimeout(timer); done(result); };
  const timer = setTimeout(() => { child.kill(); finish({ status: 1, reason: 'timeout' }); }, gate.timeoutMs);
  child.once('error', error => finish({ status: 1, reason: error.message }));
  child.once('close', (status, signal) => finish({ status: status ?? 1, reason: signal || `exit ${status}` }));
});
for (const gate of manifest.gates) {
  if (Date.now() - started >= manifest.totalTimeoutMs) throw new Error('Foundation aggregate total timeout exceeded.');
  console.log(`foundation: ${gate.name}`);
  const result = await run(gate);
  if (result.status !== 0) { console.error(`foundation failed: ${gate.name} (${result.reason})`); process.exit(result.status || 1); }
}
console.log('foundation: PASS.');
