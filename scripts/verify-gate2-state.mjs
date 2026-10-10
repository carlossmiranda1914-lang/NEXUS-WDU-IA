import { readApprovedTestTarget } from './nexus-test-db-safety.mjs';
import pg from 'pg';

const { connectionString } = readApprovedTestTarget();
const pool = new pg.Pool({ connectionString });

try {
  const docId = '5d8dec8c-470d-448f-ae5a-3aaa8d83adb0';
  const instA = 'f01dfd62-5a41-4e02-be99-9fde9e9cd5aa';

  console.log('=== 1. VERIFY DOCUMENT METADATA ===');
  const docRes = await pool.query(
    `SELECT d.id, d.institution_id, d.category, d.status, v.id as version_id, v.version_number
     FROM documents d
     JOIN document_versions v ON v.document_id = d.id
     WHERE d.id = $1 AND d.institution_id = $2`,
    [docId, instA]
  );
  console.log('Document:', docRes.rows);

  console.log('=== 2. VERIFY ASSOCIATIONS IN POSTGRESQL ===');
  const assocRes = await pool.query(
    `SELECT id, document_id, target_domain, target_resource_type, target_resource_id, pinned_version_id, purpose, status, created_at
     FROM document_associations
     WHERE document_id = $1`,
    [docId]
  );
  console.log('Associations count:', assocRes.rows.length);
  console.log('Associations:', assocRes.rows);

  console.log('=== 3. VERIFY AUDIT EVENTS ===');
  const auditRes = await pool.query(
    `SELECT id, institution_id, document_id, action, outcome, occurred_at, details
     FROM document_audit_events
     WHERE document_id = $1
     ORDER BY occurred_at DESC LIMIT 5`,
    [docId]
  );
  console.log('Audit events:', auditRes.rows);

  console.log('=== 4. VERIFY OUTBOX EVENTS ===');
  const outboxRes = await pool.query(
    `SELECT id, institution_id, event_type, aggregate_type, aggregate_id, occurred_at, payload, status
     FROM document_outbox_events
     WHERE aggregate_id = $1
     ORDER BY occurred_at DESC LIMIT 5`,
    [docId]
  );
  console.log('Outbox events:', outboxRes.rows);

} finally {
  await pool.end();
}
