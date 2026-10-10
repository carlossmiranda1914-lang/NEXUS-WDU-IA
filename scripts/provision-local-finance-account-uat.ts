import pg from 'pg';
import { readApprovedTestTarget, verifyApprovedTestConnection } from './nexus-test-db-safety.mjs';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';
import { PostgresFinancialAccountRepository } from '../src/modules/finance/financial-account-repository.ts';

const ACCOUNT_B_NAME = 'UAT — Financial Situation Isolation B';
const ACCOUNT_B_IDEMPOTENCY_KEY = 'local-uat-finance-account-isolation-b-v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const institutionId = process.argv[2]?.trim();
if (!institutionId || !UUID.test(institutionId)) {
  throw new Error('Usage: TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx scripts/provision-local-finance-account-uat.ts <existing-institution-id>');
}

if (process.env.TEST_DATABASE_LOCAL_AUTHORIZED !== 'true') {
  throw new Error('Local Finance account UAT provisioning requires TEST_DATABASE_LOCAL_AUTHORIZED=true.');
}

const firebaseUid = process.env.NEXUS_UAT_FIREBASE_UID?.trim();
if (!firebaseUid || !/^[A-Za-z0-9_-]{1,128}$/.test(firebaseUid)) {
  throw new Error('NEXUS_UAT_FIREBASE_UID is required to resolve the active local UAT institution administrator.');
}

async function resolveActor(pool: pg.Pool): Promise<InstitutionalContext> {
  const result = await pool.query<{
    institution_id: string; institution_name: string; institution_slug: string; membership_id: string; person_id: string; person_name: string;
  }>(`SELECT i.id AS institution_id, i.name AS institution_name, i.slug AS institution_slug,
             m.id AS membership_id, p.id AS person_id, p.name AS person_name
        FROM identities identity
        JOIN people p ON p.id = identity.person_id
        JOIN memberships m ON m.person_id = p.id AND m.status = 'active' AND m.role = 'institution_admin'
        JOIN institutions i ON i.id = m.institution_id AND i.status = 'active'
       WHERE identity.provider = 'firebase' AND identity.provider_subject = $1
       ORDER BY i.slug`, [firebaseUid]);
  if (result.rows.length !== 1) {
    throw new Error('The configured local UAT identity must have exactly one active institution_admin context.');
  }
  const row = result.rows[0];
  if (row.institution_id !== institutionId) {
    throw new Error('The requested institution does not match the configured local UAT administrator institution.');
  }
  return {
    institutionId: row.institution_id,
    institutionName: row.institution_name,
    institutionSlug: row.institution_slug,
    membershipId: row.membership_id,
    personId: row.person_id,
    personName: row.person_name,
    identityEmail: null,
    role: 'institution_admin',
  };
}

async function main(): Promise<void> {
  const target = await verifyApprovedTestConnection();
  if (target.host !== '127.0.0.1' || target.port !== '54329' || target.database !== 'nexus_fnd01_test') {
    throw new Error('Local Finance account UAT provisioning is restricted to the approved disposable PostgreSQL target.');
  }

  const { connectionString } = readApprovedTestTarget();
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    const actor = await resolveActor(pool);
    const account = await new PostgresFinancialAccountRepository(pool).create(
      actor,
      { primaryPersonId: actor.personId, name: ACCOUNT_B_NAME },
      ACCOUNT_B_IDEMPOTENCY_KEY,
    );
    console.log(JSON.stringify({ id: account.id, accountNumber: account.accountNumber, name: account.name, institutionId: account.institutionId }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`[LOCAL-FINANCE-ACCOUNT-UAT] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
