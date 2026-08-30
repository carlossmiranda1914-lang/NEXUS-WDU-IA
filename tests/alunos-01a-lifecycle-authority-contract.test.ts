import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mission = await readFile(new URL('../docs/roadmap/missions/ALUNOS-01A.md', import.meta.url), 'utf8');

for (const requirement of [
  'LIFECYCLE=Entrada>Preparacao>Documentos>Verificacao>Decisao>Ativacao>Aluno ativo>Registo do Aluno',
  'ENROLLMENT_AUTHORITY=SERVER',
  'ACTIVE_STUDENTS_AUTHORITY=SERVER',
  'STUDENT_RECORD_AUTHORITY=SERVER_READ_MODEL',
  'PROCESS_DRAWER=PRESERVE',
  'SCHEMA_CHANGE_EXPECTED=NO',
  'POST_ACTIVATION_WRITES=OUT_OF_SCOPE',
  'PHYSICAL_DOCUMENT_UPLOAD=OUT_OF_SCOPE',
]) assert.ok(mission.includes(requirement), `Mission authority contract must declare ${requirement}.`);

assert.match(mission, /\| (?:KEEP|REFINE|ADD|DEFER) \|/, 'Mission must freeze a KEEP | REFINE | ADD | DEFER inventory.');
assert.match(mission, /ANIMATION_CANNOT_ADVANCE_CANONICAL_STATE=YES/, 'Animation must be explicitly forbidden from advancing canonical state.');
assert.match(mission, /## Task 1 — AS-IS Lifecycle Truth and Preservation Gate/, 'Mission must retain Task 1 evidence.');

console.log('[ALUNOS-01A] Task 1 lifecycle authority governance: PASS.');
