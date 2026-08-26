import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/secretariat-ci.yml', 'utf8');
const evidence = fs.readFileSync('docs/roadmap/missions/FND-06_DOR_EVIDENCE.md', 'utf8');
assert.match(workflow, /^\s*push:\s*$/m, 'CP5 requires push coverage');
assert.match(workflow, /^\s*pull_request:\s*$/m, 'CP5 requires pull-request coverage');
assert.doesNotMatch(workflow, /^\s+(?:branches|paths|paths-ignore):/m, 'CP5 must not allow branch or path-filter bypasses');
assert.match(workflow, /run:\s+npm run quality-gate/, 'every covered event must invoke the canonical quality-gate');
assert.doesNotMatch(workflow, /continue-on-error|\|\|\s*true/, 'mandatory CI gates must remain fail-closed');
const criticalPaths = [
  'src/modules/example.ts',
  'server/routes.ts',
  'scripts/run-quality-gate.mjs',
  'src/db/migrations/0019_example.sql',
  'tests/example.test.ts',
  '.github/workflows/secretariat-ci.yml',
  'package.json',
  'package-lock.json',
  'docs/operations/incident-response.md',
];
for (const changedPath of criticalPaths) {
  assert.equal(/^\s+(?:branches|paths|paths-ignore):/m.test(workflow), false, `${changedPath} must not bypass the workflow`);
}
for (const policyFact of ['direct-`eval`', 'chunk-size warnings', 'DEP0190', 'application maintainers', 'CI maintainers', '2026-09-30']) {
  assert.ok(evidence.includes(policyFact), `CP5 warning policy missing: ${policyFact}`);
}
console.log('FND-06 CP5 trigger coverage: PASS.');
