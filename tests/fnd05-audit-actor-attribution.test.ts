import assert from 'node:assert/strict';
import fs from 'node:fs';
const auth = fs.readFileSync('src/middleware/auth.ts', 'utf8');
const documents = fs.readFileSync('src/modules/enrollments/enrollment-document-api.ts', 'utf8');
const lifecycle = fs.readFileSync('src/modules/enrollments/enrollment.controller.ts', 'utf8');
const processApi = fs.readFileSync('src/modules/enrollments/enrollment-process-api.ts', 'utf8');
for (const source of [documents, lifecycle, processApi]) {
  assert.match(source, /context\.institutionId/, 'audit institution must be from resolved context');
  assert.match(source, /context\.personId/, 'audit actor must be from resolved context');
}
assert.match(auth, /resolveInstitutionalContext\(pool, decodedToken\.uid, requestedInstitutionId\)/);
assert.match(auth, /institution_not_authorized/);
assert.match(auth, /institution_selection_required/);
assert.doesNotMatch(documents, /input\.(actorId|personId|institutionId|tenantId)/, 'client input cannot attribute document audit actor/context');
console.log('FND-05 CP2 server-derived audit actor/context contract: PASS.');
