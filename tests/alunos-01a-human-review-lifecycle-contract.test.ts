import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');

assert.match(source, /Percurso de alunos e matrículas/, 'The approved lifecycle must remain visible.');
assert.doesNotMatch(source, /buildOperationalMetrics|selectMetric\(|metrics\.map\(/, 'The four operational metric cards must not remain as a competing process surface.');
assert.match(source, /setJourneyEnrollmentIds\(stage\.enrollmentIds\)/, 'Journey selection must retain exact server-derived process membership.');
assert.match(source, /journeyEnrollmentIds\.includes\(record\.id\)/, 'Journey filtering must use factual process membership rather than broad status heuristics.');
assert.match(source, /grid-flow-col[\s\S]{0,280}xl:auto-cols/, 'Desktop and mobile must use the same responsive Journey Rail.');
assert.match(source, /Processo selecionado/, 'The drawer must identify itself as selected-process detail.');
assert.doesNotMatch(source, /student\.displayName.*studentRef|studentRef.*student\.displayName/, 'Browser navigation must not correlate a student by display fields.');
console.log('[ALUNOS-01A] human-review single lifecycle hierarchy: PASS.');
