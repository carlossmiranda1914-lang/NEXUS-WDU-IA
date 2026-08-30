import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');

assert.match(source, /Percurso de alunos e matrículas/, 'The approved lifecycle must remain visible.');
assert.match(source, /order-1/, 'The lifecycle must be the primary Overview composition.');
assert.match(source, /Resumo operacional/, 'Metrics must be explicitly framed as secondary summaries.');
assert.match(source, /order-2/, 'Secondary metrics must follow the primary lifecycle.');
assert.match(source, /Processo selecionado/, 'The drawer must identify itself as selected-process detail.');
assert.doesNotMatch(source, /student\.displayName.*studentRef|studentRef.*student\.displayName/, 'Browser navigation must not correlate a student by display fields.');
console.log('[ALUNOS-01A] human-review single lifecycle hierarchy: PASS.');
