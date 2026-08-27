import assert from 'node:assert/strict';
import type { Application, Response } from 'express';
import { registerIamReadRoutes, type IamReadDependencies } from '../src/modules/iam/iam-read.controller.ts';

const context = { personId: '22222222-2222-4222-8222-222222222222', personName: 'Admin', identityEmail: null, membershipId: '11111111-1111-4111-8111-111111111111', institutionId: '44444444-4444-4444-8444-444444444444', institutionName: 'A', institutionSlug: 'a', role: 'institution_admin' as const };
let handler: Function | undefined;
const app = { get: (_path: string, ...handlers: Function[]) => { assert.equal(_path, '/api/iam/memberships'); assert.equal(handlers.length, 2); handler = handlers[1]; return app; } } as unknown as Application;
const dependencies: IamReadDependencies = { pool: {} as any, requireAuth: ((_a: any, _b: any, next: any) => next()) as any, list: async (_pool, supplied, input) => { assert.equal(supplied, context); assert.equal(input.limit, 25); return { memberships: [{ id: '55555555-5555-4555-8555-555555555555', person: { displayName: 'Membro' }, role: 'teacher', status: 'active', version: 2 }], page: { nextCursor: null }, summary: { activeInstitutionAdminCount: 1 } }; } };
registerIamReadRoutes(app, dependencies); assert.ok(handler);
function response() { const result: { status?: number; body?: unknown } = {}; const res = { status: (status: number) => { result.status = status; return res; }, json: (body: unknown) => { result.body = body; return res; } } as unknown as Response; return { res, result }; }
{ const { res, result } = response(); await handler!({ institutionalContext: context, query: {} }, res); assert.equal(result.status, undefined); assert.deepEqual(result.body, { memberships: [{ id: '55555555-5555-4555-8555-555555555555', person: { displayName: 'Membro' }, role: 'teacher', status: 'active', version: 2 }], page: { nextCursor: null }, summary: { activeInstitutionAdminCount: 1 } }); }
{ const { res, result } = response(); await handler!({ query: {} }, res); assert.deepEqual(result, { status: 401, body: { error: 'Autenticação institucional necessária.' } }); }
{ const { res, result } = response(); await handler!({ institutionalContext: context, query: { institutionId: context.institutionId } }, res); assert.deepEqual(result, { status: 400, body: { error: 'Consulta de membros inválida.' } }); }
console.log('IAM read API tests passed.');
