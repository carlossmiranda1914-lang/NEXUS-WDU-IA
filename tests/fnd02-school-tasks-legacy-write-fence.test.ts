import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const server = fs.readFileSync(path.resolve('server.ts'), 'utf8');
const controller = fs.readFileSync(path.resolve('src/modules/school-tasks/school-task.controller.ts'), 'utf8');
const mutations = [
  ["post", "/api/school-tasks"],
  ["put", "/api/school-tasks/:id"],
  ["delete", "/api/school-tasks/:id"],
  ["post", "/api/school-tasks/:id/restore"],
  ["post", "/api/school-tasks/import-backup"],
] as const;

for (const [method, route] of mutations) {
  const registrations = `${server}\n${controller}`.split('\n').filter((line) => line.includes(`app.${method}('${route}'`));
  assert.equal(registrations.length, 1, `${method.toUpperCase()} ${route} must have exactly one mounted authority`);
}

assert.doesNotMatch(server, /app\.(post|put|delete)\('\/api\/school-tasks[^\n]*legacy/i, 'legacy Task mutations must not be mounted');
console.log('FND-02 School Tasks legacy write fence RED/GREEN structural contract: PASS.');
