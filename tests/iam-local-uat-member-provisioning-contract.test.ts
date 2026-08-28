import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../scripts/provision-local-iam-uat-member.ts', import.meta.url), 'utf8');
for (const required of ['readApprovedTestTarget', "target.host !== '127.0.0.1'", "target.port !== '54329'", 'grantInstitutionAccess', 'institution_admin', 'nexus-local-iam-uat', 'TESTE — Membro IAM UAT']) assert.ok(source.includes(required), `Missing safe member provisioning contract: ${required}`);
for (const forbidden of ['INSERT INTO memberships', 'UPDATE memberships', 'users.role', "app.post('/api/iam/bootstrap'"]) assert.equal(source.includes(forbidden), false, `Forbidden authority bypass: ${forbidden}`);
console.log('IAM local UAT member provisioning contract tests passed.');
