import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const panel = await readFile(new URL('../src/components/StudentContextPanel.tsx', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');
assert.match(panel, /A carregar contexto do aluno/); assert.match(panel, /Tentar novamente/); assert.match(panel, /Contexto atual/); assert.match(panel, /Histórico académico/); assert.match(panel, /Indisponível nesta versão/); assert.match(panel, /Documentos de matrícula/);
assert.match(panel, /nextOffset !== null/); assert.match(panel, /nextOffset=\{data\.history\.enrollments\.nextOffset\}/); assert.match(panel, /nextOffset=\{data\.history\.placements\.nextOffset\}/);
assert.match(panel, /error === 401/); assert.match(panel, /error === 403/); assert.match(panel, /error === 404/); assert.doesNotMatch(panel, /localStorage/); assert.doesNotMatch(panel, /institutionId/); assert.doesNotMatch(panel, /phone|address|nationalId/i);
assert.match(workspace, /StudentContextPanel/); assert.match(workspace, /student_ref/); assert.doesNotMatch(workspace, /institutionId:/);
console.log('Student Context UI presentation/security contract: PASS.');
