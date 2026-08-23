import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const initSource = await readFile(new URL('../src/db/init.ts', import.meta.url), 'utf8');
const serverSource = await readFile(new URL('../server.ts', import.meta.url), 'utf8');

test('T01: persistent initialization failures must propagate to startup', () => {
  assert.match(
    initSource,
    /catch\s*\(error\)\s*\{[\s\S]*?console\.error[\s\S]*?throw\s+error;/,
    'initializeDatabase must rethrow a persistent initialization failure',
  );
});

test('T02: readiness must not be announced after database initialization', () => {
  assert.doesNotMatch(
    serverSource,
    /await\s+initializeDatabase\(\);[\s\S]{0,200}Base de dados pronta para uso operacional\./,
    'startup must not announce operational database readiness after initializeDatabase returns',
  );
});
