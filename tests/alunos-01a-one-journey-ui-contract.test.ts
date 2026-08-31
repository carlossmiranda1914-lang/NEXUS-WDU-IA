import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');

assert.doesNotMatch(source, /buildOperationalMetrics|selectMetric\(|metrics\.map\(/, 'The four operational metrics cannot remain a second lifecycle navigation surface.');
assert.match(source, /request\(`\/api\/enrollments\/\$\{record\.id\}\/process`\)/, 'The rail must load the existing server-owned process projection for each factual membership decision.');
assert.match(source, /setJourneyEnrollmentIds\(stage\.enrollmentIds\)/, 'Selecting a Journey stage must retain its exact canonical process membership.');
assert.match(source, /journeyEnrollmentIds\.includes\(record\.id\)/, 'The selected Journey stage must filter the existing list by exact canonical process membership, not broad status heuristics.');
assert.doesNotMatch(source, /setStatusFilter\(stage\.statuses/, 'Journey selection must not filter by the status compatibility field.');
assert.match(source, /Processos confirmados/, 'Compact confirmed-process counts must remain inside the Journey Rail.');
assert.match(source, /grid-flow-col[\s\S]{0,280}xl:auto-cols/, 'The same horizontally scrollable Journey Rail must serve desktop and mobile.');

console.log('[ALUNOS-01A.2] one Journey Rail: PASS.');
