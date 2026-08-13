import { auth } from '../../lib/firebase.ts';

export async function enrollmentRegistrationRequest(path: string, options: RequestInit = {}) {
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
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir o cadastro da matrícula.');
  return body;
}
