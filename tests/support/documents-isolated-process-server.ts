/**
 * Isolated Standalone Documents HTTP Process for Durability Proof
 * MISSION=DOCUMENTS-CLOSURE-P1-STORAGE-TRUTH-AND-ACCESS
 *
 * Runs as an independent Node child process with its own PID, fresh module state,
 * and empty in-memory metadata cache, connected to the same persistent PostgreSQL
 * test database and storage directory.
 */

import express from 'express';
import pg from 'pg';
import http from 'http';
import { verifyApprovedTestConnection } from '../../scripts/nexus-test-db-safety.mjs';
import { registerDocumentRoutes } from '../../src/modules/documents/document.controller.ts';
import { resolveDocumentsOperationalConfig } from '../../src/modules/documents/documents-runtime-config.ts';
import { LocalUatObjectStorageProvider } from '../../src/modules/documents/local-uat-storage-provider.ts';
import { LocalUatMalwareScanner } from '../../src/modules/documents/local-uat-malware-scanner.ts';
import { DocumentVerificationWorker } from '../../src/modules/documents/verification-worker.ts';

await verifyApprovedTestConnection();

const port = Number(process.env.CHILD_PORT || 3105);
const storageDir = process.env.CHILD_STORAGE_DIR;
const schema = process.env.CHILD_SCHEMA;
const institutionIdA = process.env.CHILD_INSTITUTION_ID_A;
const adminPersonIdA = process.env.CHILD_ADMIN_PERSON_ID_A;
const studentPersonIdA = process.env.CHILD_STUDENT_PERSON_ID_A;
const institutionIdB = process.env.CHILD_INSTITUTION_ID_B;
const adminPersonIdB = process.env.CHILD_ADMIN_PERSON_ID_B;

if (!storageDir || !schema || !institutionIdA || !adminPersonIdA) {
  console.error('Missing required environment variables for isolated server process');
  process.exit(1);
}

const quote = (val: string) => `"${val.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});

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
    workerId: 'p1-isolated-worker-01',
    workerName: 'P1 Isolated Verification Worker',
  },
});

const app = express();
app.use(express.json());

const authMiddleware: any = (req: any, _res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  if (authHeader === 'Bearer tenant-b-token') {
    req.institutionalContext = {
      institutionId: institutionIdB,
      personId: adminPersonIdB,
      role: 'institution_admin',
      membershipStatus: 'active',
    };
    return next();
  }
  if (authHeader === 'Bearer student-a-token') {
    req.institutionalContext = {
      institutionId: institutionIdA,
      personId: studentPersonIdA,
      role: 'student',
      membershipStatus: 'active',
    };
    return next();
  }
  // Default: Tenant A Admin
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
  // Emit JSON signal to stdout for parent test process
  const readyMessage = JSON.stringify({
    event: 'READY',
    pid: process.pid,
    port,
    schema,
    storageDir,
  });
  process.stdout.write(readyMessage + '\n');
});

const shutdown = async () => {
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
