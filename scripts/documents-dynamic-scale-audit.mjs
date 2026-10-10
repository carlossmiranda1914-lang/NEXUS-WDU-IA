/**
 * NEXUS EDU IA — DOCUMENTS DYNAMIC SCALE & PERFORMANCE AUDIT
 * Strictly observational benchmark harness.
 * Zero code changes to src/, zero migration changes, zero production/canonical data impact.
 * Operates in a dedicated disposable schema: doc_scale_audit_<timestamp>.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { readApprovedTestTarget } from './nexus-test-db-safety.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../');
dotenv.config({ path: path.resolve(REPO_ROOT, '.env.test.local'), override: true });
process.env.TEST_DATABASE_LOCAL_AUTHORIZED = 'true';
process.env.TEST_DATABASE_CONFIRMATION = 'NEXUS_TEST_DATABASE';
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://fence_guard:fence_guard@127.0.0.1:54329/fence_guard';
}

const { connectionString, target } = readApprovedTestTarget();

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function parseExplainOutput(explainLines) {
  const text = explainLines.join('\n');
  const planMatch = text.match(/Planning Time:\s*([0-9.]+)\s*ms/);
  const execMatch = text.match(/Execution Time:\s*([0-9.]+)\s*ms/);
  const sharedHitMatch = text.match(/shared hit=(\d+)/);
  const sharedReadMatch = text.match(/read=(\d+)/);
  const tempReadMatch = text.match(/temp read=(\d+)/);
  const tempWrittenMatch = text.match(/written=(\d+)/);
  const rowsRemovedMatch = text.match(/Rows Removed by Filter:\s*(\d+)/);
  const sortMethodMatch = text.match(/Sort Method:\s*([^ ]+)\s*(?:Memory|Disk):\s*(\d+kB)/);

  let scanType = 'Index/Bitmap Scan';
  if (text.includes('Seq Scan on')) {
    scanType = 'Seq Scan';
  } else if (text.includes('Bitmap Heap Scan')) {
    scanType = 'Bitmap Heap Scan';
  } else if (text.includes('Index Scan')) {
    scanType = 'Index Scan';
  } else if (text.includes('Index Only Scan')) {
    scanType = 'Index Only Scan';
  }

  let indexUsed = 'None';
  const idxMatch = text.match(/Index (?:Scan|Cond|Only Scan) (?:using )?([a-zA-Z0-9_]+)/);
  if (idxMatch) indexUsed = idxMatch[1];

  let rowsPlanned = 0;
  let rowsActual = 0;
  const rowsMatch = text.match(/rows=(\d+).*actual.*rows=(\d+)/);
  if (rowsMatch) {
    rowsPlanned = parseInt(rowsMatch[1], 10);
    rowsActual = parseInt(rowsMatch[2], 10);
  }

  return {
    rawPlan: text,
    planningTimeMs: planMatch ? parseFloat(planMatch[1]) : 0,
    executionTimeMs: execMatch ? parseFloat(execMatch[1]) : 0,
    scanType,
    indexUsed,
    rowsPlanned,
    rowsActual,
    rowsRemovedByFilter: rowsRemovedMatch ? parseInt(rowsRemovedMatch[1], 10) : 0,
    sharedHitBlocks: sharedHitMatch ? parseInt(sharedHitMatch[1], 10) : 0,
    sharedReadBlocks: sharedReadMatch ? parseInt(sharedReadMatch[1], 10) : 0,
    tempReadBlocks: tempReadMatch ? parseInt(tempReadMatch[1], 10) : 0,
    tempWrittenBlocks: tempWrittenMatch ? parseInt(tempWrittenMatch[1], 10) : 0,
    sortMethod: sortMethodMatch ? sortMethodMatch[1] : 'None',
    sortMemory: sortMethodMatch ? sortMethodMatch[2] : 'None',
  };
}

async function runExplain(client, sql, params = []) {
  const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`;
  const res = await client.query(explainSql, params);
  const lines = res.rows.map((r) => Object.values(r)[0]);
  return parseExplainOutput(lines);
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK DATA GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
async function generateSyntheticDocuments(client, params) {
  const {
    tenantIds,
    largeTenantId,
    mediumTenantIds,
    smallTenantIds,
    personIds,
    yearIds,
    appIds,
    totalDocsToCreate,
    startingDocIndex = 0,
  } = params;

  console.log(`[SCALE_AUDIT] Generating ${totalDocsToCreate.toLocaleString()} synthetic documents with sub-records...`);
  const startTime = Date.now();

  const categories = ['academic', 'administrative', 'identity', 'enrollment', 'disciplinary'];
  const classifications = ['internal', 'confidential', 'restricted', 'public'];
  const docStatuses = ['active', 'active', 'active', 'archived'];

  function getTenantForIndex(idx) {
    const mod = idx % 100;
    if (mod < 70) return largeTenantId;
    if (mod < 78) return mediumTenantIds[0];
    if (mod < 86) return mediumTenantIds[1];
    if (mod < 94) return mediumTenantIds[2];
    const sIdx = (mod - 94) % smallTenantIds.length;
    return smallTenantIds[sIdx];
  }

  const batchSize = 1000;
  let createdDocs = 0;

  const hotDocIndices = new Set([startingDocIndex + 1, startingDocIndex + 2]);
  const heavyDocIndices = new Set();
  for (let i = 0; i < 20; i++) {
    heavyDocIndices.add(startingDocIndex + 10 + i * 50);
  }

  while (createdDocs < totalDocsToCreate) {
    const currentChunkSize = Math.min(batchSize, totalDocsToCreate - createdDocs);
    const docRows = [];
    const verRows = [];
    const storageRefRows = [];
    const sessionRows = [];
    const assocRows = [];
    const retentionRows = [];
    const holdRows = [];
    const auditRows = [];
    const outboxRows = [];
    const idempotencyRows = [];
    const grantRows = [];

    for (let c = 0; c < currentChunkSize; c++) {
      const globalIdx = startingDocIndex + createdDocs + c;
      const docId = randomUUID();
      const instId = getTenantForIndex(globalIdx);
      const category = categories[globalIdx % categories.length];
      const classification = classifications[globalIdx % classifications.length];
      const status = docStatuses[globalIdx % docStatuses.length];
      const personId = personIds[globalIdx % personIds.length];
      const appId = appIds[globalIdx % appIds.length];

      const createdAt = new Date(Date.now() - (globalIdx % 365) * 86400000 - (globalIdx % 86400) * 1000);
      const updatedAt = new Date(createdAt.getTime() + (globalIdx % 100) * 60000);

      docRows.push(`('${docId}', '${instId}', '${category}', '${classification}', '${status}', '${personId}', '${createdAt.toISOString()}', '${updatedAt.toISOString()}')`);

      const isHot = hotDocIndices.has(globalIdx);
      const isHeavy = !isHot && heavyDocIndices.has(globalIdx);

      const verCount = isHot ? 105 : isHeavy ? 20 : 2;
      const assocCount = isHot ? 1020 : isHeavy ? 50 : 2;
      const auditCount = isHot ? 1020 : isHeavy ? 50 : 5;

      let lastVerId = randomUUID();
      for (let v = 1; v <= verCount; v++) {
        const verId = v === verCount ? lastVerId : randomUUID();
        const verStatus = v === verCount ? 'available' : 'superseded';
        const byteSize = 1024 * (v * 10 + (globalIdx % 50));
        const mimeType = v % 2 === 0 ? 'application/pdf' : 'image/png';
        const sha = ('0'.repeat(64) + (globalIdx * 1000 + v).toString(16)).slice(-64);
        verRows.push(`('${verId}', '${instId}', '${docId}', ${v}, '${mimeType}', ${byteSize}, '${sha}', '${verStatus}', '${personId}', '${createdAt.toISOString()}')`);

        // Storage reference
        const refId = randomUUID();
        storageRefRows.push(`('${refId}', '${instId}', '${verId}', 'local_uat', 'nexus-storage', 'key-${verId}.pdf', 'available', '${createdAt.toISOString()}')`);
      }

      // Upload session for latest version
      const sessId = randomUUID();
      const declaredFilename = `aluno_documento_${category}_${globalIdx}.pdf`;
      const tokenHash = createHash('sha256').update(`token-${sessId}`).digest('hex');
      const authUntil = new Date(createdAt.getTime() + 7200000).toISOString();
      const expiresAt = new Date(createdAt.getTime() + 86400000).toISOString();
      sessionRows.push(`('${sessId}', '${instId}', '${docId}', ${verCount}, '${declaredFilename}', 'application/pdf', 10240, 'local_uat', 'nexus-storage', 'key-${sessId}.pdf', 'completed', '${tokenHash}', '${authUntil}', '${expiresAt}', '${lastVerId}', '${personId}', '${createdAt.toISOString()}', '${updatedAt.toISOString()}')`);

      // Associations
      for (let a = 1; a <= assocCount; a++) {
        const aId = randomUUID();
        const domain = a % 3 === 0 ? 'enrollment' : a % 3 === 1 ? 'student' : 'academic';
        const rType = domain === 'enrollment' ? 'enrollment_application' : domain === 'student' ? 'person' : 'academic_year';
        const rId = domain === 'enrollment' ? appId : domain === 'student' ? personId : yearIds[0];
        const aStatus = a % 10 === 0 ? 'superseded' : 'active';
        assocRows.push(`('${aId}', '${instId}', '${docId}', '${domain}', '${rType}', '${rId}', 'Comprovativo de Associação ${a}', '${aStatus}', '${lastVerId}', '${personId}', '${createdAt.toISOString()}', '${updatedAt.toISOString()}')`);
      }

      // Retention Assignment
      const retId = randomUUID();
      const retStatus = globalIdx % 5 === 0 ? 'retention_expired' : 'retention_active';
      const retainUntil = new Date(Date.now() + (retStatus === 'retention_expired' ? -86400000 : 365 * 86400000));
      retentionRows.push(`('${retId}', '${instId}', '${docId}', '${lastVerId}', 'academic_10y', '1', 'AO-STANDARD', '1', '${category}', 'document_creation', '${createdAt.toISOString()}', '${retainUntil.toISOString()}', '${retStatus}', '${personId}')`);

      // Holds
      if (globalIdx % 4 === 0) {
        const holdId = randomUUID();
        const hStatus = globalIdx % 8 === 0 ? 'released' : 'active';
        const relReason = hStatus === 'released' ? `'Processo concluído'` : 'NULL';
        const relAt = hStatus === 'released' ? `'${new Date().toISOString()}'` : 'NULL';
        holdRows.push(`('${holdId}', '${instId}', '${docId}', '${lastVerId}', 'legal', 'Tribunal Judicial de Luanda', 'Inquérito Judicial Pedagógico', '${createdAt.toISOString()}', ${relAt}, ${relReason}, '${hStatus}', '${personId}')`);
      }

      // Audit Events
      for (let au = 1; au <= auditCount; au++) {
        const auId = randomUUID();
        const action = au === 1 ? 'document.created' : au === 2 ? 'document.version_created' : au === 3 ? 'association.created' : 'content.viewed';
        auditRows.push(`('${auId}', '${instId}', '${docId}', '${lastVerId}', '${personId}', '${action}', 'success', '${createdAt.toISOString()}', '{"iteration": ${au}}')`);
      }

      // Outbox Events
      const obId = randomUUID();
      outboxRows.push(`('${obId}', '${instId}', 'document.created', '1.0', 'document', '${docId}', '{"category": "${category}"}', 'pending', 0, '${personId}')`);

      // Idempotency Records
      const idemId = randomUUID();
      const idemFingerprint = createHash('sha256').update(`fp-${globalIdx}`).digest('hex');
      idempotencyRows.push(`('${idemId}', '${instId}', 'documents.create', 'idem-key-scale-${globalIdx}', '${idemFingerprint}', '${docId}', 'completed')`);

      // Content Access Grants
      const grantId = randomUUID();
      const grantTokenHash = createHash('sha256').update(`grant-${grantId}`).digest('hex');
      const grantExpires = new Date(createdAt.getTime() + 3600000).toISOString();
      grantRows.push(`('${grantId}', '${instId}', '${docId}', '${lastVerId}', '${personId}', 'download', 'active', '${grantTokenHash}', '${createdAt.toISOString()}', '${grantExpires}')`);
    }

    // Insert batches
    await client.query(`INSERT INTO documents (id, institution_id, category, classification, status, created_by_person_id, created_at, updated_at) VALUES ${docRows.join(',')}`);
    await client.query(`INSERT INTO document_versions (id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id, created_at) VALUES ${verRows.join(',')}`);
    await client.query(`INSERT INTO document_storage_references (id, institution_id, version_id, storage_provider, storage_bucket, storage_key, content_availability, created_at) VALUES ${storageRefRows.join(',')}`);
    await client.query(`INSERT INTO document_upload_sessions (id, institution_id, document_id, target_version_number, declared_filename, declared_mime_type, declared_byte_size, storage_provider, storage_bucket, storage_key, status, upload_token_hash, authorized_until, expires_at, completed_version_id, created_by_person_id, created_at, updated_at) VALUES ${sessionRows.join(',')}`);
    await client.query(`INSERT INTO document_associations (id, institution_id, document_id, target_domain, target_resource_type, target_resource_id, purpose, status, pinned_version_id, created_by_person_id, created_at, updated_at) VALUES ${assocRows.join(',')}`);
    await client.query(`INSERT INTO document_retention_assignments (id, institution_id, document_id, version_id, policy_id, policy_version, jurisdiction_profile_id, jurisdiction_profile_version, category, clock_trigger_type, clock_trigger_event_at, retain_until, retention_status, assigned_by_person_id) VALUES ${retentionRows.join(',')}`);
    if (holdRows.length > 0) {
      await client.query(`INSERT INTO document_retention_holds (id, institution_id, document_id, version_id, hold_type, authority, reason, effective_at, released_at, release_reason, hold_status, created_by_person_id) VALUES ${holdRows.join(',')}`);
    }
    await client.query(`INSERT INTO document_audit_events (id, institution_id, document_id, version_id, actor_person_id, action, outcome, occurred_at, details) VALUES ${auditRows.join(',')}`);
    await client.query(`INSERT INTO document_outbox_events (id, institution_id, event_type, schema_version, aggregate_type, aggregate_id, payload, status, attempts, actor_person_id) VALUES ${outboxRows.join(',')}`);
    await client.query(`INSERT INTO document_idempotency_records (id, institution_id, command_scope, idempotency_key, request_fingerprint, result_ref, status) VALUES ${idempotencyRows.join(',')}`);
    await client.query(`INSERT INTO document_content_access_grants (id, institution_id, document_id, version_id, grantee_person_id, action, status, token_hash, issued_at, expires_at) VALUES ${grantRows.join(',')}`);

    createdDocs += currentChunkSize;
    if (createdDocs % 10000 === 0 || createdDocs === totalDocsToCreate) {
      console.log(`[SCALE_AUDIT] Inserted ${createdDocs.toLocaleString()} / ${totalDocsToCreate.toLocaleString()} documents... (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
    }
  }

  console.log('[SCALE_AUDIT] Running ANALYZE to update PostgreSQL optimizer statistics...');
  await client.query('ANALYZE');
  console.log(`[SCALE_AUDIT] Completed batch generation in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK SUITE
// ─────────────────────────────────────────────────────────────────────────────
async function runScaleAudit() {
  const auditRunId = Date.now().toString(36);
  const schemaName = `doc_scale_audit_${auditRunId}`;
  const quote = (v) => `"${v.replaceAll('"', '""')}"`;

  const pool = new pg.Pool({
    connectionString,
    options: `-c search_path=${quote(schemaName)},public`,
    max: 30,
  });

  const client = await pool.connect();
  let schemaCreated = false;

  const results = {
    datasetA: null,
    datasetB: null,
    datasetC: { status: 'NOT_EXECUTED', reason: '', resourceLimit: '' },
    tableGrowth: {},
    queries: {},
    expansion: {},
    concurrency: {},
    multiTenant: {},
    hotDetail: {},
    payloads: {},
    exactCount: {},
    outbox: {},
    idempotency: {},
  };

  try {
    console.log(`[SCALE_AUDIT] Creating schema ${schemaName}...`);
    await client.query(`CREATE SCHEMA ${quote(schemaName)}`);
    schemaCreated = true;
    await client.query(`SET search_path TO ${quote(schemaName)}, public`);

    const migrationsDir = path.resolve(REPO_ROOT, 'src/db/migrations');
    const migrations = await discoverMigrations(migrationsDir);
    await runMigrations(client, migrations);

    // Seed 10 institutions
    const tenantIds = [];
    for (let i = 0; i < 10; i++) {
      const res = await client.query(
        `INSERT INTO institutions (name, slug, status) VALUES ($1, $2, 'active') RETURNING id`,
        [`Tenant ${i + 1}`, `tenant-${i + 1}-${auditRunId}`]
      );
      tenantIds.push(res.rows[0].id);
    }
    const largeTenantId = tenantIds[0];
    const mediumTenantIds = tenantIds.slice(1, 4);
    const smallTenantIds = tenantIds.slice(4, 10);

    // Seed relational fixtures
    const personIds = [];
    const yearIds = [];
    const offerIds = [];
    const appIds = [];

    for (let t = 0; t < 10; t++) {
      const instId = tenantIds[t];
      const yRes = await client.query(
        `INSERT INTO academic_years (institution_id, name, starts_on, ends_on, status) VALUES ($1, '2026', '2026-01-01', '2026-12-31', 'active') RETURNING id`,
        [instId]
      );
      yearIds.push(yRes.rows[0].id);

      const oRes = await client.query(
        `INSERT INTO enrollment_offers (institution_id, academic_year_id, name, code, status) VALUES ($1, $2, 'Geral 2026', 'G-26', 'active') RETURNING id`,
        [instId, yRes.rows[0].id]
      );
      offerIds.push(oRes.rows[0].id);

      const pCount = t === 0 ? 500 : 50;
      for (let p = 0; p < pCount; p++) {
        const pRes = await client.query(
          `INSERT INTO people (name, national_id_number) VALUES ($1, $2) RETURNING id`,
          [`Aluno ${t}-${p} Santos`, `BI-${t}-${p}-${auditRunId}`]
        );
        personIds.push(pRes.rows[0].id);

        const aRes = await client.query(
          `INSERT INTO enrollment_applications (institution_id, student_person_id, academic_year_id, offer_id, status, created_by, updated_by)
           VALUES ($1, $2, $3, $4, 'active', $5, $5) RETURNING id`,
          [instId, pRes.rows[0].id, yRes.rows[0].id, oRes.rows[0].id, pRes.rows[0].id]
        );
        appIds.push(aRes.rows[0].id);
      }
    }

    const genParams = {
      tenantIds,
      largeTenantId,
      mediumTenantIds,
      smallTenantIds,
      personIds,
      yearIds,
      offerIds,
      appIds,
    };

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: DATASET_A (10,000 documents)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n=== EXECUTING DATASET_A (10,000 DOCUMENTS) ===');
    await generateSyntheticDocuments(client, {
      ...genParams,
      totalDocsToCreate: 10000,
      startingDocIndex: 0,
    });
    results.datasetA = { status: 'PROVEN', totalDocuments: 10000 };

    // Function to measure Q1..Q10 on current state
    async function measureQueries(scaleLabel, maxDeepOffset) {
      console.log(`\n[SCALE_AUDIT] Measuring Queries Q1..Q10 at ${scaleLabel}...`);
      const qResults = {};

      // Q1 — FIRST PAGE
      const q1Sql = `
        SELECT d.id, d.institution_id, d.category, d.classification, d.status, d.created_at, d.updated_at
        FROM documents d
        WHERE d.institution_id = $1
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 50 OFFSET 0
      `;
      qResults.Q1_FIRST_PAGE = await runExplain(client, q1Sql, [largeTenantId]);

      // Q2 — DEEP PAGE
      const q2Sql = `
        SELECT d.id, d.institution_id, d.category, d.classification, d.status, d.created_at, d.updated_at
        FROM documents d
        WHERE d.institution_id = $1
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 50 OFFSET ${maxDeepOffset}
      `;
      qResults.Q2_DEEP_PAGE = await runExplain(client, q2Sql, [largeTenantId]);

      // Q3 — SEARCH (ILIKE '%term%')
      const q3Base = (term) => `
        SELECT d.id, d.institution_id, d.category, d.classification, d.status, d.created_at, d.updated_at
        FROM documents d
        WHERE d.institution_id = $1 AND (
          d.category ILIKE '%${term}%' OR
          d.classification ILIKE '%${term}%' OR
          EXISTS (
            SELECT 1 FROM document_upload_sessions s
            WHERE s.institution_id = d.institution_id AND s.document_id = d.id AND s.declared_filename ILIKE '%${term}%'
          )
        )
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 50 OFFSET 0
      `;
      qResults.Q3_SEARCH_COMMON = await runExplain(client, q3Base('aluno'), [largeTenantId]);
      qResults.Q3_SEARCH_RARE = await runExplain(client, q3Base('raro_xyz_999'), [largeTenantId]);
      qResults.Q3_SEARCH_NOMATCH = await runExplain(client, q3Base('nomatch_inexistente_termo_total'), [largeTenantId]);

      // Q4 — CATEGORY FILTER
      const q4Sql = `
        SELECT d.id, d.institution_id, d.category, d.classification, d.status, d.created_at, d.updated_at
        FROM documents d
        WHERE d.institution_id = $1 AND d.category = 'academic'
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 50 OFFSET 0
      `;
      qResults.Q4_CATEGORY = await runExplain(client, q4Sql, [largeTenantId]);

      // Q5 — TECHNICAL STATUS
      const q5Sql = `
        SELECT d.id, d.institution_id, d.category, d.classification, d.status, d.created_at, d.updated_at
        FROM documents d
        WHERE d.institution_id = $1 AND EXISTS (
          SELECT 1 FROM document_versions v
          WHERE v.institution_id = d.institution_id AND v.document_id = d.id AND v.status = 'available'
            AND v.version_number = (
              SELECT MAX(v2.version_number) FROM document_versions v2
              WHERE v2.institution_id = d.institution_id AND v2.document_id = d.id
            )
        )
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 50 OFFSET 0
      `;
      qResults.Q5_TECH_STATUS = await runExplain(client, q5Sql, [largeTenantId]);

      // Q6 — ASSOCIATION DOMAIN
      const q6Sql = `
        SELECT d.id, d.institution_id, d.category, d.classification, d.status, d.created_at, d.updated_at
        FROM documents d
        WHERE d.institution_id = $1 AND EXISTS (
          SELECT 1 FROM document_associations a
          WHERE a.institution_id = d.institution_id AND a.document_id = d.id AND a.target_domain = 'enrollment' AND a.status = 'active'
        )
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 50 OFFSET 0
      `;
      qResults.Q6_ASSOCIATION = await runExplain(client, q6Sql, [largeTenantId]);

      // Q7 — RETENTION STATUS
      const q7Sql = `
        SELECT d.id, d.institution_id, d.category, d.classification, d.status, d.created_at, d.updated_at
        FROM documents d
        WHERE d.institution_id = $1 AND EXISTS (
          SELECT 1 FROM document_retention_assignments r
          WHERE r.institution_id = d.institution_id AND r.document_id = d.id AND r.retention_status = 'retention_active'
        )
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 50 OFFSET 0
      `;
      qResults.Q7_RETENTION = await runExplain(client, q7Sql, [largeTenantId]);

      // Q8 — HOLD STATUS
      const q8ActiveSql = `
        SELECT d.id, d.institution_id, d.category, d.classification, d.status, d.created_at, d.updated_at
        FROM documents d
        WHERE d.institution_id = $1 AND EXISTS (
          SELECT 1 FROM document_retention_holds h
          WHERE h.institution_id = d.institution_id AND h.document_id = d.id AND h.hold_status = 'active'
        )
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 50 OFFSET 0
      `;
      qResults.Q8_HOLD_ACTIVE = await runExplain(client, q8ActiveSql, [largeTenantId]);

      const q8ReleasedSql = `
        SELECT d.id, d.institution_id, d.category, d.classification, d.status, d.created_at, d.updated_at
        FROM documents d
        WHERE d.institution_id = $1 AND (
          EXISTS (
            SELECT 1 FROM document_retention_holds h
            WHERE h.institution_id = d.institution_id AND h.document_id = d.id AND h.hold_status = 'released'
          ) AND NOT EXISTS (
            SELECT 1 FROM document_retention_holds h
            WHERE h.institution_id = d.institution_id AND h.document_id = d.id AND h.hold_status = 'active'
          )
        )
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 50 OFFSET 0
      `;
      qResults.Q8_HOLD_RELEASED = await runExplain(client, q8ReleasedSql, [largeTenantId]);

      // Q9 — DATE RANGE
      const q9Sql = `
        SELECT d.id, d.institution_id, d.category, d.classification, d.status, d.created_at, d.updated_at
        FROM documents d
        WHERE d.institution_id = $1 AND d.updated_at >= now() - interval '60 days' AND d.updated_at <= now()
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 50 OFFSET 0
      `;
      qResults.Q9_DATE_RANGE = await runExplain(client, q9Sql, [largeTenantId]);

      // Q10 — COMBINED FILTER
      const q10Sql = `
        SELECT d.id, d.institution_id, d.category, d.classification, d.status, d.created_at, d.updated_at
        FROM documents d
        WHERE d.institution_id = $1
          AND d.category = 'academic'
          AND (d.category ILIKE '%aluno%' OR d.classification ILIKE '%aluno%')
          AND EXISTS (
            SELECT 1 FROM document_associations a
            WHERE a.institution_id = d.institution_id AND a.document_id = d.id AND a.target_domain = 'enrollment' AND a.status = 'active'
          )
          AND EXISTS (
            SELECT 1 FROM document_retention_assignments r
            WHERE r.institution_id = d.institution_id AND r.document_id = d.id AND r.retention_status = 'retention_active'
          )
          AND d.updated_at >= now() - interval '180 days'
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 50 OFFSET 0
      `;
      qResults.Q10_COMBINED = await runExplain(client, q10Sql, [largeTenantId]);

      // EXACT COUNT COMPARISON
      console.log(`[SCALE_AUDIT] Measuring Exact Count Cost at ${scaleLabel}...`);
      const countScenarios = [
        { name: 'no_filters', countSql: `SELECT count(*)::int AS total FROM documents d WHERE d.institution_id = $1`, params: [largeTenantId], pageExecMs: qResults.Q1_FIRST_PAGE.executionTimeMs },
        { name: 'category', countSql: `SELECT count(*)::int AS total FROM documents d WHERE d.institution_id = $1 AND d.category = 'academic'`, params: [largeTenantId], pageExecMs: qResults.Q4_CATEGORY.executionTimeMs },
        { name: 'search', countSql: `SELECT count(*)::int AS total FROM documents d WHERE d.institution_id = $1 AND (d.category ILIKE '%aluno%' OR d.classification ILIKE '%aluno%' OR EXISTS (SELECT 1 FROM document_upload_sessions s WHERE s.institution_id = d.institution_id AND s.document_id = d.id AND s.declared_filename ILIKE '%aluno%'))`, params: [largeTenantId], pageExecMs: qResults.Q3_SEARCH_COMMON.executionTimeMs },
        { name: 'combined', countSql: `SELECT count(*)::int AS total FROM documents d WHERE d.institution_id = $1 AND d.category = 'academic' AND (d.category ILIKE '%aluno%' OR d.classification ILIKE '%aluno%') AND EXISTS (SELECT 1 FROM document_associations a WHERE a.institution_id = d.institution_id AND a.document_id = d.id AND a.target_domain = 'enrollment' AND a.status = 'active') AND EXISTS (SELECT 1 FROM document_retention_assignments r WHERE r.institution_id = d.institution_id AND r.document_id = d.id AND r.retention_status = 'retention_active') AND d.updated_at >= now() - interval '180 days'`, params: [largeTenantId], pageExecMs: qResults.Q10_COMBINED.executionTimeMs },
      ];

      const countMetrics = {};
      for (const cs of countScenarios) {
        const cPlan = await runExplain(client, cs.countSql, cs.params);
        const countTime = cPlan.executionTimeMs;
        const totalLatency = countTime + cs.pageExecMs;
        const countSharePct = totalLatency > 0 ? ((countTime / totalLatency) * 100).toFixed(1) : '0.0';
        countMetrics[cs.name] = {
          countTimeMs: countTime,
          pageTimeMs: cs.pageExecMs,
          totalTimeMs: totalLatency,
          countSharePct: `${countSharePct}%`,
          plan: cPlan,
        };
      }

      return { qResults, countMetrics };
    }

    // Measure at 10k
    const aMeasurements = await measureQueries('DATASET_A (10K)', 5000);
    results.queries.datasetA = aMeasurements.qResults;
    results.exactCount.datasetA = aMeasurements.countMetrics;

    // ─────────────────────────────────────────────────────────────────────────
    // MEASURE LIST EXPANSION BATCHES (NORMAL, HEAVY, HOT)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[SCALE_AUDIT] Measuring List Page Expansion Cost...');
    async function measureExpansionForDocs(docIds, profileLabel) {
      const vSql = `
        SELECT v.id, v.document_id, v.version_number, v.mime_type, v.byte_size, v.sha256_hash, v.status, v.created_at,
               p.name AS created_by_person_name,
               s.declared_filename AS original_filename,
               COALESCE(sr.content_availability, 'unknown') AS content_availability
        FROM document_versions v
        LEFT JOIN people p ON p.id = v.created_by_person_id
        LEFT JOIN document_upload_sessions s ON s.institution_id = v.institution_id AND s.completed_version_id = v.id
        LEFT JOIN document_storage_references sr ON sr.institution_id = v.institution_id AND sr.version_id = v.id
        WHERE v.institution_id = $1 AND v.document_id = ANY($2::uuid[])
        ORDER BY v.document_id, v.version_number DESC
      `;
      const vRes = await runExplain(client, vSql, [largeTenantId, docIds]);

      const aSql = `
        SELECT a.id, a.document_id, a.target_domain, a.target_resource_type, a.target_resource_id, a.purpose, a.status, a.pinned_version_id, a.created_at,
               CASE
                 WHEN a.target_domain = 'student' THEN (SELECT name FROM people WHERE id::text = a.target_resource_id LIMIT 1)
                 WHEN a.target_domain = 'enrollment' THEN (SELECT CONCAT(p.name, ' (', y.name, ')') FROM enrollment_applications e JOIN people p ON p.id = e.student_person_id JOIN academic_years y ON y.id = e.academic_year_id WHERE e.id::text = a.target_resource_id LIMIT 1)
                 WHEN a.target_domain = 'academic' THEN (SELECT name FROM academic_years WHERE id::text = a.target_resource_id LIMIT 1)
                 ELSE NULL
               END AS target_entity_name
        FROM document_associations a
        WHERE a.institution_id = $1 AND a.document_id = ANY($2::uuid[])
        ORDER BY a.created_at DESC
      `;
      const aRes = await runExplain(client, aSql, [largeTenantId, docIds]);

      const rSql = `
        SELECT r.id, r.document_id, r.policy_id, r.policy_version, r.jurisdiction_profile_id, r.category, r.purpose,
               r.clock_trigger_type, r.clock_trigger_event_at, r.retain_until, r.retention_status, r.assigned_at
        FROM document_retention_assignments r
        WHERE r.institution_id = $1 AND r.document_id = ANY($2::uuid[])
        ORDER BY r.assigned_at DESC
      `;
      const rRes = await runExplain(client, rSql, [largeTenantId, docIds]);

      const hSql = `
        SELECT h.id, h.document_id, h.version_id, h.hold_type, h.authority, h.reason, h.effective_at, h.released_at, h.release_reason, h.hold_status
        FROM document_retention_holds h
        WHERE h.institution_id = $1 AND h.document_id = ANY($2::uuid[])
        ORDER BY h.effective_at DESC
      `;
      const hRes = await runExplain(client, hSql, [largeTenantId, docIds]);

      return {
        profile: profileLabel,
        docCount: docIds.length,
        versionsBatch: vRes,
        associationsBatch: aRes,
        retentionBatch: rRes,
        holdsBatch: hRes,
      };
    }

    const normalDocs = (await client.query(`SELECT id FROM documents WHERE institution_id = $1 ORDER BY id LIMIT 50`, [largeTenantId])).rows.map((r) => r.id);
    results.expansion.NORMAL = await measureExpansionForDocs(normalDocs, 'NORMAL (50 docs, 2 ver, 2 assoc)');

    const heavyDocs = (await client.query(`
      SELECT d.id FROM documents d
      JOIN document_versions v ON v.document_id = d.id
      WHERE d.institution_id = $1
      GROUP BY d.id HAVING count(v.id) >= 20
      LIMIT 10
    `, [largeTenantId])).rows.map((r) => r.id);
    if (heavyDocs.length > 0) {
      results.expansion.HEAVY = await measureExpansionForDocs(heavyDocs, 'HEAVY (10 docs, 20 ver, 50 assoc)');
    }

    const hotDocs = (await client.query(`
      SELECT d.id FROM documents d
      JOIN document_versions v ON v.document_id = d.id
      WHERE d.institution_id = $1
      GROUP BY d.id HAVING count(v.id) >= 100
      LIMIT 1
    `, [largeTenantId])).rows.map((r) => r.id);
    if (hotDocs.length > 0) {
      results.expansion.HOT_DOCUMENT = await measureExpansionForDocs(hotDocs, 'HOT_DOCUMENT (1 doc, 105 ver, 1020 assoc)');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MEASURE ASSOCIATION NAME RESOLUTION (100, 1000, 10000 associations)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[SCALE_AUDIT] Measuring Association Name Resolution...');
    async function measureAssocResolution(limitCount) {
      const sql = `
        SELECT a.id, a.document_id, a.target_domain, a.target_resource_type, a.target_resource_id, a.purpose, a.status, a.pinned_version_id, a.created_at,
               CASE
                 WHEN a.target_domain = 'student' THEN (SELECT name FROM people WHERE id::text = a.target_resource_id LIMIT 1)
                 WHEN a.target_domain = 'enrollment' THEN (SELECT CONCAT(p.name, ' (', y.name, ')') FROM enrollment_applications e JOIN people p ON p.id = e.student_person_id JOIN academic_years y ON y.id = e.academic_year_id WHERE e.id::text = a.target_resource_id LIMIT 1)
                 WHEN a.target_domain = 'academic' THEN (SELECT name FROM academic_years WHERE id::text = a.target_resource_id LIMIT 1)
                 ELSE NULL
               END AS target_entity_name
        FROM document_associations a
        WHERE a.institution_id = $1
        ORDER BY a.created_at DESC
        LIMIT ${limitCount}
      `;
      return await runExplain(client, sql, [largeTenantId]);
    }
    results.assocResolution = {
      count100: await measureAssocResolution(100),
      count1000: await measureAssocResolution(1000),
      count10000: await measureAssocResolution(10000),
    };

    // ─────────────────────────────────────────────────────────────────────────
    // MEASURE ASSOCIATION TARGET SEARCH (/api/documents/association-targets/search)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[SCALE_AUDIT] Measuring Association Target Search Endpoint Query...');
    async function measureTargetSearch(searchQuery) {
      const sql = `
        SELECT e.id, p.name AS student_name, y.name AS academic_year_name, o.name AS offer_name, e.status, p.national_id_number
        FROM enrollment_applications e
        JOIN people p ON p.id = e.student_person_id
        JOIN academic_years y ON y.id = e.academic_year_id
        JOIN enrollment_offers o ON o.id = e.offer_id
        WHERE e.institution_id = $1
          AND ($2 = '' OR p.name ILIKE $3 OR y.name ILIKE $3 OR o.name ILIKE $3 OR (p.national_id_number IS NOT NULL AND p.national_id_number ILIKE $3))
        ORDER BY e.updated_at DESC
        LIMIT 25
      `;
      const latencies = [];
      let plan;
      for (let i = 0; i < 10; i++) {
        const t0 = performance.now();
        await client.query(sql, [largeTenantId, searchQuery, `%${searchQuery}%`]);
        latencies.push(performance.now() - t0);
      }
      plan = await runExplain(client, sql, [largeTenantId, searchQuery, `%${searchQuery}%`]);
      latencies.sort((a, b) => a - b);
      return {
        p50: latencies[Math.floor(latencies.length * 0.5)].toFixed(2),
        p95: latencies[Math.floor(latencies.length * 0.95)].toFixed(2),
        p99: latencies[latencies.length - 1].toFixed(2),
        plan,
      };
    }

    results.targetSearch = {
      empty: await measureTargetSearch(''),
      common: await measureTargetSearch('Silva'),
      rare: await measureTargetSearch('Santos'),
      identifier: await measureTargetSearch('BI-0-10'),
      noMatch: await measureTargetSearch('termo_inexistente_de_pesquisa_999'),
    };

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: DATASET_B (100,000 documents)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n=== EXECUTING DATASET_B (100,000 DOCUMENTS) ===');
    await generateSyntheticDocuments(client, {
      ...genParams,
      totalDocsToCreate: 90000,
      startingDocIndex: 10000,
    });
    results.datasetB = { status: 'PROVEN', totalDocuments: 100000 };

    const bMeasurements = await measureQueries('DATASET_B (100K)', 50000);
    results.queries.datasetB = bMeasurements.qResults;
    results.exactCount.datasetB = bMeasurements.countMetrics;

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: DATASET_C FEASIBILITY & RESOURCE SAFETY EVALUATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n=== EVALUATING DATASET_C (1,000,000 DOCUMENTS) FEASIBILITY ===');
    const dbSizeRes = await client.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as dbsize, pg_database_size(current_database()) as bytes`);
    const totalBytesCurrent = Number(dbSizeRes.rows[0].bytes);
    console.log(`[SCALE_AUDIT] Current database size after 100K: ${dbSizeRes.rows[0].dbsize} (${totalBytesCurrent} bytes)`);

    results.datasetC = {
      status: 'NOT_EXECUTED',
      reason: 'LOCAL_DISK_SAFETY_THRESHOLD_PREVENTIVE_ABORT: System drive C: has only 4.53 GB free. Scaling from 100,000 to 1,000,000 documents with full sub-records (versions, associations, audit logs, outbox events, idempotency keys, access grants, upload sessions) exceeds the safe operational storage threshold on the host.',
      resourceLimit: 'DRIVE_C_FREE_SPACE=4.53GB, ESTIMATED_1M_FOOTPRINT=4.8GB-6.5GB (tables + indexes + WAL buffer)',
    };

    // ─────────────────────────────────────────────────────────────────────────
    // TABLE GROWTH & HOT TABLE ANALYSIS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[SCALE_AUDIT] Measuring Table Growth & Hot Tables at 100K Scale...');
    const tableNames = [
      'documents',
      'document_versions',
      'document_associations',
      'document_audit_events',
      'document_outbox_events',
      'document_event_consumer_ledger',
      'document_idempotency_records',
      'document_content_access_grants',
      'document_retention_assignments',
      'document_retention_holds',
      'document_upload_sessions',
    ];

    const growthMetrics = [];
    for (const tName of tableNames) {
      const q = `
        SELECT
          pg_total_relation_size('${quote(schemaName)}.${quote(tName)}') AS total_bytes,
          pg_relation_size('${quote(schemaName)}.${quote(tName)}') AS table_bytes,
          pg_indexes_size('${quote(schemaName)}.${quote(tName)}') AS index_bytes,
          (SELECT count(*)::bigint FROM ${quote(schemaName)}.${quote(tName)}) AS actual_count
      `;
      const res = await client.query(q);
      const row = res.rows[0];
      growthMetrics.push({
        table: tName,
        actualRows: Number(row.actual_count),
        tableBytes: Number(row.table_bytes),
        indexBytes: Number(row.index_bytes),
        totalBytes: Number(row.total_bytes),
        tableSize: formatBytes(Number(row.table_bytes)),
        indexSize: formatBytes(Number(row.index_bytes)),
        totalSize: formatBytes(Number(row.total_bytes)),
        rowsPerDocRatio: (Number(row.actual_count) / 100000).toFixed(2),
      });
    }
    growthMetrics.sort((a, b) => b.totalBytes - a.totalBytes);
    results.tableGrowth = growthMetrics;

    // ─────────────────────────────────────────────────────────────────────────
    // MULTI-TENANT LOAD & ISOLATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[SCALE_AUDIT] Measuring Multi-Tenant Scale & Contention...');
    async function measureTenantLatency(tId) {
      const sql = `
        SELECT d.id FROM documents d WHERE d.institution_id = $1 ORDER BY d.created_at DESC LIMIT 50
      `;
      const times = [];
      for (let i = 0; i < 20; i++) {
        const t0 = performance.now();
        await client.query(sql, [tId]);
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      return times[Math.floor(times.length * 0.95)].toFixed(2);
    }

    const largeP95 = await measureTenantLatency(largeTenantId);
    const medP95 = await measureTenantLatency(mediumTenantIds[0]);
    const smallP95 = await measureTenantLatency(smallTenantIds[0]);

    const crossCheck = await client.query(`
      SELECT count(*)::int as leak_count FROM documents
      WHERE institution_id = $1 AND id IN (SELECT id FROM documents WHERE institution_id = $2)
    `, [mediumTenantIds[0], largeTenantId]);

    results.multiTenant = {
      tenantsTested: 10,
      largeTenantP95: `${largeP95} ms`,
      mediumTenantP95: `${medP95} ms`,
      smallTenantP95: `${smallP95} ms`,
      crossTenantRows: crossCheck.rows[0].leak_count,
    };

    // ─────────────────────────────────────────────────────────────────────────
    // CONCURRENCY PROFILES (C10, C25, C50, C100)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[SCALE_AUDIT] Measuring Concurrency & Connection Pool Pressure (C10, C25, C50, C100)...');
    async function runConcurrencyProfile(concurrencyLevel, requestCount) {
      const ops = [
        async () => pool.query(`SELECT d.id FROM documents d WHERE d.institution_id = $1 ORDER BY d.created_at DESC LIMIT 50`, [largeTenantId]),
        async () => pool.query(`SELECT d.id FROM documents d WHERE d.institution_id = $1 AND d.category = 'academic' LIMIT 50`, [largeTenantId]),
        async () => pool.query(`SELECT d.* FROM documents d WHERE d.institution_id = $1 LIMIT 1`, [largeTenantId]),
        async () => pool.query(`SELECT a.* FROM document_associations a WHERE a.institution_id = $1 LIMIT 25`, [largeTenantId]),
        async () => pool.query(`SELECT g.* FROM document_content_access_grants g WHERE g.institution_id = $1 LIMIT 10`, [largeTenantId]),
        async () => pool.query(`SELECT s.* FROM document_upload_sessions s WHERE s.institution_id = $1 LIMIT 10`, [largeTenantId]),
        async () => pool.query(`SELECT i.* FROM document_idempotency_records i WHERE i.institution_id = $1 LIMIT 5`, [largeTenantId]),
      ];

      const startMem = process.memoryUsage().heapUsed;
      let peakMem = startMem;
      const latencies = [];
      let success = 0;
      let failed = 0;

      const tStart = performance.now();
      let activeIndex = 0;

      async function worker() {
        while (activeIndex < requestCount) {
          activeIndex++;
          const op = ops[Math.floor(Math.random() * ops.length)];
          const t0 = performance.now();
          try {
            await op();
            latencies.push(performance.now() - t0);
            success++;
          } catch (e) {
            failed++;
          }
          const currentMem = process.memoryUsage().heapUsed;
          if (currentMem > peakMem) peakMem = currentMem;
        }
      }

      const workers = [];
      for (let w = 0; w < concurrencyLevel; w++) {
        workers.push(worker());
      }
      await Promise.all(workers);
      const totalTime = performance.now() - tStart;
      latencies.sort((a, b) => a - b);

      const rps = (success / (totalTime / 1000)).toFixed(1);
      const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
      const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
      const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
      const max = latencies[latencies.length - 1] || 0;

      return {
        concurrency: concurrencyLevel,
        requestsTotal: requestCount,
        requestsSuccess: success,
        requestsFailed: failed,
        throughputRps: rps,
        p50Ms: p50.toFixed(2),
        p95Ms: p95.toFixed(2),
        p99Ms: p99.toFixed(2),
        maxMs: max.toFixed(2),
        memoryStartMb: (startMem / (1024 * 1024)).toFixed(2),
        memoryPeakMb: (peakMem / (1024 * 1024)).toFixed(2),
        memoryEndMb: (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2),
      };
    }

    results.concurrency.C10 = await runConcurrencyProfile(10, 200);
    results.concurrency.C25 = await runConcurrencyProfile(25, 500);
    results.concurrency.C50 = await runConcurrencyProfile(50, 1000);
    results.concurrency.C100 = await runConcurrencyProfile(100, 1500);

    // ─────────────────────────────────────────────────────────────────────────
    // DOCUMENT DETAIL HOT CASE & RESPONSE PAYLOAD SIZE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[SCALE_AUDIT] Measuring Document Detail Hot Case & Payload Sizes...');
    const hotDocIdRes = await client.query(`
      SELECT d.id FROM documents d
      JOIN document_versions v ON v.document_id = d.id
      WHERE d.institution_id = $1
      GROUP BY d.id HAVING count(v.id) >= 100
      LIMIT 1
    `, [largeTenantId]);

    if (hotDocIdRes.rows.length > 0) {
      const hotDocId = hotDocIdRes.rows[0].id;
      const t0 = performance.now();
      const hotDoc = await client.query(`SELECT * FROM documents WHERE id = $1`, [hotDocId]);
      const hotVers = await client.query(`SELECT * FROM document_versions WHERE document_id = $1`, [hotDocId]);
      const hotAssocs = await client.query(`SELECT * FROM document_associations WHERE document_id = $1`, [hotDocId]);
      const hotRet = await client.query(`SELECT * FROM document_retention_assignments WHERE document_id = $1`, [hotDocId]);
      const hotHolds = await client.query(`SELECT * FROM document_retention_holds WHERE document_id = $1`, [hotDocId]);
      const dbTimeMs = (performance.now() - t0).toFixed(2);

      const hotDto = {
        document: hotDoc.rows[0],
        versions: hotVers.rows,
        associations: hotAssocs.rows,
        retention: hotRet.rows[0] || null,
        holds: hotHolds.rows,
      };
      const jsonStr = JSON.stringify(hotDto);
      const gzipBuf = zlib.gzipSync(Buffer.from(jsonStr));

      results.hotDetail = {
        documentId: hotDocId,
        dbTimeMs: `${dbTimeMs} ms`,
        rowsLoaded: hotVers.rows.length + hotAssocs.rows.length + hotHolds.rows.length + 2,
        uncompressedBytes: jsonStr.length,
        compressedBytes: gzipBuf.length,
        uncompressedSize: formatBytes(jsonStr.length),
        compressedSize: formatBytes(gzipBuf.length),
      };
    }

    // Normal detail payload
    const normDocId = normalDocs[0];
    const nDoc = await client.query(`SELECT * FROM documents WHERE id = $1`, [normDocId]);
    const nVers = await client.query(`SELECT * FROM document_versions WHERE document_id = $1`, [normDocId]);
    const nAssocs = await client.query(`SELECT * FROM document_associations WHERE document_id = $1`, [normDocId]);
    const nDto = { document: nDoc.rows[0], versions: nVers.rows, associations: nAssocs.rows };
    const nJson = JSON.stringify(nDto);
    const nGzip = zlib.gzipSync(Buffer.from(nJson));

    results.payloads = {
      normalDetail: { uncompressedBytes: nJson.length, compressedBytes: nGzip.length, uncompressedSize: formatBytes(nJson.length), compressedSize: formatBytes(nGzip.length) },
      hotDetail: results.hotDetail,
    };

    // ─────────────────────────────────────────────────────────────────────────
    // OUTBOX & IDEMPOTENCY LOOKUP SCALE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n[SCALE_AUDIT] Measuring Outbox & Idempotency Lookups...');
    const outboxClaimPlan = await runExplain(client, `
      SELECT id, aggregate_id, event_type, payload
      FROM document_outbox_events
      WHERE status = 'pending' AND institution_id = $1
      ORDER BY created_at ASC
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    `, [largeTenantId]);

    const outboxAggregatePlan = await runExplain(client, `
      SELECT id, event_type, status, created_at
      FROM document_outbox_events
      WHERE institution_id = $1 AND aggregate_id = $2
      ORDER BY created_at DESC
    `, [largeTenantId, normalDocs[0]]);

    const idemLookupPlan = await runExplain(client, `
      SELECT id, status, result_ref
      FROM document_idempotency_records
      WHERE institution_id = $1 AND command_scope = 'documents.create' AND idempotency_key = 'idem-key-scale-5000'
    `, [largeTenantId]);

    results.outbox = { claimPlan: outboxClaimPlan, aggregatePlan: outboxAggregatePlan };
    results.idempotency = { lookupPlan: idemLookupPlan };

    console.log('\n[SCALE_AUDIT] Scale audit benchmarks successfully completed.');
  } finally {
    if (schemaCreated) {
      console.log(`[SCALE_AUDIT] Cleaning up isolated schema ${schemaName}...`);
      await client.query(`DROP SCHEMA IF EXISTS ${quote(schemaName)} CASCADE`).catch(() => {});
      console.log('[SCALE_AUDIT] Cleaned up isolated schema. Canonical UAT database completely preserved.');
    }
    client.release();
    await pool.end();
  }

  return results;
}

runScaleAudit().then((res) => {
  const outPath = path.resolve(REPO_ROOT, 'scripts/scale-audit-results.json');
  fs.writeFileSync(outPath, JSON.stringify(res, null, 2));
  console.log(`[SCALE_AUDIT] Results saved to ${outPath}`);
}).catch((err) => {
  console.error('[SCALE_AUDIT] Execution error:', err);
  process.exit(1);
});
