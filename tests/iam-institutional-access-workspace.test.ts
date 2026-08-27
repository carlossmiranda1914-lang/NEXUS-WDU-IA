import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/InstitutionalAccessWorkspace.tsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

const required = [
  'Acessos institucionais',
  'Gerir quem pode aceder a esta instituição e com que papel.',
  "listInstitutionMemberships(token, { status, role, cursor, limit: PAGE_SIZE })",
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
];
for (const token of required) assert.ok(source.includes(token), `Missing required workspace contract: ${token}`);

for (const forbidden of ['person.id', 'email', 'uid', 'institutionId', "method: 'POST'", "method: 'PATCH'", "method: 'PUT'", "method: 'DELETE'"]) {
  assert.equal(source.includes(forbidden), false, `Forbidden client authority or PII reference: ${forbidden}`);
}

assert.ok(app.includes("const InstitutionalAccessWorkspace = lazy(() => import('./components/InstitutionalAccessWorkspace'));"));
assert.ok(app.includes("<InstitutionalAccessWorkspace theme={theme} />"));
assert.ok(app.includes("id: 'institutional-access'"));
assert.ok(app.includes("'institutional-access'"));

console.log('IAM institutional access workspace tests passed.');
