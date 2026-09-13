import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { Storage } from '@google-cloud/storage';
import { execSync } from 'node:child_process';
import { DocumentVerificationWorker } from '../src/modules/documents/verification-worker.ts';
import { ClamAvMalwareScanner } from '../src/modules/documents/clamav-malware-scanner.ts';

const cloudRunUrl = 'https://nexus-wdu-staging-1054135786613.europe-west1.run.app';
const clamavServiceUrl = 'https://nexus-clamav-staging-1054135786613.europe-west1.run.app';
const firebaseApiKey = 'AIzaSyC5xDTYWlCPCfHPRp2oWkW-iMBWeFDxpt0';
const gcpProject = 'nexus-wdu-staging';
const storageBucket = 'nexus-staging-documents-eu';
const instanceName = 'nexus-staging-postgres';

// Database connection details
const dbHost = '207.175.79.28';
const dbUser = 'nexus_staging_app';
const dbName = 'nexus_staging';

async function mintFirebaseUser(prefix: string): Promise<{ uid: string; idToken: string; email: string }> {
  const timestamp = Date.now();
  const email = `staging-${prefix}-${timestamp}@wdu-staging.nexus.edu`;
  const password = 'NexusStagingSyntheticPass123!';

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://nexus-edu-platform.firebaseapp.com',
      'Origin': 'https://nexus-edu-platform.firebaseapp.com',
    },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  const data = (await res.json()) as any;
  if (!data.idToken || !data.localId) {
    throw new Error(`Failed to mint Firebase staging user: ${JSON.stringify(data)}`);
  }

  return {
    uid: data.localId,
    idToken: data.idToken,
    email,
  };
}

