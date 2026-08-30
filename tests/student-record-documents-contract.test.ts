import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = readFileSync(resolve('src/components/StudentRecordWorkspace.tsx'), 'utf8');

assert.match(workspace, /Documentos/);
assert.match(workspace, /context\.documents\.metadata/);
assert.match(workspace, /Ainda não existem documentos registados para este aluno/);
assert.match(workspace, /Verificado em/);
assert.match(workspace, /Referência recebida/);
assert.doesNotMatch(workspace, /evidence_reference|storage|fileUrl|documentId|personId|institutionId/);

console.log('student-record-documents-contract: PASS');
