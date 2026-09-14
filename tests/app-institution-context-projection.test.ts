import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const app = readFileSync(resolve('src/App.tsx'), 'utf8');

assert.match(
  app,
  /const \[currentInstitutionReference, setCurrentInstitutionReference\] = useState<string \| null>\(null\);/,
  'App must keep the institution reference returned by the authenticated profile authority.',
);
assert.match(
  app,
  /const context = projectInstitutionalContext\(profile\);/,
  'App must validate the server profile through the canonical institutional projection.',
);
assert.match(
  app,
  /setCurrentInstitutionReference\(context\.institutionReference\);/,
  'App must project the server-derived institution reference after profile resolution.',
);
assert.match(
  app,
  /Tenant: \{currentInstitutionReference \?\? 'Contexto institucional autorizado'\}/,
  'App must render the server-derived institution reference rather than a fabricated tenant label.',
);
assert.equal(
  app.includes('Tenant: lisboa_central_01'),
  false,
  'App must not display a hard-coded tenant that can contradict the authenticated context.',
);

console.log('app-institution-context-projection: PASS');
