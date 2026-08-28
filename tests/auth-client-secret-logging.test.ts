import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

for (const forbidden of [
  "'[DEBUG-AUTH-FLOW] UID:'",
  "'[DEBUG-AUTH-FLOW] EMAIL:'",
  "'[DEBUG-AUTH-FLOW] TOKEN GERADO:'",
  "'Authorization Header:'",
]) assert.equal(source.includes(forbidden), false, `Authentication secret or identifier logging must not return: ${forbidden}`);

console.log('Authentication client secret logging tests passed.');
