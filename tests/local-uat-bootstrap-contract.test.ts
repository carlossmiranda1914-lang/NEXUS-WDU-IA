import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [bootstrap, worktree, packageJson] = await Promise.all([
  readFile(new URL('../scripts/bootstrap-local-uat.ts', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/bootstrap-local-worktree.ps1', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
]);
for (const required of ['readApprovedTestTarget', 'runMigrations', 'provision-local-iam-uat.ts', 'NEXUS_UAT_FIREBASE_UID', 'student_academic_placements', 'history_count']) assert.ok(bootstrap.includes(required), `Missing local UAT bootstrap invariant: ${required}`);
for (const forbidden of ['password', 'apiKey', 'users.role', 'localStorage']) assert.equal(bootstrap.toLowerCase().includes(forbidden.toLowerCase()), false, `Forbidden bootstrap content: ${forbidden}`);
assert.ok(worktree.includes('HardLink') && worktree.includes('git check-ignore'));
assert.ok(!worktree.includes('codex/academic-01-temporal-structure'));
assert.ok(JSON.parse(packageJson).scripts['uat:bootstrap']);
console.log('Local UAT bootstrap contract: PASS.');
