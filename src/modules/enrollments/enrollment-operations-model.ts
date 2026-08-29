export type EnrollmentOperationalStatus =
  | 'draft'
  | 'under_review'
  | 'awaiting_documents'
  | 'validated'
  | 'blocked'
  | 'active'
  | 'cancelled';

export type OperationalView = 'overview' | 'entries' | 'enrollments' | 'students';
export type PipelineStage = 'entry' | 'identity' | 'documents' | 'verification' | 'financial' | 'decision' | 'activation';

export interface EnrollmentOperationalRecord {
  id: string;
  student_ref: string;
  status: EnrollmentOperationalStatus;
  student_name: string;
  guardian_name: string | null;
  offer_name: string;
  academic_year_name: string;
  created_at: string;
  updated_at: string;
}

export interface OperationalMetric {
  id: 'new' | 'inProgress' | 'attention' | 'ready';
  label: string;
  value: number;
  description: string;
  filter: EnrollmentOperationalStatus[];
}

export const STATUS_LABELS: Record<EnrollmentOperationalStatus, string> = {
  draft: 'Entrada iniciada',
  under_review: 'Em verificação',
  awaiting_documents: 'Aguardar documentos',
  validated: 'Pronta para decisão',
  blocked: 'Requer atenção',
  active: 'Aluno ativo',
  cancelled: 'Cancelada',
};

export const PIPELINE: Array<{
  id: PipelineStage;
  label: string;
  statuses: EnrollmentOperationalStatus[];
  available: boolean;
}> = [
  { id: 'entry', label: 'Entrada', statuses: ['draft'], available: true },
  { id: 'identity', label: 'Identificação', statuses: [], available: false },
  { id: 'documents', label: 'Documentos', statuses: ['awaiting_documents'], available: true },
  { id: 'verification', label: 'Verificação', statuses: ['under_review'], available: true },
  { id: 'financial', label: 'Financeiro', statuses: [], available: false },
  { id: 'decision', label: 'Decisão', statuses: ['validated'], available: true },
  { id: 'activation', label: 'Ativação', statuses: ['active'], available: true },
];

export function buildOperationalMetrics(records: EnrollmentOperationalRecord[]): OperationalMetric[] {
  const count = (...statuses: EnrollmentOperationalStatus[]) => records.filter((record) => statuses.includes(record.status)).length;
  return [
    {
      id: 'new',
      label: 'Entradas novas',
      value: count('draft'),
      description: 'Processos iniciados que ainda precisam de tratamento.',
      filter: ['draft'],
    },
    {
      id: 'inProgress',
      label: 'Em andamento',
      value: count('draft', 'under_review', 'awaiting_documents', 'validated'),
      description: 'Matrículas que ainda não chegaram à ativação.',
      filter: ['draft', 'under_review', 'awaiting_documents', 'validated'],
    },
    {
      id: 'attention',
      label: 'Precisam de atenção',
      value: count('blocked', 'awaiting_documents'),
      description: 'Casos bloqueados ou dependentes de documentação.',
      filter: ['blocked', 'awaiting_documents'],
    },
    {
      id: 'ready',
      label: 'Prontas para decisão',
      value: count('validated'),
      description: 'Processos validados e preparados para a próxima decisão autorizada.',
      filter: ['validated'],
    },
  ];
}

export function pipelineCounts(records: EnrollmentOperationalRecord[]) {
  return PIPELINE.map((stage) => ({
    ...stage,
    count: stage.available
      ? records.filter((record) => stage.statuses.includes(record.status)).length
      : null,
  }));
}

export function attentionPriority(status: EnrollmentOperationalStatus): number {
  switch (status) {
    case 'blocked': return 0;
    case 'awaiting_documents': return 1;
    case 'validated': return 2;
    case 'under_review': return 3;
    case 'draft': return 4;
    default: return 5;
  }
}

export function nextAction(record: EnrollmentOperationalRecord): string {
  switch (record.status) {
    case 'draft': return 'Continuar preparação';
    case 'under_review': return 'Rever processo';
    case 'awaiting_documents': return 'Tratar documentos em falta';
    case 'validated': return 'Preparar decisão';
    case 'blocked': return 'Resolver bloqueio';
    case 'active': return 'Abrir registo do aluno';
    case 'cancelled': return 'Consultar histórico';
  }
}

export function getAttentionQueue(records: EnrollmentOperationalRecord[]) {
  return records
    .filter((record) => ['blocked', 'awaiting_documents', 'validated', 'under_review', 'draft'].includes(record.status))
    .sort((a, b) => {
      const priority = attentionPriority(a.status) - attentionPriority(b.status);
      if (priority !== 0) return priority;
      return Date.parse(a.updated_at) - Date.parse(b.updated_at);
    });
}

export function recordsForView(records: EnrollmentOperationalRecord[], view: OperationalView) {
  if (view === 'entries') return records.filter((record) => record.status === 'draft');
  if (view === 'enrollments') return records.filter((record) => !['active', 'cancelled'].includes(record.status));
  if (view === 'students') return records.filter((record) => record.status === 'active');
  return records;
}
