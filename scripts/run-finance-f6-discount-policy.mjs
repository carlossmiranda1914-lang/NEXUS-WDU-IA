import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envTestLocal = path.resolve(process.cwd(), '.env.test.local');
if (existsSync(envTestLocal)) dotenv.config({ path: envTestLocal, override: true });

const suites = [
  'tests/finance-money-model.test.ts',
  'tests/finance-discount-policy-schema-postgres.test.ts',
  'tests/finance-discount-policy-postgres.test.ts',
  'tests/finance-obligation-discount-schema-postgres.test.ts',
  'tests/finance-obligation-discount-postgres.test.ts',
  'tests/finance-obligation-financial-position.test.ts',
  'tests/finance-discount-concurrency-postgres.test.ts',
  'tests/finance-discount-policy-http.test.ts',
  'tests/finance-obligation-discount-http.test.ts',
  'tests/finance-discount-policy-ui.test.ts',
  'tests/finance-obligation-discount-ui.test.ts',
  'tests/finance-f6-real-flow-integration.test.ts',
];

const suiteTimeoutMs = 60_000;
const resultFileIndex = process.argv.indexOf('--result-file');
const resultFile = resultFileIndex >= 0 ? process.argv[resultFileIndex + 1] : null;
if (resultFileIndex >= 0 && !resultFile) throw new Error('--result-file requires a path');
const publishResult = result => {
  if (resultFile) writeFileSync(resultFile, `${JSON.stringify(result)}\n`, 'utf8');
};

const runSuite = suite => new Promise(resolveRun => {
  let settled = false;
  const finish = result => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    resolveRun(result);
  };
  const child = spawn(process.execPath, [path.resolve('node_modules', 'tsx', 'dist', 'cli.mjs'), '--test', suite], {
    cwd: process.cwd(),
    shell: false,
    stdio: 'inherit',
    env: process.env,
  });
  const timer = setTimeout(() => {
    child.kill();
    finish({ status: 1, reason: 'timeout' });
  }, suiteTimeoutMs);
  child.once('error', error => finish({ status: 1, reason: error.message }));
  child.once('close', (status, signal) => finish({ status: status ?? 1, reason: signal || `exit ${status}` }));
});

for (const suite of suites) {
  console.log(`\n>>> Running test suite: ${suite}`);
  const result = await runSuite(suite);
  if (result.status !== 0) {
    publishResult({ status: 'FAIL', suite, exitCode: result.status, reason: result.reason, suitesTotal: suites.length });
    console.error(`\n[FINANCE-F6-DISCOUNT-POLICY] Suite failed on ${suite} (${result.reason})`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n========================================');
console.log('FINANCE_F6_01_AGGREGATE=PASS');
console.log('========================================');
publishResult({ status: 'PASS', exitCode: 0, suitesTotal: suites.length, suitesPass: suites.length, suitesFail: 0 });
