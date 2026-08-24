import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { registerSchoolTaskRoutes } from '../src/modules/school-tasks/school-task.controller.ts';
import { SchoolTaskService } from '../src/modules/school-tasks/school-task.service.ts';
import { pool } from '../src/db/index.ts';

type RequestResult = { status: number; body: any };

async function request(port: number, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<RequestResult> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const app = express();
app.use(express.json());
// Test-only authenticated institutional request context. The real controller,
// middleware and route registration remain unchanged.
app.use((req: any, _res, next) => {
  req.user = { uid: 'actor-a', dbName: 'Actor A', dbRole: 'admin' };
  req.institutionalContext = { institutionId: 'school-a', personId: 'person-a', personName: 'Actor A', role: 'institution_admin' };
  next();
});

const calls: Array<{ kind: string; id?: string; tenantId: string }> = [];
const originalCreate = SchoolTaskService.createTask;
const originalUpdate = SchoolTaskService.updateTask;
const legacyCalls: string[] = [];

SchoolTaskService.createTask = (async (task: any, tenantId: string) => {
  calls.push({ kind: 'create', tenantId });
  return { ...task, tenantId, schoolId: tenantId, organizationId: tenantId };
}) as typeof SchoolTaskService.createTask;
SchoolTaskService.updateTask = (async (id: string, _task: any, tenantId: string) => {
  calls.push({ kind: 'update', id, tenantId });
  return { id, tenantId };
}) as typeof SchoolTaskService.updateTask;

try {
  registerSchoolTaskRoutes(app);
  // This mirrors the legacy duplicate's registration position in server.ts:
  // after the modular routes. It must never receive an overlapping request.
  app.post('/api/school-tasks', (_req, res) => { legacyCalls.push('post'); res.status(299).json({ legacy: true }); });
  app.put('/api/school-tasks/:id', (_req, res) => { legacyCalls.push('put'); res.status(299).json({ legacy: true }); });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;

  const created = await request(port, 'POST', '/api/school-tasks', { title: 'Dispatch proof', description: 'Characterization' });
  assert.equal(created.status, 201);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { kind: 'create', tenantId: 'school-a' });
  assert.deepEqual(legacyCalls, []);

  const foreignTenant = await request(port, 'POST', '/api/school-tasks', { title: 'Must not write', description: 'Cross tenant' }, { 'x-institution-id': 'school-b' });
  assert.equal(foreignTenant.status, 403);
  assert.equal(calls.length, 1, 'tenant mismatch must stop before the modular storage call');
  assert.deepEqual(legacyCalls, []);

  const manipulatedId = await request(port, 'PUT', '/api/school-tasks/foreign-task-id', { status: 'Concluída' });
  assert.equal(manipulatedId.status, 200);
  assert.deepEqual(calls[1], { kind: 'update', id: 'foreign-task-id', tenantId: 'school-a' });
  assert.deepEqual(legacyCalls, [], 'direct overlapping API calls remain captured by modular routes');

  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  console.log('FND-02 School Tasks dispatch characterization: PASS (modular handler wins; tenant context reaches service; duplicate legacy handler is not dispatched).');
} finally {
  SchoolTaskService.createTask = originalCreate;
  SchoolTaskService.updateTask = originalUpdate;
  await pool.end();
}
