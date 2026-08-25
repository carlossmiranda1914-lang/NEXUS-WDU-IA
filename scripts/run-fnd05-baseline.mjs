import { accessSync, constants } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_TEST_FILES = [
  'tests/fnd05-baseline-runner.test.mjs',
  'tests/fnd05-audit-surface-characterization.test.ts',
  'tests/fnd05-audit-actor-attribution.test.ts',
  'tests/fnd05-audit-retrieval-privacy.test.ts',
  'tests/request-audit.test.ts',
  'tests/institutional-context.test.ts',
  'tests/realtime-bridge.test.ts',
  'tests/secretariat-s02-2-backend-contract.test.ts',
  'tests/secretariat-s02-3-document-service-contract.test.ts',
  'tests/secretariat-s03-process-contract.test.ts',
  'tests/fnd02-school-tasks-legacy-write-fence.test.ts',
  'tests/fnd03-transitional-api-tenant-fence.test.ts',
];
const args = process.argv.slice(2);
const override = args.indexOf('--test-file');
const timeoutArg = args.indexOf('--timeout-ms');
const timeoutMs = timeoutArg === -1 ? 60_000 : Number(args[timeoutArg + 1]);
const testFiles = override === -1 ? DEFAULT_TEST_FILES : [args[override + 1]];
const tsxCli = resolve('node_modules', 'tsx', 'dist', 'cli.mjs');
if ((!Number.isFinite(timeoutMs) || timeoutMs <= 0) || (override !== -1 && (!testFiles[0] || args.filter((arg) => arg === '--test-file').length !== 1))) throw new Error('Usage: node scripts/run-fnd05-baseline.mjs [--test-file path] [--timeout-ms ms]');
for (const file of [tsxCli, ...testFiles]) { try { accessSync(file, constants.R_OK); } catch { throw new Error(`FND-05 baseline test is missing or unreadable: ${file}`); } }
const run = (file) => new Promise((done) => {
  const child = spawn(process.execPath, [tsxCli, file], { cwd: process.cwd(), shell: false, stdio: 'inherit' });
  const timer = setTimeout(() => { child.kill(); done({ status: 1, reason: 'timeout' }); }, timeoutMs);
  child.once('error', (error) => { clearTimeout(timer); done({ status: 1, reason: error.message }); });
  child.once('exit', (status, signal) => { clearTimeout(timer); done({ status: status ?? 1, reason: signal || `exit ${status}` }); });
});
for (const file of testFiles) { console.log(`FND-05 baseline: ${file}`); const result = await run(file); if (result.status !== 0) { console.error(`FND-05 baseline failed: ${file} (${result.reason})`); process.exit(result.status || 1); } }
console.log('FND-05 baseline aggregate: PASS.');
