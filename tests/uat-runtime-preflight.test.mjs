import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'run-uat-runtime-preflight.mjs'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'docs', 'operations', 'uat-runtime-preflight.md'), 'utf8');

assert.match(source, /CANONICAL_UAT_ORIGIN\s*=\s*'http:\/\/localhost:3000'/, 'the preflight must define one canonical browser origin');
assert.match(source, /EXTERNAL_CONFIGURATION_REQUIRED/, 'the preflight must clearly fail rather than fake Firebase authorization');
assert.match(source, /verifyApprovedTestConnection/, 'the preflight must verify the safe disposable PostgreSQL target');
assert.match(source, /discoverMigrations/, 'the preflight must verify the migration ledger');
assert.match(source, /READY_FOR_HUMAN_UAT/, 'the preflight must make the human-UAT decision explicit');
assert.match(source, /NEXUS_UAT_FIREBASE_UID/, 'the preflight must require the canonical identity fixture without exposing it');
assert.match(guide, /http:\/\/localhost:3000/, 'the documented guardrail must name the single canonical origin');
assert.match(guide, /EXTERNAL_CONFIGURATION_REQUIRED/, 'the documented guardrail must forbid a false readiness result');

console.log('UAT_RUNTIME_PREFLIGHT_CONTRACT=PASS');
