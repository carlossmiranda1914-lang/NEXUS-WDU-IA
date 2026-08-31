import type { EnrollmentOperationalRecord } from './enrollment-operations-model.ts';
import type { EnrollmentProcessProjection, EnrollmentProcessStageKey } from './enrollment-process-policy.ts';

export type EnrollmentJourneyProcessProjection = EnrollmentProcessProjection & {
  enrollmentId: string;
  enrollmentStatus: EnrollmentOperationalRecord['status'];
};

export type EnrollmentLifecycleStep = {
  key: 'entry' | 'preparation' | 'documents' | 'verification' | 'decision' | 'activation' | 'active_student';
  label: string;
  count: number;
  tone: 'neutral' | 'info' | 'attention' | 'success';
  selectedView: 'entries' | 'enrollments' | 'students';
  source: 'enrollment' | 'active-students';
  enrollmentIds: string[];
  statuses: EnrollmentOperationalRecord['status'][];
};

type EnrollmentJourneyStage = Exclude<EnrollmentLifecycleStep['key'], 'active_student'>;

const JOURNEY_STAGE_BY_PROCESS_STAGE: Record<EnrollmentProcessStageKey, EnrollmentJourneyStage> = {
  P01: 'entry',
  P02: 'preparation',
  P03: 'preparation',
  P04: 'documents',
  P05: 'verification',
  P06: 'decision',
};

const HUMAN_LABEL_BY_JOURNEY_STAGE: Record<EnrollmentJourneyStage, string> = {
  entry: 'Entrada',
  preparation: 'Preparação',
  documents: 'Documentos',
  verification: 'Verificação',
  decision: 'Decisão',
  activation: 'Ativação',
};

export function getEnrollmentJourneyLabel(
  process: Pick<EnrollmentJourneyProcessProjection, 'currentStage' | 'enrollmentStatus'>,
): string;
export function getEnrollmentJourneyLabel(
  process: Pick<EnrollmentJourneyProcessProjection, 'enrollmentStatus'> & { currentStage: string },
): string | null;
export function getEnrollmentJourneyLabel(
  process: (Pick<EnrollmentJourneyProcessProjection, 'currentStage' | 'enrollmentStatus'> | (Pick<EnrollmentJourneyProcessProjection, 'enrollmentStatus'> & { currentStage: string })),
): string | null {
  const stage = process.enrollmentStatus === 'active'
    ? 'activation'
    : JOURNEY_STAGE_BY_PROCESS_STAGE[process.currentStage as EnrollmentProcessStageKey];
  return stage ? HUMAN_LABEL_BY_JOURNEY_STAGE[stage] : null;
}

function hasCanonicalProcessProjection(value: EnrollmentJourneyProcessProjection | EnrollmentOperationalRecord): value is EnrollmentJourneyProcessProjection {
  return 'currentStage' in value && 'stages' in value && 'progress' in value && 'blockers' in value && 'nextAction' in value;
}

function enrollmentIdsFor(processes: readonly EnrollmentJourneyProcessProjection[], stage: EnrollmentJourneyStage): string[] {
  return processes
    .filter((process) => (process.enrollmentStatus === 'active' ? 'activation' : JOURNEY_STAGE_BY_PROCESS_STAGE[process.currentStage]) === stage)
    .map((process) => process.enrollmentId);
}

/**
 * Compatibility presentation for the Journey Rail. Enrollment lifecycle
 * membership is derived exclusively from canonical server process projections.
 * Operational list rows remain accepted only while Tasks 2–3 rewire the caller;
 * without a process projection they deliberately produce no process authority.
 */
export function buildEnrollmentLifecyclePresentation(
  inputs: readonly EnrollmentJourneyProcessProjection[] | readonly EnrollmentOperationalRecord[],
  activeStudentCount: number,
): EnrollmentLifecycleStep[] {
  const processes = inputs.filter(hasCanonicalProcessProjection);
  const step = (key: EnrollmentJourneyStage, label: string, tone: EnrollmentLifecycleStep['tone'], selectedView: EnrollmentLifecycleStep['selectedView']): EnrollmentLifecycleStep => {
    const enrollmentIds = enrollmentIdsFor(processes, key);
    return { key, label, count: enrollmentIds.length, tone, selectedView, source: 'enrollment', enrollmentIds, statuses: [] };
  };

  return [
    step('entry', HUMAN_LABEL_BY_JOURNEY_STAGE.entry, 'info', 'entries'),
    step('preparation', HUMAN_LABEL_BY_JOURNEY_STAGE.preparation, 'neutral', 'enrollments'),
    step('documents', HUMAN_LABEL_BY_JOURNEY_STAGE.documents, 'attention', 'enrollments'),
    step('verification', HUMAN_LABEL_BY_JOURNEY_STAGE.verification, 'info', 'enrollments'),
    step('decision', HUMAN_LABEL_BY_JOURNEY_STAGE.decision, 'success', 'enrollments'),
    step('activation', HUMAN_LABEL_BY_JOURNEY_STAGE.activation, 'success', 'enrollments'),
    { key: 'active_student', label: 'Aluno ativo', count: activeStudentCount, tone: 'success', selectedView: 'students', source: 'active-students', enrollmentIds: [], statuses: [] },
  ];
}
