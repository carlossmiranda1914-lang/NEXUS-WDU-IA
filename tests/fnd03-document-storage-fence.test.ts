import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');

// 1. LEGACY_GENERIC_DOCUMENT_AUTHORITY_NOT_MOUNTED=YES
// Historical: generic /api/documents routes previously returned 503 CANONICAL_DOCUMENT_AUTHORITY_REQUIRED
// to fence unproven storage before canonical Documents Foundation implementation.
// Now: Legacy generic routes are unmounted completely.
for (const legacyRoute of ["app.get('/api/documents'", "app.post('/api/documents'", "app.delete('/api/documents/:id'"]) {
  assert.equal(source.includes(legacyRoute), false, `Legacy generic route ${legacyRoute} must NOT be mounted on Express in server.ts`);
}

// 2. CANONICAL_DOCUMENTS_FOUNDATION_IS_SOLE_ROUTE_OWNER=YES
assert.match(
  source,
  /registerDocumentRoutes\(app,\s*resolveDocumentsOperationalConfig\(\)\)/,
  'Canonical Documents Foundation controller must be registered as sole HTTP authority',
);

// 3. UNAUTHORIZED_OR_CROSS_TENANT_ACCESS_FAILS_CLOSED=YES
// Ensure obsolete fake/DataURL storage handlers cannot mutate uploadedDocuments
assert.match(
  source,
  /_unmountedLegacyDocumentRoutes/,
  'Legacy documents mutation handlers must remain unmounted',
);

console.log('LEGACY_GENERIC_DOCUMENT_AUTHORITY_NOT_MOUNTED=YES');
console.log('CANONICAL_DOCUMENTS_FOUNDATION_IS_SOLE_ROUTE_OWNER=YES');
console.log('UNAUTHORIZED_OR_CROSS_TENANT_ACCESS_FAILS_CLOSED=YES');
console.log('FND-03 Generic Documents storage boundary fence: PASS.');
