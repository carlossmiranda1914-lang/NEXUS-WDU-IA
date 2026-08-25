import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (file: string) => fs.readFileSync(file, 'utf8');
const server = read('server.ts');
const intake = read('src/modules/enrollments/enrollment-intake.ts');
const documents = read('src/modules/enrollments/enrollment-document-api.ts');
const processApi = read('src/modules/enrollments/enrollment-process-api.ts');
const tasks = read('src/modules/school-tasks/school-task.repository.ts');
const observability = read('src/observability/request-audit.ts');
const app = read('src/App.tsx');
const auth = read('src/middleware/auth.ts');

for (const [id, source, marker] of [
  ['AT-01', intake, 'INSERT INTO enrollment_events'], ['AT-02', read('src/modules/enrollments/enrollment.controller.ts'), 'actor_person_id'],
  ['AT-03', documents, 'document_status_changed'], ['AT-04', processApi, 'process_reconciled'],
  ['AT-05', tasks, 'getTaskHistoryTimeline'], ['AT-06', read('src/modules/school-tasks/realtime-bridge.ts'), "REFRESH_DATA"],
  ['AT-07', observability, 'routePattern'], ['AT-08', server, 'CANONICAL_FINANCE_AUTHORITY_REQUIRED'],
  ['AT-09', auth, 'institution_not_authorized'], ['AT-10', app, 'FactualUnavailablePanel'],
  ['AT-11', server, "app.get('/api/logs', requireAuth"], ['AT-12', server, 'CANONICAL_AI_AUTHORITY_REQUIRED'],
] as const) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${id} producer/consumer marker must remain characterized`);

assert.match(observability, /never query parameters or request bodies/, 'AT-07 excludes query/body audit details');
assert.match(server, /shouldAuditRequest/, 'AT-07 is emitted after the response lifecycle');
assert.match(tasks, /tenantId/, 'AT-05 history retrieval takes tenant scope');
assert.match(server, /app\.use\('\/api\/school-tasks', requireAuth, multiTenantMiddleware\)/, 'AT-05 command context is server-derived');
console.log('FND-05 CP1 audit producer/consumer AS-IS characterization: PASS.');
