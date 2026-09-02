import { auth } from '../../lib/firebase.ts';

export type EnrollmentStudentDraft = {
  name: string;
  birthDate?: string;
  phone?: string;
  studentNumber?: string;
  legacyStudentId?: string;
};

export type PublicIdentityDecision = {
  decisionRef: string;
  status: 'pending_confirmation' | 'pending_second_approval' | 'needs_more_information' | 'approved' | 'rejected';
  riskLevel: 'B' | 'C';
  proposedAction: 'REUSE_PERSON' | 'CREATE_PERSON' | 'REVIEW_REQUIRED';
  reasonCode: string;
  version: number;
  capabilities?: {
    canRequestMoreInformation: boolean;
    canApprove: boolean;
    canReject: boolean;
    canSubmitEvidence: boolean;
    canResumeIntake: boolean;
  };
};

async function request(path: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Inicie sessão para aceder à área de matrículas.');
  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.');
  return body;
}

export function resolveExistingStudent(student: EnrollmentStudentDraft) {
  return request('/api/enrollments/person-resolution', {
    method: 'POST',
    body: JSON.stringify({ student }),
  });
}

export function startProtectedEnrollment(offerId: string, student: EnrollmentStudentDraft, decisionRef?: string) {
  const idempotencyKey = globalThis.crypto?.randomUUID?.() || `enrollment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return request('/api/enrollments/intake', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ offerId, student, ...(decisionRef ? { decisionRef } : {}) }),
  });
}

/**
 * Resume a reviewed intake from the server's current canonical binding.
 * The browser deliberately supplies no offer, identity inputs, case key, or
 * Person reference for this path.
 */
export function resumeApprovedIdentityReview(decisionRef: string) {
  const idempotencyKey = globalThis.crypto?.randomUUID?.() || `identity-review-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return request(`/api/enrollments/identity-decisions/${decisionRef}/intake`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({}),
  });
}

export async function requestIdentityReview(offerId: string, student: EnrollmentStudentDraft): Promise<{ decision: PublicIdentityDecision }> {
  return request('/api/enrollments/identity-decisions', {
    method: 'POST',
    body: JSON.stringify({ offerId, student, proposedAction: 'REVIEW_REQUIRED', evidenceTypes: ['manual_interview'] }),
  });
}

/** The server decides whether this session may see the institution queue. */
export async function listIdentityReviewQueue(): Promise<{ decisions: PublicIdentityDecision[] }> {
  return request('/api/enrollments/identity-decisions');
}

/** Recover one decision only through its opaque public handle. */
export async function getIdentityReviewDecision(decisionRef: string): Promise<{ decision: PublicIdentityDecision }> {
  return request(`/api/enrollments/identity-decisions/${decisionRef}`);
}

export async function submitIdentityReviewEvidence(decisionRef: string, expectedVersion: number, student: EnrollmentStudentDraft, evidenceTypes: string[]): Promise<{ decision: PublicIdentityDecision }> {
  return request(`/api/enrollments/identity-decisions/${decisionRef}/evidence`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion, student, evidenceTypes }),
  });
}

export async function submitIdentityReviewOutcome(decisionRef: string, outcome: 'approve' | 'reject' | 'request_more_information'): Promise<{ decision: PublicIdentityDecision }> {
  return request(`/api/enrollments/identity-decisions/${decisionRef}/outcome`, {
    method: 'POST',
    body: JSON.stringify({ outcome }),
  });
}
