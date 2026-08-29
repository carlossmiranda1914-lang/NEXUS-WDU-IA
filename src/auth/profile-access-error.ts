export function profileAccessError(status: number): string {
  if (status === 403) return 'A sua autenticação foi validada, mas ainda não possui uma associação institucional ativa.';
  if (status === 401) return 'A sua sessão terminou. Inicie sessão novamente.';
  return 'Não foi possível validar o acesso institucional neste momento.';
}
