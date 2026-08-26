import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
const workflow = fs.readFileSync('.github/workflows/secretariat-ci.yml', 'utf8');
const paths = [
  'tests/migration-runner.test.ts', 'tests/fnd02-school-tasks-dispatch-characterization.test.ts',
  'tests/fnd03-transitional-api-tenant-fence.test.ts', 'scripts/run-fnd04-baseline.mjs',
  'scripts/run-fnd05-baseline.mjs', 'tests/institutional-context.test.ts',
  'tests/enrollment-intake-api-postgres.test.ts', 'tests/fnd01-cp4-school-tasks-postgres.test.mts',
];
for (const path of paths) assert.ok(fs.existsSync(path), `Foundation characterization path missing: ${path}`);
for (const script of ['test:fnd02', 'test:fnd03', 'test:fnd04', 'test:fnd05', 'test:fnd06', 'test:migrations:isolated', 'lint', 'build']) assert.ok(manifest.scripts[script], `required script missing: ${script}`);
assert.ok(!manifest.scripts['test:fnd01'], 'CP1 must expose the current missing FND-01 aggregate');
for (const absentInvocation of ['npm run test:fnd02', 'npm run test:fnd03', 'npm run test:fnd04', 'npm run test:fnd05', 'npm run test:fnd06', 'git diff --check', 'gitleaks']) assert.ok(!workflow.includes(absentInvocation), `CP1 AS-IS gap changed: ${absentInvocation}`);
for (const presentInvocation of ['npm run test:migrations:isolated', 'npm run lint', 'npm run build', 'postgres:16', 'quality-gate']) assert.ok(workflow.includes(presentInvocation), `workflow fact missing: ${presentInvocation}`);
assert.match(workflow, /^\s*push:\s*$/m, 'CP5 requires every push to be covered');
assert.match(workflow, /^\s*pull_request:\s*$/m, 'CP5 requires every pull request to be covered');
assert.doesNotMatch(workflow, /^\s+(?:branches|paths|paths-ignore):/m, 'CP5 must not retain a branch or path-filter bypass');
console.log('FND-06 CP1 Foundation coverage and CP5 workflow policy characterization: PASS.');
