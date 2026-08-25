import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const auth = fs.readFileSync('src/middleware/auth.ts', 'utf8');
const tenant = fs.readFileSync('src/middleware/multi-tenant.ts', 'utf8');
const profile = fs.readFileSync('server.ts', 'utf8');

assert.doesNotMatch(app, /fetch\('\/api\/profile\/role'/);
assert.match(app, /As permissões resultam da associação institucional ativa/);
assert.match(app, /const clearInstitutionalPresentation/);
assert.match(app, /setTasks\(\[\]\)/);
assert.match(app, /setCurrentUserRole\('student'\)/);
assert.match(app, /if \(pRes\.ok\)/);
assert.match(app, /await signOut\(auth\);[\s\S]{0,150}clearInstitutionalPresentation\(\)/);

assert.match(auth, /resolveInstitutionalContext\(pool, decodedToken\.uid, requestedInstitutionId\)/);
assert.match(auth, /missing_membership/);
assert.match(auth, /institution_selection_required/);
assert.match(auth, /institution_not_authorized/);
assert.match(tenant, /requestedInstitutionId !== context\.institutionId/);
assert.match(profile, /app\.get\('\/api\/profile', requireAuth/);
assert.match(profile, /institution: req\.institutionalContext/);

console.log('FND-04 authorization and refresh truth contract: PASS.');
