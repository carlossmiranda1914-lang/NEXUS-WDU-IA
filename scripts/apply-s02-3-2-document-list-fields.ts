import { readFile, writeFile } from 'node:fs/promises';
const path = 'src/modules/enrollments/enrollment-document-api.ts';
let source = await readFile(path, 'utf8');
const oldSelect = 'SELECT id, document_type, status, evidence_reference, verified_by, verified_at, created_at, updated_at';
const newSelect = 'SELECT id, document_type, status, required, source_requirement_id, evidence_reference, verified_by, verified_at, created_at, updated_at';
if (source.includes(oldSelect)) {
  source = source.replace(oldSelect, newSelect);
  await writeFile(path, source, 'utf8');
} else if (!source.includes(newSelect)) {
  throw new Error('S02.3.2 document list field anchor not found.');
}
console.log('[S02.3.2] document snapshot fields exposed.');
