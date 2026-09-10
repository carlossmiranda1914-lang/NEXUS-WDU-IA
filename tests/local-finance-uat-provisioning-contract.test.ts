import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../scripts/provision-local-finance-uat.ts', import.meta.url), 'utf8');

for (const required of [
  "target.host !== '127.0.0.1'",
  "target.port !== '54329'",
  "primary_jurisdiction === 'NEXUS_TEST'",
  "'NEXUS_TEST'",
  "'000-UAT-REC'",
  "'000-UAT-CN'",
  "UAT-F7-RECEIPT-SOURCE",
  'ensureReceiptEligiblePayment',
]) assert.ok(source.includes(required), `Missing local Finance UAT documentary fixture invariant: ${required}`);

assert.match(source, /adapter_key[\s\S]{0,260}'core'/, 'The UAT fiscal configuration must bind the synthetic core adapter.');
assert.equal(source.includes("'PT', 'EUR', 'Europe/Lisbon', 'local-uat-v1'"), false, 'The disposable UAT fixture must not claim a real-country fiscal profile.');
console.log('Local Finance UAT provisioning contract: PASS.');
