import assert from 'node:assert/strict'; import fs from 'node:fs'; const y=fs.readFileSync('.github/workflows/secretariat-ci.yml','utf8');
for(const fact of ['name: Secretariat Quality Gate','pull_request:','postgres:16','node-version: \'24\'','npm ci','timeout-minutes: 20','concurrency:','npm run lint','npm run build'])assert.ok(y.includes(fact),`workflow fact missing: ${fact}`);
assert.match(y,/^\s*push:\s*$/m,'quality-gate runs on all push branches, including main');
for(const absent of ['test:fnd02','test:fnd03','test:fnd04','test:fnd05','git diff --check','gitleaks'])assert.ok(!y.includes(absent),`CP0 expected gap changed: ${absent}`); console.log('FND-06 quality-gate CP5 characterization: PASS.');
