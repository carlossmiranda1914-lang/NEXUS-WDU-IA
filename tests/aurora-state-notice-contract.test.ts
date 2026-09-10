import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/components/aurora/AuroraStateNotice.tsx'), 'utf8');
assert.match(source, /role = tone === 'danger' \? 'alert' : 'status'/, 'state notice must expose its severity semantically');
assert.match(source, /--color-state-warning/, 'state notice must consume semantic state tokens');
assert.match(source, /title/, 'state notice must include textual state context');
assert.match(source, /action/, 'state notice must support a legitimate optional next action');
console.log('AURORA_STATE_NOTICE_CONTRACT=PASS');
