import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';

const { connectionString } = readApprovedTestTarget();
const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
const schemaName = `nexus_iam01_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
if (!/^[a-z0-9_]+$/.test(schemaName)) throw new Error('Unsafe generated schema name.');
const schemaIdentifier = `"${schemaName}"`;
const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });

async function expectFailure(client: pg.PoolClient, action: () => Promise<unknown>, message: string): Promise<void> {
  await client.query('SAVEPOINT iam_expected_failure');
  let failed = false;
  try { await action(); } catch { failed = true; }
  await client.query('ROLLBACK TO SAVEPOINT iam_expected_failure');
  await client.query('RELEASE SAVEPOINT iam_expected_failure');
  assert.equal(failed, true, message);
}

try {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query(`CREATE SCHEMA ${schemaIdentifier}`);
    await client.query(`SET search_path TO ${schemaIdentifier}`);
    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();
    for (const filename of migrationFiles) await client.query(await readFile(path.join(migrationsDirectory, filename), 'utf8'));
    await client.query('BEGIN');
    transactionOpen = true;

    const institutionA = randomUUID();
    const institutionB = randomUUID();
    const personA = randomUUID();
    const personB = randomUUID();
    await client.query(
      `INSERT INTO institutions (id, name, slug, status) VALUES
        ($1, 'IAM Test A', 'iam-test-a', 'active'),
        ($2, 'IAM Test B', 'iam-test-b', 'active')`,
      [institutionA, institutionB],
    );
    await client.query(
      `INSERT INTO people (id, name) VALUES ($1, 'IAM Person A'), ($2, 'IAM Person B')`,
      [personA, personB],
    );

    const membership = randomUUID();
    await client.query(
      `INSERT INTO memberships (id, person_id, institution_id, role, status, approved_at)
       VALUES ($1, $2, $3, 'institution_admin', 'active', now())`,
      [membership, personA, institutionA],
    );
    await expectFailure(client,
      () => client.query(
        `INSERT INTO memberships (person_id, institution_id, role, status, approved_at)
         VALUES ($1, $2, 'director', 'active', now())`,
        [personA, institutionA],
      ),
      'A second active Membership for the same Person and Institution must fail.',
    );
    await client.query(
      `INSERT INTO memberships (person_id, institution_id, role, status, approved_at)
       VALUES ($1, $2, 'director', 'active', now())`,
      [personA, institutionB],
    );
    await expectFailure(client,
      () => client.query(
        `INSERT INTO memberships (person_id, institution_id, role, status, version)
         VALUES ($1, $2, 'student', 'pending', 0)`,
        [personB, institutionA],
      ),
      'Membership version must remain positive.',
    );

    const intent = randomUUID();
    const hash = 'a'.repeat(64);
    const fingerprint = 'b'.repeat(64);
    await client.query(
      `INSERT INTO iam_access_intents (
         id, institution_id, kind, code_hash, code_issued_at, code_expires_at,
         idempotency_scope, idempotency_key, request_fingerprint
       ) VALUES ($1, $2, 'institution_invitation', $3, now(), now() + interval '72 hours', $4, $5, $6)`,
      [intent, institutionA, hash, 'actor-scope-iam01', 'intent-key-iam01', fingerprint],
    );
    await expectFailure(client,
      () => client.query(
        `INSERT INTO iam_access_intents (
           institution_id, kind, code_hash, code_issued_at, code_expires_at,
           idempotency_scope, idempotency_key, request_fingerprint
         ) VALUES ($1, 'institution_invitation', $2, now(), now() + interval '71 hours', $3, $4, $5)`,
        [institutionA, hash, 'actor-scope-iam02', 'intent-key-iam02', fingerprint],
      ),
      'An IAM code expiry other than 72 hours must fail.',
    );

    await client.query(
      `INSERT INTO iam_command_ledger (
         institution_id, operation, actor_scope, idempotency_key, request_fingerprint, status, result_code, access_intent_id
       ) VALUES ($1, 'CreateInstitutionInvitation', $2, $3, $4, 'completed', 'SUCCEEDED', $5)`,
      [institutionA, 'actor-scope-iam01', 'command-key-iam01', fingerprint, intent],
    );
    await expectFailure(client,
      () => client.query(
        `INSERT INTO iam_command_ledger (
           institution_id, operation, actor_scope, idempotency_key, request_fingerprint, status, result_code
         ) VALUES ($1, 'CreateInstitutionInvitation', $2, $3, $4, 'completed', 'SUCCEEDED')`,
        [institutionA, 'actor-scope-iam01', 'command-key-iam01', fingerprint],
      ),
      'IAM command idempotency must be unique within institutional actor scope.',
    );

    const event = randomUUID();
    await client.query(
      `INSERT INTO iam_membership_events (
         id, institution_id, membership_id, actor_type, actor_person_id, action, previous_status, new_status, result
       ) VALUES ($1, $2, $3, 'person', $4, 'IAM_MEMBERSHIP_ACTIVATED', 'pending', 'active', 'succeeded')`,
      [event, institutionA, membership, personA],
    );
    await expectFailure(client,
      () => client.query(`UPDATE iam_membership_events SET result = 'conflict' WHERE id = $1`, [event]),
      'IAM factual events must be immutable.',
    );
    await expectFailure(client,
      () => client.query(
        `INSERT INTO iam_membership_events (
           institution_id, membership_id, actor_type, actor_person_id, action, result
         ) VALUES ($1, $2, 'person', $3, 'IAM_MEMBERSHIP_ACTIVATED', 'succeeded')`,
        [institutionB, membership, personA],
      ),
      'Tenant-scoped event references must reject an Institution A Membership in Institution B.',
    );
    await client.query('ROLLBACK');
    transactionOpen = false;
  } finally {
    try {
      if (transactionOpen) await client.query('ROLLBACK');
      await client.query('RESET search_path');
      await client.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`);
    } finally {
      client.release();
    }
  }
  console.log('[IAM-01] PASS: migration integrity, idempotency, tenant isolation and immutable event contracts.');
} finally {
  await pool.end();
}
