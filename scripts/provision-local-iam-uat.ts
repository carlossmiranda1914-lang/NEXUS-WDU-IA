import pg from 'pg';
import { readApprovedTestTarget } from './nexus-test-db-safety.mjs';
import { bootstrapInstitutionAdmin } from '../src/modules/iam/iam-command-service.ts';
import type { IamCommandPool, IamTransactionClient } from '../src/modules/iam/iam-command-types.ts';

const [firebaseUid] = process.argv.slice(2);
if (!firebaseUid || !/^[A-Za-z0-9_-]{1,128}$/.test(firebaseUid)) {
  throw new Error('Usage: TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx scripts/provision-local-iam-uat.ts <firebase-uid>');
}

const { connectionString, target } = readApprovedTestTarget();
if (target.host !== '127.0.0.1' || target.port !== '54329') {
  throw new Error('Local IAM UAT provisioning is restricted to the approved disposable PostgreSQL target.');
}

const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
const commandPool: IamCommandPool = { connect: async () => (await pool.connect()) as unknown as IamTransactionClient };

async function provision(): Promise<void> {
  const client = await pool.connect();
  let institutionId = '';
  let identityId = '';
  try {
    await client.query('BEGIN');
    const institution = await client.query<{ id: string }>(
      `INSERT INTO institutions (name, slug, status)
       VALUES ('TESTE — Nexus IAM UAT', 'nexus-local-iam-uat', 'active')
       ON CONFLICT (slug) DO UPDATE SET status = 'active', updated_at = now()
       RETURNING id`,
    );
    institutionId = institution.rows[0].id;

    const existing = await client.query<{ id: string; person_id: string }>(
      `SELECT id, person_id FROM identities
       WHERE provider = 'firebase' AND provider_subject = $1
       FOR UPDATE`,
      [firebaseUid],
    );
    if (existing.rows[0]) {
      identityId = existing.rows[0].id;
    } else {
      const person = await client.query<{ id: string }>(
        `INSERT INTO people (name) VALUES ('TESTE — Administrador IAM UAT') RETURNING id`,
      );
      const identity = await client.query<{ id: string }>(
        `INSERT INTO identities (person_id, provider, provider_subject)
         VALUES ($1, 'firebase', $2)
         RETURNING id`,
        [person.rows[0].id, firebaseUid],
      );
      identityId = identity.rows[0].id;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const existingAdmin = await pool.query<{ id: string }>(
    `SELECT m.id
       FROM memberships m
       INNER JOIN identities i ON i.person_id = m.person_id
      WHERE m.institution_id = $1 AND m.status = 'active' AND m.role = 'institution_admin'
        AND i.id = $2`,
    [institutionId, identityId],
  );
  if (existingAdmin.rows[0]) {
    console.log(JSON.stringify({ institution: 'nexus-local-iam-uat', bootstrap: 'reused-existing-admin' }));
    return;
  }

  const result = await bootstrapInstitutionAdmin(commandPool, {
    institutionId,
    target: { identityId },
    systemScope: 'system:local-iam-uat-bootstrap',
    idempotencyKey: 'local-uat-bootstrap-v1',
    requestId: 'local-iam-uat',
    correlationId: 'local-iam-uat',
  });
  if (result.resultCode !== 'SUCCEEDED' || result.role !== 'institution_admin' || result.status !== 'active') {
    throw new Error('BootstrapInstitutionAdmin did not produce an active institution_admin Membership.');
  }
  const event = await pool.query<{ action: string }>(
    `SELECT action FROM iam_membership_events
     WHERE institution_id = $1 AND membership_id = $2 AND action = 'IAM_INSTITUTION_ADMIN_BOOTSTRAPPED'
     ORDER BY created_at DESC LIMIT 1`,
    [institutionId, result.membershipId],
  );
  if (event.rows[0]?.action !== 'IAM_INSTITUTION_ADMIN_BOOTSTRAPPED') {
    throw new Error('Bootstrap audit evidence was not persisted.');
  }
  console.log(JSON.stringify({ institution: 'nexus-local-iam-uat', bootstrap: 'IAM_INSTITUTION_ADMIN_BOOTSTRAPPED' }));
}

provision()
  .finally(() => pool.end())
  .catch((error) => {
    console.error('[LOCAL-IAM-UAT]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
