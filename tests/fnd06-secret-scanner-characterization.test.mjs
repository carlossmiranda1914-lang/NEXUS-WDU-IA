import assert from 'node:assert/strict';
import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const workflow = fs.readFileSync('.github/workflows/secretariat-ci.yml', 'utf8');
assert.match(manifest.scripts['test:secrets'] || '', /scan-secrets\.mjs/);
assert.ok(fs.existsSync('scripts/scan-secrets.mjs'));
assert.ok(workflow.includes('npm run test:secrets'), 'quality-gate must invoke the deterministic secret scanner');
console.log('FND-06 CP2 secret scanner integration characterization: PASS.');
