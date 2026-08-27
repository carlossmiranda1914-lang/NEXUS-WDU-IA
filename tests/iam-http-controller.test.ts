import assert from 'node:assert/strict';
import type { Application, Response } from 'express';
import { registerIamRoutes, type IamHttpDependencies } from '../src/modules/iam/iam.controller.ts';
import { IamCommandError } from '../src/modules/iam/iam-command-types.ts';

type Route = { method: string; path: string; handlers: Function[] };
const routes: Route[] = [];
const app = {
  post: (path: string, ...handlers: Function[]) => { routes.push({ method: 'post', path, handlers }); return app; },
  patch: (path: string, ...handlers: Function[]) => { routes.push({ method: 'patch', path, handlers }); return app; },
} as unknown as Application;
const context = { personId: '22222222-2222-4222-8222-222222222222', personName: 'Admin', identityEmail: null, membershipId: '11111111-1111-4111-8111-111111111111', institutionId: '44444444-4444-4444-8444-444444444444', institutionName: 'A', institutionSlug: 'a', role: 'institution_admin' as const };
let calls = 0;
const dependencies: IamHttpDependencies = {
  pool: {} as IamHttpDependencies['pool'],
  requireAuth: ((_req: any, _res: any, next: any) => next()) as any,
  commands: {
    grant: async (_pool, input) => { calls++; assert.equal(input.context, context); return { membershipId: '55555555-5555-4555-8555-555555555555', status: 'active', role: 'teacher', version: 1, resultCode: 'SUCCEEDED', replayed: false }; },
    changeRole: async () => { throw new IamCommandError('VERSION_CONFLICT'); },
    revoke: async () => { throw new Error('internal SQL detail'); },
    activatePending: async (_pool, input) => { calls++; assert.equal(input.pendingMembershipId, '55555555-5555-4555-8555-555555555555'); return { membershipId: input.pendingMembershipId, status: 'active', role: 'teacher', version: 2, resultCode: 'SUCCEEDED', replayed: false }; },
  },
};
registerIamRoutes(app, dependencies);
assert.deepEqual(routes.map(({ method, path, handlers }) => [method, path, handlers.length]), [
  ['post', '/api/iam/memberships/grants', 2], ['patch', '/api/iam/memberships/:membershipId/role', 2], ['post', '/api/iam/memberships/:membershipId/revoke', 2],
]);
assert.equal(routes.some((route) => route.path.toLowerCase().includes('bootstrap')), false);

function response() {
  const result: { status?: number; body?: unknown } = {};
  const res = { status: (status: number) => { result.status = status; return res; }, json: (body: unknown) => { result.body = body; return res; } } as unknown as Response;
  return { res, result };
}
const grant = routes[0].handlers[1];
{ const { res, result } = response(); await grant({ institutionalContext: context, body: { target: { personId: '33333333-3333-4333-8333-333333333333' }, role: 'teacher', idempotencyKey: 'grant-http-001' }, headers: {}, params: {} }, res); assert.equal(result.status, 201); assert.deepEqual(result.body, { membership: { id: '55555555-5555-4555-8555-555555555555', status: 'active', role: 'teacher', version: 1 }, replayed: false }); }
{ const { res, result } = response(); await grant({ institutionalContext: context, body: { pendingMembershipId: '55555555-5555-4555-8555-555555555555', role: 'teacher', expectedVersion: 1, idempotencyKey: 'pending-http-001' }, headers: {}, params: {} }, res); assert.equal(result.status, 201); assert.deepEqual(result.body, { membership: { id: '55555555-5555-4555-8555-555555555555', status: 'active', role: 'teacher', version: 2 }, replayed: false }); }
{ const { res, result } = response(); await grant({ institutionalContext: context, body: { target: { personId: '33333333-3333-4333-8333-333333333333' }, role: 'teacher', idempotencyKey: 'grant-http-001', actorPersonId: context.personId }, headers: {}, params: {} }, res); assert.equal(result.status, 400); assert.equal(calls, 2); }
const change = routes[1].handlers[1];
{ const { res, result } = response(); await change({ institutionalContext: context, body: { role: 'teacher', expectedVersion: 1, idempotencyKey: 'change-http-001' }, headers: {}, params: { membershipId: '55555555-5555-4555-8555-555555555555' } }, res); assert.deepEqual(result, { status: 409, body: { error: 'Conflito de estado do acesso institucional.', code: 'VERSION_CONFLICT' } }); }
const revoke = routes[2].handlers[1];
{ const { res, result } = response(); await revoke({ institutionalContext: context, body: { expectedVersion: 1, idempotencyKey: 'revoke-http-001' }, headers: {}, params: { membershipId: '55555555-5555-4555-8555-555555555555' } }, res); assert.deepEqual(result, { status: 500, body: { error: 'Não foi possível concluir a operação IAM.' } }); }
{ const { res, result } = response(); await grant({ body: {}, headers: {}, params: {} }, res); assert.deepEqual(result, { status: 401, body: { error: 'Autenticação institucional necessária.' } }); }
console.log('IAM HTTP controller tests passed.');
