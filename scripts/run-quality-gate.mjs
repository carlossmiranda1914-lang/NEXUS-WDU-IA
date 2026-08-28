import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const baseIndex = args.indexOf('--base');
const manifestIndex = args.indexOf('--manifest');
if ((baseIndex >= 0 && !args[baseIndex + 1]) || (manifestIndex >= 0 && !args[manifestIndex + 1])) throw new Error('Usage: node scripts/run-quality-gate.mjs [--base ref] [--manifest path]');
const base = (baseIndex >= 0 ? args[baseIndex + 1] : undefined) || process.env.QUALITY_GATE_BASE || execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], { encoding: 'utf8' }).trim();
if (!base) throw new Error('quality-gate requires a valid committed-diff base.');
const defaultGates = [
  { name: 'secret-scan', command: ['npm', 'run', 'test:secrets'] },
  { name: 'foundation', command: ['npm', 'run', 'test:foundation'] },
  { name: 'postgres-foundation', command: ['npm', 'run', 'test:postgres-foundation'] },
  { name: 'committed-diff', command: ['npm', 'run', 'test:diff', '--', '--base', base] },
  { name: 'artifact-scan', command: ['npm', 'run', 'test:artifacts'] },
];
const manifest = manifestIndex >= 0 ? JSON.parse(readFileSync(args[manifestIndex + 1], 'utf8')) : { gates: defaultGates };
if (!Array.isArray(manifest.gates) || manifest.gates.length === 0) throw new Error('quality-gate manifest is invalid.');
const run = gate => new Promise(done => {
  const executable = gate.command?.[0];
  if (!gate.name || !Array.isArray(gate.command) || !executable) throw new Error('quality-gate gate is invalid.');
  let settled = false;
  const child = spawn(executable, gate.command.slice(1), { cwd: process.cwd(), shell: process.platform === 'win32' && executable === 'npm', stdio: 'inherit' });
  const finish = result => { if (settled) return; settled = true; done(result); };
  child.once('error', error => finish({ status: 1, reason: error.message }));
  child.once('close', (status, signal) => finish({ status: status ?? 1, reason: signal || `exit ${status}` }));
});
for (const gate of manifest.gates) { console.log(`quality-gate: ${gate.name}`); const result = await run(gate); if (result.status !== 0) { console.error(`quality-gate failed: ${gate.name} (${result.reason})`); process.exit(result.status || 1); } }
console.log('quality-gate: PASS.');
