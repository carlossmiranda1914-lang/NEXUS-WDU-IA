import test from 'node:test';
import assert from 'node:assert/strict';
import { multiTenantMiddleware } from '../src/middleware/multi-tenant.ts';

const context = {
  personId: 'person-1', personName: 'Carlos', identityEmail: 'carlos@example.edu',
  membershipId: 'membership-1', institutionId: 'institution-1',
  institutionName: 'Escola Alfa', institutionSlug: 'escola-alfa', role: 'institution_admin' as const,
};

function response() {
  return { statusCode: 0, body: undefined as unknown, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
}

test('derives every tenant field from the active institutional membership', () => {
  const req: any = { institutionalContext: context, headers: {}, query: {} };
  const res = response();
  let continued = false;
  multiTenantMiddleware(req, res as any, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(req.tenantId, 'institution-1');
  assert.equal(req.schoolId, 'institution-1');
  assert.equal(req.organizationId, 'institution-1');
});

test('rejects a client attempt to select another institution', () => {
  const req: any = { institutionalContext: context, headers: { 'x-tenant-id': 'institution-other' }, query: {} };
  const res = response();
  multiTenantMiddleware(req, res as any, () => assert.fail('must not continue'));
  assert.equal(res.statusCode, 403);
});
