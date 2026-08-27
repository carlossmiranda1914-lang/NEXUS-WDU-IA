import pg from 'pg';
import { readApprovedTestTarget } from './nexus-test-db-safety.mjs';
import { grantInstitutionAccess } from '../src/modules/iam/iam-command-service.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import type { IamCommandPool, IamTransactionClient } from '../src/modules/iam/iam-command-types.ts';

const [firebaseUid] = process.argv.slice(2);
if (!firebaseUid || !/^[A-Za-z0-9_-]{1,128}$/.test(firebaseUid)) {
  throw new Error('Usage: TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx scripts/provision-local-iam-uat-member.ts <firebase-uid>');
}
const { connectionString, target } = readApprovedTestTarget();
if (target.host !== '127.0.0.1' || target.port !== '54329') throw new Error('Local IAM UAT member provisioning is restricted to the approved disposable PostgreSQL target.');
const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
const commandPool: IamCommandPool = { connect: async () => (await pool.connect()) as unknown as IamTransactionClient };

async function provision(): Promise<void> {
  const admin = await pool.query<InstitutionalContext>(`SELECT p.id AS "personId", p.name AS "personName", i.email AS "identityEmail", m.id AS "membershipId", n.id AS "institutionId", n.name AS "institutionName", n.slug AS "institutionSlug", m.role
    FROM identities i INNER JOIN people p ON p.id = i.person_id INNER JOIN memberships m ON m.person_id = p.id INNER JOIN institutions n ON n.id = m.institution_id
    WHERE i.provider = 'firebase' AND i.provider_subject = $1 AND n.slug = 'nexus-local-iam-uat' AND m.status = 'active' AND m.role = 'institution_admin' LIMIT 1`, [firebaseUid]);
  if (!admin.rows[0]) throw new Error('The Firebase UAT identity has no active institution_admin Membership in the local UAT institution.');
  const existing = await pool.query<{ id: string }>(`SELECT m.id FROM memberships m INNER JOIN people p ON p.id = m.person_id INNER JOIN institutions n ON n.id = m.institution_id WHERE n.slug = 'nexus-local-iam-uat' AND p.name = 'TESTE — Membro IAM UAT' AND m.status = 'active' LIMIT 1`);
  if (existing.rows[0]) { console.log(JSON.stringify({ fixture: 'reused-active-test-member' })); return; }
  const person = await pool.query<{ id: string }>(`INSERT INTO people (name) VALUES ('TESTE — Membro IAM UAT') RETURNING id`);
  const result = await grantInstitutionAccess(commandPool, { context: admin.rows[0], target: { personId: person.rows[0].id }, role: 'teacher', idempotencyKey: `local-uat-member-grant-${person.rows[0].id}`, requestId: 'local-iam-uat-member', correlationId: 'local-iam-uat-member' });
  if (result.resultCode !== 'SUCCEEDED' || result.status !== 'active' || result.role !== 'teacher') throw new Error('Canonical IAM grant did not create the active UAT test Membership.');
  console.log(JSON.stringify({ fixture: 'created-active-test-member' }));
}
provision().finally(() => pool.end()).catch((error) => { console.error('[LOCAL-IAM-UAT-MEMBER]', error instanceof Error ? error.message : error); process.exitCode = 1; });
