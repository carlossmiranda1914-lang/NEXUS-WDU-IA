import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const workflow = fs.readFileSync('.github/workflows/secretariat-ci.yml', 'utf8');
const qualityGate = fs.readFileSync('scripts/run-quality-gate.mjs', 'utf8');
assert.match(manifest.scripts['test:postgres-foundation'] || '', /run-postgres-foundation\.mjs/, 'CP4 PostgreSQL aggregate is required');
assert.ok(workflow.includes('npm run quality-gate') && qualityGate.includes('test:postgres-foundation'), 'quality-gate must invoke the CP4 PostgreSQL aggregate');
for (const file of ['scripts/setup-test-database.ts', 'scripts/verify-migrations-isolated.ts']) assert.ok(!fs.readFileSync(file, 'utf8').includes('.env.test.local'), `${file} must not read local secrets in CI`);
console.log('FND-06 CP4 PostgreSQL bootstrap RED/GREEN contract: PASS.');
