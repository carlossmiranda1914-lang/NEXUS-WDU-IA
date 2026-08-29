import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = readFileSync(resolve('src/components/StudentRecordWorkspace.tsx'), 'utf8');

assert.equal((workspace.match(/request\(`\/api\/student-context\/\$\{studentRef\}`\)/g) ?? []).length, 1, 'one Student Context request must feed all read-only tabs without tab refetches');
for (const path of ['context.student.displayName', 'context.current.enrollment', 'context.history.placements.items', 'context.documents.metadata', 'context.guardians.items']) assert.ok(workspace.includes(path), `the integrated record must use authoritative data for ${path}`);
assert.doesNotMatch(workspace, /Ana Manuel|Maria Manuel|student360\.uat|\bUAT\b|Student 360|>Enrollment<|>placement<|>guardian<|>parent</i);
assert.match(workspace, /role="status"/);
assert.match(workspace, /role="alert"/);
assert.match(workspace, /AUTH_REQUIRED/);
assert.match(workspace, /FORBIDDEN/);
assert.match(workspace, /NOT_FOUND/);

console.log('student-record-final-hardening-contract: PASS');
