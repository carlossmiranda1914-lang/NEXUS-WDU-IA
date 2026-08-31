import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');

assert.match(source, /Etapa atual do percurso/, 'The drawer must name the selected human Journey stage.');
assert.match(source, /getEnrollmentJourneyLabel\(process\)/, 'The drawer must derive its human stage from the canonical process projection.');
assert.match(source, /P02.*P03|P03.*P02/, 'Preparação must retain P02 and P03 as factual backend substages.');
assert.match(source, /Subetapas factuais/, 'Backend stages must be presented as detail rather than a competing lifecycle.');
assert.doesNotMatch(source, /aria-label="Etapas do processo"/, 'The drawer must not render a second top-level lifecycle.');
assert.match(source, /process\.blockers/, 'Blockers remain server-provided drawer detail.');
assert.match(source, /process\.nextAction/, 'The next authorized action remains preserved.');
assert.match(source, /EnrollmentDocumentChecklist/, 'The document checklist remains inside the drawer.');
assert.match(source, /process\.version/, 'Confirmed process version remains visible.');

console.log('[ALUNOS-01A.2] drawer continuity: PASS.');
