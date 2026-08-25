import { accessSync, constants } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_TEST_FILES = [
  'tests/fnd04-baseline-runner.test.mjs',
  'tests/institutional-context.test.ts',
  'tests/person-resolution.test.ts',
  'tests/person-resolution-access.test.ts',
  'tests/enrollment-intake.test.ts',
  'tests/enrollment-intake-api-contract.test.ts',
  'tests/enrollment-operations-ui-contract.test.ts',
  'tests/secretariat-s02-3-document-service-contract.test.ts',
  'tests/secretariat-s02-3-document-policy.test.ts',
  'tests/fnd02-school-tasks-legacy-write-fence.test.ts',
  'tests/fnd02-system-student-write-fence.test.ts',
  'tests/fnd02-browser-persistence-truth.test.ts',
  'tests/fnd02-document-prototype-truth.test.ts',
  'tests/fnd02-google-import-truth.test.ts',
  'tests/fnd03-transitional-api-tenant-fence.test.ts',
  'tests/fnd03-teacher-profile-tenant-fence.test.ts',
  'tests/fnd03-document-storage-fence.test.ts',
  'tests/fnd03-cp6-authority-fence.test.ts',
  'tests/institution-resource-ownership.test.ts',
  'tests/multi-tenant.test.ts',
];

const args = process.argv.slice(2);
const overrideIndex = args.indexOf('--test-file');
const testFiles = overrideIndex === -1 ? DEFAULT_TEST_FILES : [args[overrideIndex + 1]];
const timeoutMs = 60_000;
const tsxCli = resolve('node_modules', 'tsx', 'dist', 'cli.mjs');

if (overrideIndex !== -1 && (!testFiles[0] || args.length !== 2)) {
  throw new Error('Usage: node scripts/run-fnd04-baseline.mjs [--test-file path]');
}

for (const file of [tsxCli, ...testFiles]) {
  try {
    accessSync(file, constants.R_OK);
  } catch {
    throw new Error(`FND-04 baseline test is missing or unreadable: ${file}`);
  }
}

const run = (file) => new Promise((resolveRun) => {
  const child = spawn(process.execPath, [tsxCli, file], {
    cwd: process.cwd(),
    shell: false,
    stdio: 'inherit',
  });
  const timer = setTimeout(() => child.kill(), timeoutMs);
  child.once('error', (error) => {
    clearTimeout(timer);
    resolveRun({ file, error, status: 1 });
  });
  child.once('exit', (status, signal) => {
    clearTimeout(timer);
    resolveRun({ file, signal, status: status ?? 1 });
  });
});

for (const file of testFiles) {
  console.log(`FND-04 baseline: ${file}`);
  const result = await run(file);
  if (result.status !== 0) {
    const reason = result.error?.message || result.signal || `exit ${result.status}`;
    console.error(`FND-04 baseline failed: ${file} (${reason})`);
    process.exit(result.status || 1);
  }
}

console.log('FND-04 baseline aggregate: PASS.');
