import type { EnrollmentOperationalRecord } from './enrollment-operations-model.ts';

export type EnrollmentLifecycleStep = {
  key: 'entry' | 'preparation' | 'documents' | 'verification' | 'decision' | 'activation' | 'active_student';
  label: string;
  count: number;
  tone: 'neutral' | 'info' | 'attention' | 'success';
  selectedView: 'entries' | 'enrollments' | 'students';
  source: 'enrollment' | 'active-students';
  statuses: EnrollmentOperationalRecord['status'][];
};

const count = (records: EnrollmentOperationalRecord[], status: EnrollmentOperationalRecord['status']) =>
  records.filter((record) => record.status === status).length;

/**
 * Presents the existing, server-owned enrollment facts in one human journey.
 * It deliberately does not manufacture a preparation queue: the operational
 * list has no canonical preparation-stage field. A confirmed active enrollment
 * remains factual activation evidence, while active students come only from
 * their distinct institutional projection.
 */
export function buildEnrollmentLifecyclePresentation(
  records: EnrollmentOperationalRecord[],
  activeStudentCount: number,
): EnrollmentLifecycleStep[] {
  return [
    { key: 'entry', label: 'Entrada', count: count(records, 'draft'), tone: 'info', selectedView: 'entries', source: 'enrollment', statuses: ['draft'] },
    { key: 'preparation', label: 'Preparação', count: 0, tone: 'neutral', selectedView: 'enrollments', source: 'enrollment', statuses: [] },
    { key: 'documents', label: 'Documentos', count: count(records, 'awaiting_documents'), tone: 'attention', selectedView: 'enrollments', source: 'enrollment', statuses: ['awaiting_documents'] },
    { key: 'verification', label: 'Verificação', count: count(records, 'under_review'), tone: 'info', selectedView: 'enrollments', source: 'enrollment', statuses: ['under_review'] },
    { key: 'decision', label: 'Decisão', count: count(records, 'validated'), tone: 'success', selectedView: 'enrollments', source: 'enrollment', statuses: ['validated'] },
    { key: 'activation', label: 'Ativação', count: count(records, 'active'), tone: 'success', selectedView: 'enrollments', source: 'enrollment', statuses: ['active'] },
    { key: 'active_student', label: 'Aluno ativo', count: activeStudentCount, tone: 'success', selectedView: 'students', source: 'active-students', statuses: [] },
  ];
}
