import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('server module awaits persistent startup before its importer can exit', () => {
  const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(source, /export async function startServer\(/);
  assert.match(source, /NEXUS_SERVER_MANAGED_STARTUP/);
});
