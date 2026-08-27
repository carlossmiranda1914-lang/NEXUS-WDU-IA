import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../scripts/provision-local-iam-uat.ts', import.meta.url), 'utf8');

for (const required of [
  'readApprovedTestTarget',
  "target.host !== '127.0.0.1'",
  "target.port !== '54329'",
  'BootstrapInstitutionAdmin',
  'bootstrapInstitutionAdmin',
  "system:local-iam-uat-bootstrap",
  "'active'",
  'nexus-local-iam-uat',
  "provider = 'firebase'",
  'IAM_INSTITUTION_ADMIN_BOOTSTRAPPED',
]) assert.ok(source.includes(required), `Missing local UAT safety contract: ${required}`);

for (const forbidden of [
  'INSERT INTO memberships',
  'UPDATE memberships',
  'users.role',
  "app.post('/api/iam/bootstrap'",
]) assert.equal(source.includes(forbidden), false, `Forbidden local UAT authority bypass: ${forbidden}`);

console.log('IAM local UAT provisioning contract tests passed.');
