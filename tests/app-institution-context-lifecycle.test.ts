import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canRetainInstitutionalContext, projectInstitutionalContext } from '../src/auth/institutional-context-projection.ts';

const firstProfile = projectInstitutionalContext({
  role: 'institution_admin',
  status: 'active',
  institution: { slug: 'nexus-local-iam-uat' },
});
assert.deepEqual(firstProfile, {
  role: 'institution_admin',
  status: 'active',
  institutionReference: 'nexus-local-iam-uat',
});

// Re-render and token refresh for the same Firebase identity retain only the
// already server-proven context; a different identity cannot inherit it.
assert.equal(canRetainInstitutionalContext('firebase-uid-1', 'firebase-uid-1'), true);
assert.equal(canRetainInstitutionalContext('firebase-uid-1', 'firebase-uid-2'), false);
assert.equal(projectInstitutionalContext({ role: 'institution_admin', status: 'active', institution: null }), null);

const app = readFileSync(resolve('src/App.tsx'), 'utf8');
assert.match(app, /onIdTokenChanged\(auth/, 'Token changes must reacquire the canonical profile/context.');
assert.match(app, /projectInstitutionalContext\(profile\)/, 'App must consume the server profile through the canonical projection.');
assert.match(app, /if \(!isRefreshForResolvedIdentity\) clearInstitutionalPresentation\(\);/, 'A same-identity transient profile failure must not clear an already resolved context.');
assert.equal(app.includes('Tenant: lisboa_central_01'), false, 'A stale browser tenant must not override the server projection.');
assert.equal(app.includes("localStorage.getItem('nexus_institution"), false, 'Browser storage must not authorize an institution.');

console.log('app-institution-context-lifecycle: PASS');
