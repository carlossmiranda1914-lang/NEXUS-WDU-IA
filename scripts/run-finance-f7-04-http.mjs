import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envTestLocal = path.resolve(process.cwd(), '.env.test.local');
if (existsSync(envTestLocal)) dotenv.config({ path: envTestLocal, override: true });

const suites = [
  'tests/finance-financial-document-http-policy.test.ts',
  'tests/finance-financial-document-http.test.ts',
  'tests/finance-financial-document-http-postgres.test.ts',
];
const resultIndex = process.argv.indexOf('--result-file');
const resultFile = resultIndex < 0 ? null : process.argv[resultIndex + 1];
if (resultIndex >= 0 && !resultFile) throw new Error('--result-file requires a path');
const publish = result => { if (resultFile) writeFileSync(resultFile, `${JSON.stringify(result)}\n`); };

for (const suite of suites) {
  const result = spawnSync(process.execPath, [path.resolve('node_modules', 'tsx', 'dist', 'cli.mjs'), '--test', '--test-concurrency=1', suite], { stdio: 'inherit', shell: false, env: process.env });
  if (result.status !== 0) {
    publish({ status: 'FAIL', suite, exitCode: result.status ?? 1, suitesTotal: suites.length });
    process.exit(result.status ?? 1);
  }
}
console.log('FINANCE_F7_04_TARGETED=PASS');
publish({ status: 'PASS', exitCode: 0, suitesTotal: suites.length, suitesPass: suites.length, suitesFail: 0 });
