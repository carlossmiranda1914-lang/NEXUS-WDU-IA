import { auth } from '../../lib/firebase.ts';

export type EnrollmentStudentDraft = {
  name: string;
  birthDate?: string;
  phone?: string;
  studentNumber?: string;
  legacyStudentId?: string;
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

export function startProtectedEnrollment(offerId: string, student: EnrollmentStudentDraft) {
  const idempotencyKey = globalThis.crypto?.randomUUID?.() || `enrollment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return request('/api/enrollments/intake', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ offerId, student }),
  });
}
