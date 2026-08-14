import { readFile, writeFile } from 'node:fs/promises';
const path = 'src/modules/enrollments/enrollment.controller.ts';
let source = await readFile(path, 'utf8');
if (!source.includes('const documentGate = documentValidationGate(')) {
  const anchor = "      if (!canTransitionEnrollment(context.role, from, target)) { await client.query('ROLLBACK'); return reject(res, 403, 'Transição de matrícula não autorizada.'); }\n";
  if (!source.includes(anchor)) throw new Error('S02.3.2 validation gate anchor not found.');
  const block = "      if (target === 'validated') {\n        const documents = await client.query<{ document_type: string; required: boolean; status: 'pending' | 'submitted' | 'verified' | 'rejected' }>('SELECT document_type, required, status FROM enrollment_documents WHERE enrollment_application_id = $1 AND institution_id = $2', [req.params.id, context.institutionId]);\n        const documentGate = documentValidationGate(existing.rows[0].document_policy_id !== null, documents.rows.map((row) => ({ documentType: row.document_type, required: row.required, status: row.status })));\n        if (!documentGate.ready) { await client.query('ROLLBACK'); return reject(res, 409, documentGate.reason === 'POLICY_NOT_CAPTURED' ? 'A política documental desta matrícula ainda não foi capturada.' : 'Existem documentos obrigatórios por verificar.'); }\n      }\n";
  source = source.replace(anchor, anchor + block);
  await writeFile(path, source, 'utf8');
}
console.log('[S02.3.2] validated transition document gate ready.');
