export type EnrollmentResolutionStatus =
  | 'NO_MATCH'
  | 'LOCAL_MATCH'
  | 'REUSABLE_MATCH'
  | 'RESTRICTED_POSSIBLE_MATCH'
  | 'MULTIPLE_MATCHES'
  | 'REVIEW_REQUIRED';

export type EnrollmentResolution = {
  status: EnrollmentResolutionStatus;
  candidateCount: number;
  candidatePersonId?: string;
  matchReasons?: string[];
  localCandidates?: Array<{ personId: string; name: string; birthDate: string | null }>;
};

export type EnrollmentResolutionUi = {
  tone: 'neutral' | 'success' | 'warning';
  title: string;
  description: string;
  canStart: boolean;
  requiresReview: boolean;
  showLocalCandidates: boolean;
};

export function enrollmentResolutionUi(resolution: EnrollmentResolution): EnrollmentResolutionUi {
  switch (resolution.status) {
    case 'NO_MATCH':
      return {
        tone: 'success',
        title: 'Não encontrámos um registo correspondente',
        description: 'Os dados fornecidos podem seguir como uma nova pessoa. O sistema volta a validar antes de criar a matrícula.',
        canStart: true,
        requiresReview: false,
        showLocalCandidates: false,
      };
    case 'LOCAL_MATCH':
      return {
        tone: 'success',
        title: 'Registo existente nesta escola',
        description: 'A matrícula pode continuar usando o registo institucional já existente, sem criar uma pessoa duplicada.',
        canStart: true,
        requiresReview: false,
        showLocalCandidates: false,
      };
    case 'RESTRICTED_POSSIBLE_MATCH':
      return {
        tone: 'warning',
        title: 'É necessária confirmação antes de continuar',
        description: 'Existe um possível registo que não pode ser apresentado aqui. Encaminhe o caso para confirmação autorizada; nenhuma origem ou dado protegido será mostrado.',
        canStart: false,
        requiresReview: true,
        showLocalCandidates: false,
      };
    case 'MULTIPLE_MATCHES':
      return {
        tone: 'warning',
        title: 'Há mais de um registo possível',
        description: 'Confirme cuidadosamente qual registo desta escola corresponde ao aluno. O Nexus não escolhe automaticamente em caso de dúvida.',
        canStart: false,
        requiresReview: true,
        showLocalCandidates: Boolean(resolution.localCandidates?.length),
      };
    case 'REVIEW_REQUIRED':
      return {
        tone: 'warning',
        title: 'Precisamos confirmar a identidade',
        description: 'Os dados ainda não permitem uma decisão segura. Reveja a informação ou encaminhe uma decisão autorizada antes de iniciar a matrícula.',
        canStart: false,
        requiresReview: true,
        showLocalCandidates: Boolean(resolution.localCandidates?.length),
      };
    case 'REUSABLE_MATCH':
      return {
        tone: 'warning',
        title: 'Existe um possível registo reutilizável',
        description: 'A reutilização exige confirmação autorizada antes de continuar. A interface não usa o identificador global como prova de acesso.',
        canStart: false,
        requiresReview: true,
        showLocalCandidates: false,
      };
  }
}

export function createEnrollmentIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `enrollment-ui:${crypto.randomUUID()}`;
  }
  return `enrollment-ui:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}
