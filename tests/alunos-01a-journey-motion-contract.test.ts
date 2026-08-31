import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');

assert.match(source, /const journeySelected = selectedLifecycleLabel === stage\.label/, 'Selection must be tied to the factual Journey choice, not inferred state.');
assert.match(source, /aria-pressed=\{journeySelected\}/, 'A selected Journey stage must expose a semantic selected state.');
assert.match(source, /data-journey-selected=\{journeySelected \? 'true' : 'false'\}/, 'The selection visual must use the semantic selected state.');
assert.match(source, /motion-safe:transition-\[transform,box-shadow,border-color,background-color\]/, 'Journey feedback must use restrained semantic motion.');
assert.match(source, /role="dialog" aria-modal="true"/, 'The existing drawer must retain an accessible continuity boundary.');
assert.match(source, /Estado da matrícula confirmado pelo servidor\./, 'Visible transition feedback must be emitted only after the server command resolves.');
assert.match(source, /motion-reduce:transition-none/, 'Reduced-motion users must retain the same state meaning without animation.');
assert.match(source, /focus-visible:ring-2/, 'Keyboard focus must remain distinguishable from selected Journey state.');
assert.doesNotMatch(source, /animate-pulse|animate-bounce|animate-ping/, 'No looping or decorative animation may be introduced.');

console.log('[ALUNOS-01A.2] Journey semantic motion contract: PASS.');
