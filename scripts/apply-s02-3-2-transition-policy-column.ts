import { readFile, writeFile } from 'node:fs/promises';
const path = 'src/modules/enrollments/enrollment.controller.ts';
let source = await readFile(path, 'utf8');
source = source.replace(
  "const existing = await client.query<{ status: EnrollmentStatus }>(",
  "const existing = await client.query<{ status: EnrollmentStatus; document_policy_id: string | null }>(",
);
source = source.replace(
  '`SELECT status FROM enrollment_applications WHERE id = $1 AND institution_id = $2 FOR UPDATE`',
  '`SELECT status, document_policy_id FROM enrollment_applications WHERE id = $1 AND institution_id = $2 FOR UPDATE`',
);
if (!source.includes('document_policy_id: string | null') || !source.includes('SELECT status, document_policy_id FROM enrollment_applications')) {
  throw new Error('S02.3.2 transition policy column integration failed.');
}
await writeFile(path, source, 'utf8');
console.log('[S02.3.2] transition policy column ready.');
