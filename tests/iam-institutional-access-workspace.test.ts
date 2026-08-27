import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/InstitutionalAccessWorkspace.tsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

const required = [
  'Acessos institucionais',
  'Gerir quem pode aceder a esta instituição e com que papel.',
  "listInstitutionMemberships(token, { status, role, cursor: pageCursor ?? undefined, limit: PAGE_SIZE })",
  'setCursor(null);',
  'page.nextCursor',
  'Carregar mais',
  'A carregar acessos institucionais',
  'Ainda não existem acessos institucionais.',
  'Não existem acessos com os filtros selecionados.',
  'Operação institucional não autorizada.',
  'Tentar novamente',
  'aria-label="Filtrar por papel institucional"',
  'aria-label="Filtrar por estado"',
  '<table',
  'Pessoa',
  'Papel institucional',
  'Estado',
  'md:hidden',
  'md:block',
  'role="alert"',
  'role="status"',
  'changeInstitutionMembershipRole',
  'revokeInstitutionMembership',
  "expectedVersion: selected.version",
  'idempotencyKey: key',
  'Alterar papel',
  'Revogar acesso',
  'Não é possível remover o último administrador ativo desta instituição.',
  'VERSION_CONFLICT',
  'refreshAuthoritatively',
  'aria-modal="true"',
  'A Person, a Identity e o histórico não serão apagados.',
  "bg-gradient-to-br from-white via-indigo-50 to-cyan-50",
  "bg-indigo-50 text-slate-700",
  "const workspacePadding = light ? 'p-5 sm:p-[26px]' : 'p-4 sm:p-6';",
  '${workspacePadding}',
];
for (const token of required) assert.ok(source.includes(token), `Missing required workspace contract: ${token}`);

for (const forbidden of ['person.id', 'email', 'uid', 'institutionId', 'Platform Admin', 'users.role', 'deletePerson', 'deleteIdentity', 'localStorage']) {
  assert.equal(source.includes(forbidden), false, `Forbidden client authority or PII reference: ${forbidden}`);
}

assert.ok(app.includes("const InstitutionalAccessWorkspace = lazy(() => import('./components/InstitutionalAccessWorkspace'));"));
assert.ok(app.includes("<InstitutionalAccessWorkspace theme={theme} />"));
assert.ok(app.includes("id: 'institutional-access'"));
assert.ok(app.includes("'institutional-access'"));

console.log('IAM institutional access workspace tests passed.');
