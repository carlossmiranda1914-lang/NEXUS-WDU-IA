import assert from 'node:assert/strict';
import { profileAccessError } from '../src/auth/profile-access-error.ts';

assert.equal(
  profileAccessError(403),
  'A sua autenticação foi validada, mas ainda não possui uma associação institucional ativa.',
);
assert.equal(profileAccessError(401), 'A sua sessão terminou. Inicie sessão novamente.');
assert.equal(profileAccessError(500), 'Não foi possível validar o acesso institucional neste momento.');
console.log('Auth profile access error classification: PASS.');
