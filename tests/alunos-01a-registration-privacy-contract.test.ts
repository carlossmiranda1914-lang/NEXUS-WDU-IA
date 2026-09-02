import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/EnrollmentRegistrationPanel.tsx', import.meta.url), 'utf8');

assert.match(
  source,
  /\{editable && <TextField label="N\.º interno do aluno"[\s\S]*?studentNumber[\s\S]*?\/>\}/,
  'The internal student number may be collected during editable intake only; it must not render in the read-only Process Drawer.',
);
assert.match(
  source,
  /student:\s*\{\s*\.\.\.student,\s*expectedVersion:\s*studentVersion\s*\}/,
  'Editable intake must preserve the existing server-owned student-number payload rather than changing its authority.',
);

console.log('[ALUNOS-01A.2] registration privacy: PASS.');
