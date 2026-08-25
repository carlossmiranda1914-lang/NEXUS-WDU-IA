import assert from 'node:assert/strict'; import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8')); const workflow = fs.readFileSync('.github/workflows/secretariat-ci.yml', 'utf8');
for (const script of ['test:foundation', 'test:diff', 'test:artifacts']) assert.ok(manifest.scripts[script], `${script} missing`);
for (const invocation of ['npm run test:foundation', 'npm run test:diff -- --base', 'npm run test:artifacts']) assert.ok(workflow.includes(invocation), `quality-gate missing ${invocation}`);
assert.ok(!workflow.includes('continue-on-error'), 'mandatory CP3 gates cannot continue on error'); assert.ok(!workflow.includes('- main'), 'CP5 trigger work remains deferred');
console.log('FND-06 CP3 workflow integration characterization: PASS.');
