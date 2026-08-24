import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('server.ts', 'utf8');
for (const route of ["app.post('/api/users'", "app.put('/api/users/:id'", "app.delete('/api/users/:id'"]) {
  const start = source.indexOf(route);
  assert.ok(start >= 0);
  const body = source.slice(start, start + 500);
  assert.match(body, /CANONICAL_IAM_PROVISIONING_REQUIRED/);
  assert.match(body, /return res\.status\(503\)/, 'fence must return before persistence');
}
console.log('FND-02 legacy user administration fence: PASS.');
