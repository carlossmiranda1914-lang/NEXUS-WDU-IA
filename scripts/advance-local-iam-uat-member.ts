import pg from 'pg';
import { readApprovedTestTarget } from './nexus-test-db-safety.mjs';
import { changeMembershipRole } from '../src/modules/iam/iam-command-service.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import type { IamCommandPool, IamTransactionClient } from '../src/modules/iam/iam-command-types.ts';

const [firebaseUid] = process.argv.slice(2);
if (!firebaseUid || !/^[A-Za-z0-9_-]{1,128}$/.test(firebaseUid)) throw new Error('Usage: TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx scripts/advance-local-iam-uat-member.ts <firebase-uid>');
const { connectionString, target } = readApprovedTestTarget();
if (target.host !== '127.0.0.1' || target.port !== '54329') throw new Error('Local IAM UAT fixture advancement is restricted to the approved disposable PostgreSQL target.');
const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
const commandPool: IamCommandPool = { connect: async () => (await pool.connect()) as unknown as IamTransactionClient };

async function advance(): Promise<void> {
  const admin = await pool.query<InstitutionalContext>(`SELECT p.id AS "personId", p.name AS "personName", i.email AS "identityEmail", m.id AS "membershipId", n.id AS "institutionId", n.name AS "institutionName", n.slug AS "institutionSlug", m.role FROM identities i INNER JOIN people p ON p.id = i.person_id INNER JOIN memberships m ON m.person_id = p.id INNER JOIN institutions n ON n.id = m.institution_id WHERE i.provider = 'firebase' AND i.provider_subject = $1 AND n.slug = 'nexus-local-iam-uat' AND m.status = 'active' AND m.role = 'institution_admin' LIMIT 1`, [firebaseUid]);
  const fixture = await pool.query<{ id: string; version: number }>(`SELECT m.id, m.version FROM memberships m INNER JOIN people p ON p.id = m.person_id INNER JOIN institutions n ON n.id = m.institution_id WHERE n.slug = 'nexus-local-iam-uat' AND p.name = 'TESTE — Membro IAM UAT' AND m.status = 'active' ORDER BY m.created_at DESC LIMIT 1`);
  if (!admin.rows[0] || !fixture.rows[0]) throw new Error('An active local UAT admin and fixture Membership are required.');
  const result = await changeMembershipRole(commandPool, { context: admin.rows[0], membershipId: fixture.rows[0].id, role: 'secretariat', expectedVersion: fixture.rows[0].version, idempotencyKey: `local-uat-fixture-advance-${fixture.rows[0].version}`, requestId: 'local-iam-uat-conflict', correlationId: 'local-iam-uat-conflict' });
  if (result.resultCode !== 'SUCCEEDED' || result.role !== 'secretariat') throw new Error('Canonical IAM role change did not advance the UAT fixture.');
  console.log(JSON.stringify({ fixture: 'advanced-for-version-conflict' }));
}
advance().finally(() => pool.end()).catch((error) => { console.error('[LOCAL-IAM-UAT-CONFLICT]', error instanceof Error ? error.message : error); process.exitCode = 1; });
