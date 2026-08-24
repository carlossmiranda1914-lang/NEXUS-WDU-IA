import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { resolveDatabaseRuntimePolicy } from '../src/db/database-runtime-policy.ts';

assert.deepEqual(
  resolveDatabaseRuntimePolicy({ NODE_ENV: 'production', ALLOW_IN_MEMORY_FALLBACK: 'true' }),
  { isPersistentDatabaseConfigured: false, isInMemoryFallbackAllowed: false },
  'Production must fail closed without PostgreSQL even when a local fallback flag is present.',
);
assert.deepEqual(
  resolveDatabaseRuntimePolicy({ NODE_ENV: 'development', SQL_HOST: 'localhost', ALLOW_IN_MEMORY_FALLBACK: 'true' }),
  { isPersistentDatabaseConfigured: true, isInMemoryFallbackAllowed: false },
  'A persistent configuration must never silently use memory fallback.',
);
assert.deepEqual(
  resolveDatabaseRuntimePolicy({ NODE_ENV: 'development', ALLOW_IN_MEMORY_FALLBACK: 'true' }),
  { isPersistentDatabaseConfigured: false, isInMemoryFallbackAllowed: true },
  'Only explicit local development may use memory fallback.',
);

const server = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
const initialization = server.indexOf('await initializeDatabase();');
const readiness = server.indexOf('[SERVER] Servidor iniciado. Base de dados pronta para uso operacional.');
const listener = server.indexOf('server.listen(');
assert(initialization >= 0 && initialization < readiness && readiness < listener, 'Server readiness/listener must remain after awaited database initialization.');
console.log('[FND-01-CP5] PASS: production fallback is fail-closed and startup gates readiness behind initialization.');
