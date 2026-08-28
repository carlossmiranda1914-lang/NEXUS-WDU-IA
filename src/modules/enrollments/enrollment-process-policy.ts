import type { InstitutionalRole } from '../../auth/institutional-context.ts';
import type { EnrollmentStatus } from './enrollment-policy.ts';
import { documentValidationGate, type CapturedDocumentRequirement } from './enrollment-document-requirement-policy.ts';

export const ENROLLMENT_PROCESS_STAGE_KEYS = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'] as const;
export type EnrollmentProcessStageKey = (typeof ENROLLMENT_PROCESS_STAGE_KEYS)[number];

export function canAssignEnrollmentProcess(role: InstitutionalRole): boolean {
  return role === 'institution_admin' || role === 'director' || role === 'secretariat';
}

export function canReceiveEnrollmentProcessAssignment(role: InstitutionalRole): boolean {
  return role === 'institution_admin' || role === 'director' || role === 'secretariat';
}
export type EnrollmentProcessStageStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'not_applicable';
export type EnrollmentProcessNextActionCode =
  | 'COMPLETE_REGISTRATION'
  | 'ADD_GUARDIAN_DATA'
  | 'SUBMIT_REQUIRED_DOCUMENTS'
  | 'VERIFY_REQUIRED_DOCUMENTS'
  | 'RESUME_REVIEW'
  | 'VALIDATE_ENROLLMENT'
  | 'RESOLVE_BLOCKER';

export interface EnrollmentProcessTruth {
  enrollmentStatus: EnrollmentStatus;
  registrationReady: boolean;
  registrationMissing: string[];
  academicContextValid: boolean;
  policyCaptured: boolean;
  documents: CapturedDocumentRequirement[];
}

export interface EnrollmentProcessAction {
  code: EnrollmentProcessNextActionCode;
  label: string;
  available: boolean;
  unavailableReason: string | null;
}

export interface EnrollmentProcessStage {
  key: EnrollmentProcessStageKey;
  label: string;
  status: EnrollmentProcessStageStatus;
  reasonCode: string | null;
  nextAction: EnrollmentProcessAction | null;
  evidence: { summary: string; source: string };
}

export interface EnrollmentProcessProjection {
  currentStage: EnrollmentProcessStageKey;
  progress: { completed: number; applicable: number; percent: number };
  stages: EnrollmentProcessStage[];
  nextAction: EnrollmentProcessAction | null;
  blockers: Array<{ reasonCode: string; message: string; stage: EnrollmentProcessStageKey }>;
}

const LABELS: Record<EnrollmentProcessStageKey, string> = {
  P01: 'Entrada / identidade',
  P02: 'Dados e relações',
  P03: 'Oferta e contexto académico',
  P04: 'Requisitos e documentos',
  P05: 'Revisão',
  P06: 'Pronto para decisão',
};

function action(code: EnrollmentProcessNextActionCode, role: InstitutionalRole, available = true, reason: string | null = null): EnrollmentProcessAction {
  const labels: Record<EnrollmentProcessNextActionCode, string> = {
    COMPLETE_REGISTRATION: 'Completar dados do aluno e responsável',
    ADD_GUARDIAN_DATA: 'Adicionar dados do responsável',
    SUBMIT_REQUIRED_DOCUMENTS: 'Submeter documentos obrigatórios',
    VERIFY_REQUIRED_DOCUMENTS: 'Verificar documentos submetidos',
    RESUME_REVIEW: 'Retomar revisão da matrícula',
    VALIDATE_ENROLLMENT: 'Validar matrícula',
    RESOLVE_BLOCKER: 'Resolver bloqueio',
  };
  const canManage = role === 'institution_admin' || role === 'director' || role === 'secretariat';
  return { code, label: labels[code], available: available && canManage, unavailableReason: canManage ? reason : 'O seu papel não autoriza esta ação.' };
}

function stage(key: EnrollmentProcessStageKey, status: EnrollmentProcessStageStatus, reasonCode: string | null, nextAction: EnrollmentProcessAction | null, summary: string, source: string): EnrollmentProcessStage {
  return { key, label: LABELS[key], status, reasonCode, nextAction, evidence: { summary, source } };
}

