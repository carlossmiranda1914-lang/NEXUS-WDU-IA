import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('server.ts', 'utf8');
for (const route of ["app.get('/api/invoices'", "app.post('/api/invoices/pay'", "app.post('/api/invoices'", "app.post('/api/invoices/cancel'", "app.post('/api/invoices/reconcile'"]) {
  const body = source.slice(source.indexOf(route), source.indexOf(route) + 450);
  assert.match(body, /return res\.status\(503\).*CANONICAL_FINANCE_AUTHORITY_REQUIRED/s);
  const persistence = body.indexOf('await db.');
  assert.ok(persistence < 0 || body.indexOf('CANONICAL_FINANCE_AUTHORITY_REQUIRED') < persistence);
}
for (const route of ["app.get('/api/announcements'", "app.post('/api/announcements'", "app.get('/api/chat-messages'", "app.post('/api/chat-messages'"]) {
  const body = source.slice(source.indexOf(route), source.indexOf(route) + 450);
  assert.match(body, /return res\.status\(503\).*CANONICAL_COMMUNICATION_AUTHORITY_REQUIRED/s);
  const persistence = body.indexOf('await db.');
  assert.ok(persistence < 0 || body.indexOf('CANONICAL_COMMUNICATION_AUTHORITY_REQUIRED') < persistence);
}
console.log('FND-03 transitional Finance and Communication API tenant fences: PASS.');
