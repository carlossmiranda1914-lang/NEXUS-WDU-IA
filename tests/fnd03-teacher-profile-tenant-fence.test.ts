import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('server.ts', 'utf8');
for (const route of ["app.get('/api/teachers'", "app.post('/api/teachers'", "app.put('/api/teachers/:id'", "app.delete('/api/teachers/:id'", "app.post('/api/profile/request-access'"]) {
  const body = source.slice(source.indexOf(route), source.indexOf(route) + 500);
  assert.match(body, /return res\.status\(503\).*CANONICAL_TENANT_AUTHORITY_REQUIRED/s, `${route} must fail closed`);
  const write = body.indexOf('await db.');
  assert.ok(write < 0 || body.indexOf('CANONICAL_TENANT_AUTHORITY_REQUIRED') < write);
}
assert.match(source.slice(source.indexOf("app.post('/api/profile/role'"), source.indexOf("app.post('/api/profile/role'") + 400), /CANONICAL_TENANT_AUTHORITY_REQUIRED/);
console.log('FND-03 Teacher/Profile tenant fences: PASS.');
