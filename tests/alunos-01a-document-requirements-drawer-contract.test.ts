import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const checklist = await readFile('src/components/EnrollmentDocumentChecklist.tsx', 'utf8');
const controller = await readFile('src/modules/enrollments/enrollment-document.controller.ts', 'utf8');
const api = await readFile('src/modules/enrollments/enrollment-document-requirements-api.ts', 'utf8');

assert.match(controller, /app\.post\('\/api\/enrollments\/:id\/document-requirements'/, 'The existing Enrollment boundary must expose the server-authorized configuration command.');
assert.match(api, /canConfigureDocumentRequirements/, 'Only the canonical configuration policy may authorize the command.');
assert.match(api, /captureEnrollmentDocumentPolicy/, 'Configuration must materialize the existing canonical snapshot rather than invent browser state.');
assert.match(api, /SNAPSHOT_ALREADY_CAPTURED/, 'Historical snapshots must be immutable unless an explicit future authority is designed.');
assert.match(checklist, /configuration\?\.allowed/, 'The drawer must receive server-derived configuration capability.');
assert.match(checklist, /document-requirements/, 'The drawer must use the real document-requirements endpoint.');
assert.match(checklist, /Configurar requisitos documentais/, 'The product must name the authorized action in human Portuguese.');
assert.doesNotMatch(checklist, /upload|storage|localStorage/i, 'The checklist must not claim physical upload or local persistence.');
console.log('[ALUNOS-01A-DOCUMENTS] drawer contract: PASS.');
