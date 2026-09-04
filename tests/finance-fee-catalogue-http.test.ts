import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { once } from 'node:events';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { registerFeeCatalogueRoutes } from '../src/modules/finance/fee-catalogue-http.ts';
import type { InstitutionalRole } from '../src/auth/institutional-context.ts';

const app = express();
app.use(express.json());

const context = (role: string) => ({
  personId: '00000000-0000-0000-0000-000000000002',
  personName: 'P',
  identityEmail: null,
  membershipId: '00000000-0000-0000-0000-000000000003',
  institutionId: '00000000-0000-0000-0000-000000000001',
  institutionName: 'A',
  institutionSlug: 'a',
  role: role as InstitutionalRole,
});

const auth = createRequireAuth({
  verifyIdToken: async (token) => ({ uid: token }),
  pool: {} as any,
  resolveInstitutionalContext: async (_: any, uid: string) =>
    uid === 'missing' ? { kind: 'missing_membership' } : { kind: 'resolved', context: context(uid) },
});

const pool: any = { query: async () => ({ rows: [] }) };
registerFeeCatalogueRoutes(app, pool, { resolveEffective: async () => null }, auth);

const server = http.createServer(app);
server.listen(0, '127.0.0.1');
await once(server, 'listening');

try {
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = (role?: string, path = '/api/finance/fee-catalogue', init: RequestInit = {}) =>
    fetch(base + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(role ? { Authorization: `Bearer ${role}` } : {}),
        ...(init.headers || {}),
      },
    });

  // 1. Unauthenticated / Missing membership
  assert.equal((await request()).status, 401);
  assert.equal((await request('missing')).status, 403);

  // 2. Denied roles fail closed
  for (const role of ['secretariat', 'teacher', 'student', 'parent']) {
    assert.equal((await request(role)).status, 403);
    assert.equal((await request(role, '/api/finance/fee-catalogue', { method: 'POST', headers: { 'Idempotency-Key': 'k' }, body: '{}' })).status, 403);
    assert.equal((await request(role, '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000001', { method: 'PUT', headers: { 'Idempotency-Key': 'k' }, body: '{}' })).status, 403);
  }

  // 3. Director: read allowed (200), write denied (403)
  assert.equal((await request('director')).status, 200);
  assert.equal((await request('director', '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000001')).status, 404);
  assert.equal((await request('director', '/api/finance/fee-catalogue', { method: 'POST', headers: { 'Idempotency-Key': 'k' }, body: '{}' })).status, 403);
  assert.equal((await request('director', '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000001', { method: 'PUT', headers: { 'Idempotency-Key': 'k' }, body: '{}' })).status, 403);
  assert.equal((await request('director', '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000001/activate', { method: 'POST', headers: { 'Idempotency-Key': 'k' } })).status, 403);
  assert.equal((await request('director', '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000001/deactivate', { method: 'POST', headers: { 'Idempotency-Key': 'k' } })).status, 403);

  // 4. Financial: Idempotency-Key required on mutations (422)
  assert.equal((await request('financial', '/api/finance/fee-catalogue', { method: 'POST', body: '{}' })).status, 422);
  assert.equal((await request('financial', '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000001', { method: 'PUT', body: '{}' })).status, 422);
  assert.equal((await request('financial', '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000001/activate', { method: 'POST' })).status, 422);
  assert.equal((await request('financial', '/api/finance/fee-catalogue/00000000-0000-0000-0000-000000000001/deactivate', { method: 'POST' })).status, 422);

  // 5. Not found check
  assert.equal((await request('financial', '/api/finance/fee-catalogue/foreign')).status, 404);

  console.log('Finance fee catalogue HTTP createRequireAuth: PASS');
} finally {
  await new Promise<void>((r) => server.close(() => r()));
}
