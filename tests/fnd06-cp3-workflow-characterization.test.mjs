import assert from 'node:assert/strict'; import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8')); const workflow = fs.readFileSync('.github/workflows/secretariat-ci.yml', 'utf8');
for (const script of ['test:foundation', 'test:diff', 'test:artifacts']) assert.ok(manifest.scripts[script], `${script} missing`);
assert.ok(workflow.includes('npm run quality-gate'), 'workflow must invoke the canonical quality-gate');
assert.ok(!workflow.includes('continue-on-error'), 'mandatory CP3 gates cannot continue on error'); assert.match(workflow, /^\s*push:\s*$/m, 'CP5 covers every push branch');
console.log('FND-06 CP3 workflow integration and CP5 trigger characterization: PASS.');
