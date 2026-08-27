import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';
import { recordIamEvent } from '../src/modules/iam/iam-audit.ts';

const { connectionString } = readApprovedTestTarget();
const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
const client = await pool.connect();
let transactionOpen = false;
try {
  await client.query('BEGIN'); transactionOpen = true;
  const institutionId = randomUUID(); const personId = randomUUID();
  await client.query(`INSERT INTO institutions (id, name, slug, status) VALUES ($1, 'IAM Audit', $2, 'active')`, [institutionId, `iam-audit-${randomUUID()}`]);
  await client.query(`INSERT INTO people (id, name) VALUES ($1, 'Audit Actor')`, [personId]);
  await recordIamEvent(client, { institutionId, actor: { type: 'person', personId }, action: 'IAM_MEMBERSHIP_ACTIVATED', result: 'rejected', reasonCode: 'VERSION_CONFLICT', requestId: 'request-safe', correlationId: 'correlation-safe' });
  const event = await client.query<{ id: string; reason_code: string; request_id: string }>('SELECT id, reason_code, request_id FROM iam_membership_events WHERE institution_id = $1', [institutionId]);
  assert.equal(event.rows.length, 1); assert.equal(event.rows[0].reason_code, 'VERSION_CONFLICT'); assert.equal(event.rows[0].request_id, 'request-safe');
  await assert.rejects(() => client.query(`UPDATE iam_membership_events SET reason_code = 'OTHER' WHERE id = $1`, [event.rows[0].id]));
  await client.query('ROLLBACK'); transactionOpen = false;
  console.log('IAM audit PostgreSQL tests passed.');
} finally { if (transactionOpen) await client.query('ROLLBACK'); client.release(); await pool.end(); }