export function projectEnrollmentProcess(truth: EnrollmentProcessTruth, role: InstitutionalRole): EnrollmentProcessProjection {
  const terminalComplete = truth.enrollmentStatus === 'validated' || truth.enrollmentStatus === 'active';
  const cancelled = truth.enrollmentStatus === 'cancelled';
  const enrollmentBlocked = truth.enrollmentStatus === 'blocked';
  const documentGate = documentValidationGate(truth.policyCaptured, truth.documents);
  const missingGuardian = truth.registrationMissing.some((item) => item === 'guardian' || item.startsWith('guardian.'));
  const registrationAction = action(missingGuardian ? 'ADD_GUARDIAN_DATA' : 'COMPLETE_REGISTRATION', role);
  const registrationDone = truth.registrationReady;
  const contextDone = truth.academicContextValid;
  // A persisted validated/active lifecycle is terminal historical evidence for S03.
  // Before that terminal transition, readiness must remain strictly fail-closed.
  const documentsDone = terminalComplete || documentGate.ready;
  const prerequisitesDone = registrationDone && contextDone && documentsDone;

  let documentAction: EnrollmentProcessAction | null = null;
  let documentReason: string | null = null;
  if (documentGate.reason === 'POLICY_NOT_CAPTURED') {
    documentReason = 'DOCUMENT_POLICY_NOT_CAPTURED';
    documentAction = action('RESOLVE_BLOCKER', role, false, 'A política documental deve ser configurada pela Direção ou Administração.');
  } else if (documentGate.reason === 'REQUIREMENTS_NOT_CONFIGURED') {
    documentReason = 'DOCUMENT_REQUIREMENTS_NOT_CONFIGURED';
    documentAction = action('RESOLVE_BLOCKER', role, false, 'Ainda não existe evidência de requisitos documentais configurados para esta matrícula.');
  } else if (documentGate.reason === 'REQUIRED_DOCUMENTS_UNVERIFIED') {
    documentReason = 'REQUIRED_DOCUMENTS_UNVERIFIED';
    documentAction = action('VERIFY_REQUIRED_DOCUMENTS', role);
  } else if (documentGate.reason === 'REQUIRED_DOCUMENTS_PENDING') {
    documentReason = 'REQUIRED_DOCUMENTS_PENDING';
    documentAction = action('SUBMIT_REQUIRED_DOCUMENTS', role);
  }

  const reviewAction = truth.enrollmentStatus === 'under_review'
    ? action('VALIDATE_ENROLLMENT', role)
    : action('RESUME_REVIEW', role);

  const stages: EnrollmentProcessStage[] = [
    stage('P01', 'completed', null, null, 'Identidade resolvida e matrícula criada pelo intake institucional.', 'enrollment_applications'),
    stage('P02', registrationDone ? 'completed' : cancelled ? 'pending' : 'blocked', registrationDone ? null : 'REGISTRATION_INCOMPLETE', registrationDone || cancelled ? null : registrationAction, registrationDone ? 'Cadastro obrigatório e relação responsável confirmados.' : `${truth.registrationMissing.length} requisito(s) obrigatório(s) em falta.`, 'registration_profile'),
    stage('P03', contextDone ? 'completed' : cancelled ? 'pending' : 'blocked', contextDone ? null : 'ACADEMIC_CONTEXT_INVALID', contextDone || cancelled ? null : action('RESOLVE_BLOCKER', role, false, 'A oferta e o ano letivo devem pertencer à instituição e estar válidos.'), contextDone ? 'Oferta e ano letivo institucionais válidos.' : 'Oferta ou ano letivo inválido para esta instituição.', 'academic_years/enrollment_offers'),
    stage('P04', documentsDone ? 'completed' : cancelled || !registrationDone || !contextDone ? 'pending' : 'blocked', documentsDone ? null : documentReason, documentsDone || cancelled || !registrationDone || !contextDone ? null : documentAction, documentsDone ? 'A configuração documental foi capturada e todos os documentos obrigatórios estão verificados.' : documentGate.reason === 'POLICY_NOT_CAPTURED' ? 'A política documental ainda não foi capturada para esta matrícula.' : documentGate.reason === 'REQUIREMENTS_NOT_CONFIGURED' ? 'Ainda não há requisitos documentais materializados; a matrícula não pode seguir para decisão.' : documentGate.reason === 'REQUIRED_DOCUMENTS_UNVERIFIED' ? `${documentGate.submittedCount} documento(s) obrigatório(s) aguardam verificação.` : `${documentGate.pendingCount} documento(s) obrigatório(s) por resolver.`, 'enrollment_documents'),
    stage('P05', prerequisitesDone ? 'completed' : cancelled ? 'pending' : 'pending', null, prerequisitesDone && !terminalComplete && !cancelled ? reviewAction : null, prerequisitesDone ? 'Readiness técnico confirmado pelos gates de cadastro e documentos.' : 'A revisão aguarda a conclusão das etapas anteriores.', 'registration/document gates'),
    stage('P06', terminalComplete ? 'completed' : cancelled || enrollmentBlocked ? 'blocked' : prerequisitesDone ? 'in_progress' : 'pending', terminalComplete ? null : cancelled ? 'ENROLLMENT_CANCELLED' : enrollmentBlocked ? 'ENROLLMENT_BLOCKED' : null, terminalComplete || cancelled ? null : enrollmentBlocked ? action('RESOLVE_BLOCKER', role) : prerequisitesDone ? reviewAction : null, terminalComplete ? 'Matrícula validada; o processo S03 está concluído.' : cancelled ? 'Matrícula cancelada; a progressão está encerrada.' : prerequisitesDone ? 'Pré-condições satisfeitas para decisão.' : 'Ainda existem pré-condições por concluir.', 'enrollment lifecycle'),
  ];

  const blockers = stages
    .filter((item) => item.status === 'blocked' && item.reasonCode)
    .map((item) => ({ reasonCode: item.reasonCode!, message: item.evidence.summary, stage: item.key }));
  const current = terminalComplete || cancelled || enrollmentBlocked
    ? stages[5]
    : stages.find((item) => item.status !== 'completed' && item.status !== 'not_applicable') ?? stages[5];
  const applicable = stages.filter((item) => item.status !== 'not_applicable').length;
  const completed = stages.filter((item) => item.status === 'completed').length;
  return {
    currentStage: current.key,
    progress: { completed, applicable, percent: Math.round((completed / applicable) * 100) },
    stages,
    nextAction: current.nextAction ?? stages.find((item) => item.nextAction)?.nextAction ?? null,
    blockers,
  };
}
