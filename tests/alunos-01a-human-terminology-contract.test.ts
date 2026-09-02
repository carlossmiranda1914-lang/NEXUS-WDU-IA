import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getEnrollmentJourneyLabel,
  type EnrollmentJourneyProcessProjection,
} from '../src/modules/enrollments/enrollment-lifecycle-presentation.ts';

const workspace = await readFile(new URL('../src/components/EnrollmentOperationsWorkspace.tsx', import.meta.url), 'utf8');

const process = (
  currentStage: EnrollmentJourneyProcessProjection['currentStage'],
  enrollmentStatus: EnrollmentJourneyProcessProjection['enrollmentStatus'] = 'under_review',
): EnrollmentJourneyProcessProjection => ({
  enrollmentId: `process-${currentStage}-${enrollmentStatus}`,
  enrollmentStatus,
  currentStage,
  progress: { completed: 0, applicable: 6, percent: 0 },
  stages: [],
  blockers: [],
  nextAction: null,
});

assert.deepEqual([
  getEnrollmentJourneyLabel(process('P01')),
  getEnrollmentJourneyLabel(process('P02')),
  getEnrollmentJourneyLabel(process('P04')),
  getEnrollmentJourneyLabel(process('P05')),
  getEnrollmentJourneyLabel(process('P06')),
  getEnrollmentJourneyLabel(process('P06', 'active')),
  'Aluno ativo',
], [
  'Entrada',
  'Preparação',
  'Documentos',
  'Verificação',
  'Decisão',
  'Ativação',
  'Aluno ativo',
], 'Canonical process facts must have one approved human vocabulary.');

assert.match(workspace, /getEnrollmentJourneyLabel\(process\)/, 'The selected-process drawer must use the same human terminology mapper as the Journey.');
assert.doesNotMatch(workspace, /(?:Identificação|Financeiro)\s*(?:<|\})/, 'Legacy labels must not be presented as competing top-level Journey stages.');

console.log('[ALUNOS-01A.2] unified human terminology: PASS.');