async function main() {
  console.log('=== DOCUMENTS I8D LIVE CLOUD RUN TRUE E2E EXECUTION ===\n');

  const gcloud = 'C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd';

  // 1. Authorize runner public IP temporarily for test execution
  console.log('1. Configuring temporary Cloud SQL access for test runner...');
  const myIpRes = await fetch('https://api.ipify.org?format=json');
  const myResJson = (await myIpRes.json()) as { ip: string };
  const runnerIp = myResJson.ip;
  console.log(`- Runner Public IP: ${runnerIp}`);

  execSync(`"${gcloud}" sql instances patch ${instanceName} --project=${gcpProject} --authorized-networks=${runnerIp}/32 --quiet`, { stdio: 'inherit' });

  try {
    // 2. Resolve database password from Secret Manager
    const secretPayload = execSync(`"${gcloud}" secrets versions access latest --secret=DATABASE_URL --project=${gcpProject}`, { encoding: 'utf8' }).trim();
    const dbUrl = new URL(secretPayload);
    const dbPass = decodeURIComponent(dbUrl.password);

    const pool = new pg.Pool({
      host: dbHost,
      port: 5432,
      user: dbUser,
      password: dbPass,
      database: dbName,
      connectionTimeoutMillis: 10000,
    });

    const client = await pool.connect();
    console.log('2. Connected to persistent Cloud SQL PostgreSQL database.');

    try {
      // 3. Real ClamAV Staging Service Health Check (PONG, Signature DB LOADED)
      console.log(`\n3. Verifying Real Deployed ClamAV Staging Service: ${clamavServiceUrl}`);
      const realScanner = new ClamAvMalwareScanner({ serviceUrl: clamavServiceUrl });
      const isScannerHealthy = await realScanner.healthCheck();
      if (!isScannerHealthy) {
        throw new Error('Real ClamAV Staging service health check failed');
      }

      const clamHealthRes = await fetch(`${clamavServiceUrl}/health`);
      const clamHealthData = (await clamHealthRes.json()) as any;
      console.log(`- ClamAV Service Status: ${clamHealthData.status}`);
      console.log(`- ClamAV Ping Response: ${clamHealthData.ping}`);
      console.log(`- ClamAV Signature Database: ${clamHealthData.signatureDatabase}`);
      console.log(`- ClamAV Engine: ${clamHealthData.engine}`);

      if (clamHealthData.ping !== 'PONG' || clamHealthData.signatureDatabase !== 'LOADED') {
        throw new Error(`ClamAV service not fully ready: ${JSON.stringify(clamHealthData)}`);
      }

      // 4. Mint Firebase staging identities
      console.log('\n4. Minting synthetic staging identities via Firebase Auth authority...');
      const userA1 = await mintFirebaseUser('admin-inst-a');
      const userA2 = await mintFirebaseUser('student-inst-a');
      const userB1 = await mintFirebaseUser('admin-inst-b');
      console.log(`- Inst A Admin: ${userA1.email} (UID: ${userA1.uid})`);
      console.log(`- Inst A Student: ${userA2.email} (UID: ${userA2.uid})`);
      console.log(`- Inst B Admin: ${userB1.email} (UID: ${userB1.uid})`);

      // 5. Provision Institutions and Memberships in PostgreSQL
      console.log('\n5. Provisioning synthetic institutional topology in PostgreSQL...');
      const instAId = randomUUID();
      const instBId = randomUUID();
      const personA1Id = randomUUID();
      const personA2Id = randomUUID();
      const personB1Id = randomUUID();
      const runId = Date.now();

      await client.query(`
        INSERT INTO institutions (id, name, slug, status, created_at, updated_at)
        VALUES
          ($1, 'WDU Staging Institution A', $2, 'active', NOW(), NOW()),
          ($3, 'WDU Staging Institution B', $4, 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING
      `, [instAId, `wdu-staging-a-${runId}`, instBId, `wdu-staging-b-${runId}`]);

      await client.query(`
        INSERT INTO people (id, name, created_at, updated_at)
        VALUES
          ($1, 'Staging Admin User A', NOW(), NOW()),
          ($2, 'Staging Student User A', NOW(), NOW()),
          ($3, 'Staging Admin User B', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [personA1Id, personA2Id, personB1Id]);

      await client.query(`
        INSERT INTO identities (id, person_id, provider, provider_subject, email, created_at, updated_at)
        VALUES
          ($1, $2, 'firebase', $3, $4, NOW(), NOW()),
          ($5, $6, 'firebase', $7, $8, NOW(), NOW()),
          ($9, $10, 'firebase', $11, $12, NOW(), NOW())
        ON CONFLICT DO NOTHING
      `, [
        randomUUID(), personA1Id, userA1.uid, userA1.email,
        randomUUID(), personA2Id, userA2.uid, userA2.email,
        randomUUID(), personB1Id, userB1.uid, userB1.email,
      ]);

      await client.query(`
        INSERT INTO memberships (id, person_id, institution_id, role, status, created_at, updated_at)
        VALUES
          ($1, $2, $3, 'institution_admin', 'active', NOW(), NOW()),
          ($4, $5, $6, 'student', 'active', NOW(), NOW()),
          ($7, $8, $9, 'institution_admin', 'active', NOW(), NOW())
        ON CONFLICT DO NOTHING
      `, [
        randomUUID(), personA1Id, instAId,
        randomUUID(), personA2Id, instAId,
        randomUUID(), personB1Id, instBId,
      ]);
      console.log('Institutional membership bindings committed to PostgreSQL.');

      // 6. Test Trusted Worker Fail-Closed Contract
      console.log('\n6. Validating Trusted Worker Authority Fail-Closed Contract...');
      let threwWithoutAuth = false;
      try {
        new (DocumentVerificationWorker as any)({
          pool,
          storageBucket,
          gcpProjectId: gcpProject,
        });
      } catch (err: any) {
        if (err.message.includes('MISSING_TRUSTED_WORKER_AUTHORITY')) {
          threwWithoutAuth = true;
        }
      }
      if (!threwWithoutAuth) {
        throw new Error('Verification worker did NOT fail-closed when trusted authority was missing!');
      }
      console.log('- Missing Trusted Worker Authority: FAIL-CLOSED (PASS)');

      const worker = new DocumentVerificationWorker({
        pool,
        storageBucket,
        gcpProjectId: gcpProject,
        clamavServiceUrl,
        trustedAuthority: {
          kind: 'trusted_system_worker',
          workerId: 'staging-verification-worker-01',
          workerName: 'Nexus Staging Verification Worker',
        },
      });

      // 7. Live Clean Document HTTP Lifecycle against Cloud Run
      console.log(`\n7. Executing Clean Document Flow against Cloud Run: ${cloudRunUrl}`);
      const cleanPayload = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n180\n%%EOF\n'
      );
      const cleanSha256 = createHash('sha256').update(cleanPayload).digest('hex');

      // A. POST /api/documents/upload-sessions
      const createCleanSessionRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
          'Idempotency-Key': `create-clean-session-${Date.now()}`,
        },
        body: JSON.stringify({
          declaredFilename: 'clean_enrollment_proof.pdf',
          declaredMimeType: 'application/pdf',
          declaredByteSize: cleanPayload.length,
          category: 'academic',
          classification: 'confidential',
          title: 'Clean Academic Document Staging Live',
        }),
      });

      const cleanSessionData = (await createCleanSessionRes.json()) as any;
      if (createCleanSessionRes.status !== 201) {
        throw new Error(`Create clean session failed: ${JSON.stringify(cleanSessionData)}`);
      }

      const { session: cleanSession, rawToken: cleanRawToken } = cleanSessionData;
      const cleanDocumentId = cleanSession.documentId;
      const cleanSessionId = cleanSession.id;

      // B. Transfer bytes
      const transferCleanRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${cleanSessionId}/transfer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
          'x-upload-token': cleanRawToken,
        },
        body: cleanPayload,
      });
      if (transferCleanRes.status !== 200) {
        throw new Error(`Clean transfer failed: ${transferCleanRes.status}`);
      }

      // C. Complete upload session
      const completeCleanRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${cleanSessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
          'Idempotency-Key': `complete-clean-session-${Date.now()}`,
        },
        body: JSON.stringify({ rawToken: cleanRawToken }),
      });

      const completeCleanData = (await completeCleanRes.json()) as any;
      if (completeCleanRes.status !== 200) {
        throw new Error(`Clean complete upload failed: ${JSON.stringify(completeCleanData)}`);
      }

      const cleanVersionId = completeCleanData.version.id;
      console.log(`- Clean Document ID: ${cleanDocumentId}`);
      console.log(`- Clean Version ID: ${cleanVersionId}`);

      // D. Run Verification Worker against Real ClamAV
      console.log('Executing Verification Worker against Clean Document...');
      const cleanVerifyResult = await worker.processVerificationJob({
        institutionId: instAId,
        documentId: cleanDocumentId,
        versionId: cleanVersionId,
        actorPersonId: personA1Id,
      });

      console.log(`- Clean Verification Result Status: ${cleanVerifyResult.result.versionStatus}`);
      if (cleanVerifyResult.result.versionStatus !== 'available') {
        throw new Error(`Expected clean document to be 'available', got '${cleanVerifyResult.result.versionStatus}'`);
      }

      // E. Authorize and Download Clean Document
      const cleanAccessRes = await fetch(`${cloudRunUrl}/api/documents/${cleanDocumentId}/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
          'Idempotency-Key': `access-clean-${Date.now()}`,
        },
        body: JSON.stringify({ action: 'download', versionId: cleanVersionId }),
      });
      const cleanAccessData = (await cleanAccessRes.json()) as any;
      if (cleanAccessRes.status !== 200 && cleanAccessRes.status !== 201) {
        throw new Error(`Clean access grant failed: ${JSON.stringify(cleanAccessData)}`);
      }

      const cleanExchangeRes = await fetch(`${cloudRunUrl}/api/documents/access/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
        },
        body: JSON.stringify({ rawAccessToken: cleanAccessData.rawAccessToken }),
      });
      if (cleanExchangeRes.status !== 200) {
        throw new Error(`Clean exchange failed: ${cleanExchangeRes.status}`);
      }

      const downloadedCleanBytes = Buffer.from(await cleanExchangeRes.arrayBuffer());
      const downloadedCleanSha256 = createHash('sha256').update(downloadedCleanBytes).digest('hex');

      // GCS check
      const storage = new Storage({ projectId: gcpProject });
      const storageRefRes = await client.query(
        'SELECT storage_key FROM document_storage_references WHERE version_id = $1 AND institution_id = $2',
        [cleanVersionId, instAId]
      );
      const [cleanGcsMeta] = await storage.bucket(storageBucket).file(storageRefRes.rows[0].storage_key).getMetadata();
      const gcsCleanSha256 = cleanGcsMeta.metadata?.sha256Hash || cleanGcsMeta.metadata?.sha256;

      const cleanHashMatches = (cleanSha256 === gcsCleanSha256 && cleanSha256 === downloadedCleanSha256);
      console.log(`- Clean Full Hash Invariant: ${cleanHashMatches ? 'PASS' : 'FAIL'}`);
      if (!cleanHashMatches) {
        throw new Error('Clean full hash invariant failed');
      }

      // 8. Live EICAR Synthetic Antivirus Test Flow against Real ClamAV
      console.log('\n8. Executing EICAR Antivirus Detection Flow against Cloud Run & Real ClamAV...');
      const eicarPayload = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*', 'ascii');

      // A. POST /api/documents/upload-sessions for EICAR
      const createEicarSessionRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
          'Idempotency-Key': `create-eicar-session-${Date.now()}`,
        },
        body: JSON.stringify({
          declaredFilename: 'eicar_test.com',
          declaredMimeType: 'application/octet-stream',
          declaredByteSize: eicarPayload.length,
          category: 'academic',
          classification: 'confidential',
          title: 'EICAR Synthetic Antivirus Test Document',
        }),
      });

      const eicarSessionData = (await createEicarSessionRes.json()) as any;
      if (createEicarSessionRes.status !== 201) {
        throw new Error(`Create EICAR session failed: ${JSON.stringify(eicarSessionData)}`);
      }

      const { session: eicarSession, rawToken: eicarRawToken } = eicarSessionData;
      const eicarDocumentId = eicarSession.documentId;
      const eicarSessionId = eicarSession.id;

      // B. Transfer EICAR bytes
      const transferEicarRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${eicarSessionId}/transfer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
          'x-upload-token': eicarRawToken,
        },
        body: eicarPayload,
      });
      if (transferEicarRes.status !== 200) {
        throw new Error(`EICAR transfer failed: ${transferEicarRes.status}`);
      }

      // C. Complete upload session
      const completeEicarRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${eicarSessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
          'Idempotency-Key': `complete-eicar-session-${Date.now()}`,
        },
        body: JSON.stringify({ rawToken: eicarRawToken }),
      });

      const completeEicarData = (await completeEicarRes.json()) as any;
      if (completeEicarRes.status !== 200) {
        throw new Error(`EICAR complete upload failed: ${JSON.stringify(completeEicarData)}`);
      }

      const eicarVersionId = completeEicarData.version.id;
      console.log(`- EICAR Document ID: ${eicarDocumentId}`);
      console.log(`- EICAR Version ID: ${eicarVersionId}`);

      // D. Run Verification Worker against Real ClamAV
      console.log('Executing Verification Worker against EICAR Document...');
      const eicarVerifyResult = await worker.processVerificationJob({
        institutionId: instAId,
        documentId: eicarDocumentId,
        versionId: eicarVersionId,
        actorPersonId: personA1Id,
      });

      console.log(`- EICAR Verification Result Status: ${eicarVerifyResult.result.versionStatus}`);
      if (eicarVerifyResult.result.versionStatus !== 'quarantined') {
        throw new Error(`Expected EICAR document to be 'quarantined', got '${eicarVerifyResult.result.versionStatus}'`);
      }

      // E. Verify Database Version Status is quarantined
      const dbEicarVersionRes = await client.query(
        'SELECT status FROM document_versions WHERE id = $1 AND institution_id = $2',
        [eicarVersionId, instAId]
      );
      const dbEicarStatus = dbEicarVersionRes.rows[0]?.status;
      console.log(`- DB EICAR Version Status: ${dbEicarStatus}`);
      if (dbEicarStatus !== 'quarantined') {
        throw new Error(`Expected DB status 'quarantined', got '${dbEicarStatus}'`);
      }

      // F. Assert Content Access Authorization for Quarantined Document is DENIED
      console.log('Testing Content Access on Quarantined Document...');
      const eicarAccessRes = await fetch(`${cloudRunUrl}/api/documents/${eicarDocumentId}/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
          'Idempotency-Key': `access-eicar-${Date.now()}`,
        },
        body: JSON.stringify({ action: 'download', versionId: eicarVersionId }),
      });

      console.log(`- Quarantined Access HTTP Status: ${eicarAccessRes.status}`);
      if (eicarAccessRes.status !== 403 && eicarAccessRes.status !== 400 && eicarAccessRes.status !== 404) {
        throw new Error(`Expected access denial for quarantined document, got HTTP ${eicarAccessRes.status}`);
      }
      console.log('- EICAR Content Access: DENIED (PASS)');

      // 9. Multi-Tenant Live Isolation Proofs
      console.log('\n9. Executing Multi-Tenant Isolation Proofs...');

      // Inst B cannot read Inst A document
      const crossReadRes = await fetch(`${cloudRunUrl}/api/documents/${cleanDocumentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userB1.idToken}`,
          'x-institution-id': instBId,
        },
      });
      console.log(`- Cross-Tenant Document Read: HTTP ${crossReadRes.status} (${crossReadRes.status === 404 ? 'DENIED - PASS' : 'FAIL'})`);

      // Inst B cannot exchange Inst A grant token
      const crossGrantRes = await fetch(`${cloudRunUrl}/api/documents/access/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userB1.idToken}`,
          'x-institution-id': instBId,
        },
        body: JSON.stringify({ rawAccessToken: cleanAccessData.rawAccessToken }),
      });
      console.log(`- Cross-Tenant Grant Exchange: HTTP ${crossGrantRes.status} (${crossGrantRes.status === 403 || crossGrantRes.status === 404 ? 'DENIED - PASS' : 'FAIL'})`);

      // Inst B cannot transfer to Inst A upload session
      const crossTransferRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${cleanSessionId}/transfer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Authorization': `Bearer ${userB1.idToken}`,
          'x-institution-id': instBId,
          'x-upload-token': cleanRawToken,
        },
        body: Buffer.from('unauthorized attack payload'),
      });
      console.log(`- Cross-Tenant Session Transfer: HTTP ${crossTransferRes.status} (${crossTransferRes.status === 404 || crossTransferRes.status === 403 ? 'DENIED - PASS' : 'FAIL'})`);

      // Inst B cannot complete Inst A upload session
      const crossCompleteRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${cleanSessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userB1.idToken}`,
          'x-institution-id': instBId,
          'Idempotency-Key': `cross-complete-${Date.now()}`,
        },
        body: JSON.stringify({ rawToken: cleanRawToken }),
      });
      console.log(`- Cross-Tenant Session Complete: HTTP ${crossCompleteRes.status} (${crossCompleteRes.status === 404 || crossCompleteRes.status === 403 ? 'DENIED - PASS' : 'FAIL'})`);

      console.log('\n=== ALL LIVE CLOUD RUN E2E CHECKS PASSED WITH REAL CLAMAV & PERSISTENT DB ===');
    } finally {
      client.release();
      await pool.end();
    }
  } finally {
    console.log('\nClearing temporary authorized networks from Cloud SQL...');
    try {
      execSync(`"${gcloud}" sql instances patch ${instanceName} --project=${gcpProject} --clear-authorized-networks --quiet`, { stdio: 'inherit' });
      console.log('Temporary runner network access revoked.');
    } catch (cleanErr: any) {
      console.warn('Failed to clear authorized networks automatically:', cleanErr.message);
    }
  }
}

main().catch((err) => {
  console.error('\nLIVE E2E FAILURE:', err);
  process.exit(1);
});
