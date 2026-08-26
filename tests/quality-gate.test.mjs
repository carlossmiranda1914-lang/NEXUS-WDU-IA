import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.match(manifest.scripts['quality-gate'] || '', /run-quality-gate\.mjs/, 'quality-gate must be an executable canonical runner');
console.log('FND-06 CP3-R canonical quality-gate contract: PASS.');
