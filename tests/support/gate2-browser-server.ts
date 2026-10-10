/**
 * Browser Test Server for Gate 2 Real Association
 * MISSION=DOCUMENTS-GATE2-REAL-ASSOCIATION
 */

import express from 'express';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { verifyApprovedTestConnection } from '../../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../../src/db/migration-runner.ts';
import { registerDocumentRoutes } from '../../src/modules/documents/document.controller.ts';
import { resolveDocumentsOperationalConfig } from '../../src/modules/documents/documents-runtime-config.ts';
import { LocalUatObjectStorageProvider } from '../../src/modules/documents/local-uat-storage-provider.ts';
import { LocalUatMalwareScanner } from '../../src/modules/documents/local-uat-malware-scanner.ts';
import { DocumentVerificationWorker } from '../../src/modules/documents/verification-worker.ts';

await verifyApprovedTestConnection();

const port = 3125;
const storageDir = path.resolve(process.cwd(), '.uat-storage');
const schema = `doc_gate2_browser_${randomUUID().replaceAll('-', '')}`;
const quote = (val: string) => `"${val.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/db/migrations');

const institutionIdA = '11111111-1111-4111-8111-111111111111';
const adminPersonIdA = '22222222-2222-4222-8222-222222222222';
const studentPersonIdA = '33333333-3333-4333-8333-333333333333';
const academicYearIdA = '44444444-4444-4444-8444-444444444444';
const offerIdA = '55555555-5555-4555-8555-555555555555';
const enrollmentAppIdA = '66666666-6666-4666-8666-666666666666';

const docIdA = '77777777-7777-4777-8777-777777777777';
const versionIdA = '88888888-8888-4888-8888-888888888888';

const client = await pool.connect();
try {
  await client.query(`CREATE SCHEMA ${quote(schema)}`);
  await client.query(`SET search_path TO ${quote(schema)}, public`);
  const files = await discoverMigrations(migrationsDir);
  await runMigrations(client, files);

  // Seed Institutions
  await client.query(`
    INSERT INTO institutions (id, name, slug, status) VALUES
    ($1, 'Tenant A Institution', 't-a', 'active')
  `, [institutionIdA]);

  // Seed People
  await client.query(`
    INSERT INTO people (id, name, national_id_number) VALUES
    ($1, 'Admin A', 'BI-ADMIN-A-01'),
    ($2, 'Student Manuel Silva', 'BI-STUDENT-SILVA-01')
  `, [adminPersonIdA, studentPersonIdA]);

  // Seed Memberships
  await client.query(`
    INSERT INTO memberships (id, institution_id, person_id, role, status, approved_at) VALUES
    ($1, $2, $3, 'institution_admin', 'active', now()),
    ($4, $5, $6, 'student', 'active', now())
  `, [
    randomUUID(), institutionIdA, adminPersonIdA,
    randomUUID(), institutionIdA, studentPersonIdA,
  ]);

  // Seed Academic Year
  await client.query(`
    INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status) VALUES
    ($1, $2, '2026/2027', '2026-09-01', '2027-06-30', 'active')
  `, [academicYearIdA, institutionIdA]);

  // Seed Enrollment Offer
  await client.query(`
    INSERT INTO enrollment_offers (id, institution_id, academic_year_id, name, code, status) VALUES
    ($1, $2, $3, '10º Ano - Ciências e Tecnologias', '10-CT-2026', 'active')
  `, [offerIdA, institutionIdA, academicYearIdA]);

  // Seed Enrollment Application
  await client.query(`
    INSERT INTO enrollment_applications (id, institution_id, student_person_id, academic_year_id, offer_id, status, created_by, updated_by) VALUES
    ($1, $2, $3, $4, $5, 'active', $6, $6)
  `, [enrollmentAppIdA, institutionIdA, studentPersonIdA, academicYearIdA, offerIdA, adminPersonIdA]);

  // Seed Synthetic Document
  await client.query(`
    INSERT INTO documents (id, institution_id, category, classification, status, created_by_person_id) VALUES
    ($1, $2, 'identity_proof', 'confidential', 'active', $3)
  `, [docIdA, institutionIdA, adminPersonIdA]);

  // Seed Document Version
  await client.query(`
    INSERT INTO document_versions (id, institution_id, document_id, version_number, mime_type, byte_size, sha256_hash, status, created_by_person_id) VALUES
    ($1, $2, $3, 1, 'application/pdf', 4096, $4, 'available', $5)
  `, [versionIdA, institutionIdA, docIdA, 'e'.repeat(64), adminPersonIdA]);

  // Seed Storage Reference
  await client.query(`
    INSERT INTO document_storage_references (id, institution_id, version_id, storage_provider, storage_bucket, storage_key, content_availability) VALUES
    ($1, $2, $3, 'local_uat', 'nexus-uat-documents-bucket', 'inst-a/bi_manuel_silva.pdf', 'available')
  `, [randomUUID(), institutionIdA, versionIdA]);
} finally {
  client.release();
}

const storageProvider = new LocalUatObjectStorageProvider(storageDir);
const storageBucket = 'nexus-uat-documents-bucket';
const malwareScanner = new LocalUatMalwareScanner();
const config = resolveDocumentsOperationalConfig({
  customStorageProvider: storageProvider,
});

const verificationWorker = new DocumentVerificationWorker({
  pool,
  storageProvider,
  malwareScanner,
  storageBucket,
  gcpProjectId: 'local-uat-project',
  trustedAuthority: {
    kind: 'trusted_system_worker',
    workerId: 'gate2-browser-worker',
    workerName: 'Gate 2 Browser Worker',
  },
});

const app = express();
app.use(express.json());

// Serve browser harness HTML at root
const harnessHtmlPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'gate2-browser-harness.html');
app.get('/', (_req, res) => {
  res.sendFile(harnessHtmlPath);
});

// Institutional auth middleware (Tenant A Admin)
const authMiddleware: any = (req: any, _res: any, next: any) => {
  req.institutionalContext = {
    institutionId: institutionIdA,
    personId: adminPersonIdA,
    role: 'institution_admin',
    membershipStatus: 'active',
  };
  next();
};

registerDocumentRoutes(app, {
  pool,
  requireAuth: authMiddleware,
  storageProvider,
  storageBucket,
  policyEngine: config.policyEngine!,
  retentionPolicyEngine: config.retentionPolicyEngine!,
  accessGrantTokenKey: config.accessGrantTokenKey!,
  deletionPseudonymizationKey: config.deletionPseudonymizationKey!,
  uploadPolicyConfig: config.uploadPolicyConfig!,
  verificationWorker,
  malwareScanner,
});

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`GATE2_BROWSER_SERVER_READY http://127.0.0.1:${port}`);
});

process.on('SIGTERM', async () => {
  server.close(async () => {
    const c = await pool.connect();
    await c.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`).catch(() => {});
    c.release();
    await pool.end();
    process.exit(0);
  });
});
