import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../scripts/nexus-uat-start.mjs', import.meta.url), 'utf8');

assert.equal(
  source.includes("NEXUS_SERVER_MANAGED_STARTUP:  'true'"),
  false,
  'The UAT harness child must allow server.ts to invoke startServer().',
);

console.log('Nexus UAT start contract: PASS.');
