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
assert.match(source, /runtimeIdentityMatches/, 'the preflight must verify the runtime SHA using the runtime identity endpoint, not a process command alone');
assert.match(source, /NEXUS_UAT_FIREBASE_UID/, 'the preflight must require the canonical identity fixture without exposing it');
assert.match(source, /--origin/, 'the preflight must accept the intended human-UAT origin explicitly');
assert.match(source, /NON_CANONICAL_AUTH_UAT_ORIGIN_REJECTED/, 'the preflight must reject a non-canonical authenticated UAT origin');
assert.match(source, /CODEX_PREVIEW_AUTH_UAT_SUPPORTED/, 'the preflight must state that the Codex preview is not an authenticated-UAT authority');
assert.match(source, /__uat\/runtime/, 'the preflight must require the runtime identity endpoint');
assert.match(source, /RUNTIME_IDENTITY_REQUIRED/, 'the preflight must reject HTTP 200 without runtime identity');
assert.match(source, /Get-NetTCPConnection -LocalPort 3000/, 'the preflight must correlate runtime identity with the actual port listener, not a tsx wrapper');
assert.match(guide, /http:\/\/localhost:3000/, 'the documented guardrail must name the single canonical origin');
assert.match(guide, /EXTERNAL_CONFIGURATION_REQUIRED/, 'the documented guardrail must forbid a false readiness result');
assert.match(guide, /Codex preview.*not supported/i, 'the documented guardrail must reject Codex preview as a human-UAT browser');

console.log('UAT_RUNTIME_PREFLIGHT_CONTRACT=PASS');
