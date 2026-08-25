import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('server.ts', 'utf8');
for (const route of ["app.get('/api/documents'", "app.post('/api/documents'", "app.delete('/api/documents/:id'"]) {
  const body = source.slice(source.indexOf(route), source.indexOf(route) + 600);
  assert.match(body, /return res\.status\(503\).*CANONICAL_DOCUMENT_AUTHORITY_REQUIRED/s);
  const persist = body.indexOf('await db.');
  assert.ok(persist < 0 || body.indexOf('CANONICAL_DOCUMENT_AUTHORITY_REQUIRED') < persist);
}
console.log('FND-03 Generic Documents storage boundary fence: PASS.');
