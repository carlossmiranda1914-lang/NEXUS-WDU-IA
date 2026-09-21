/**
 * Documents Foundation I8D Live Cloud Run True E2E Test Suite
 * Mission: DOCUMENTS-FOUNDATION-I8D
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

describe('Live Cloud Run True E2E Acceptance Suite (I8D)', () => {
  it('executes full documents lifecycle against live Cloud Run and validates invariants with real ClamAV', async () => {
    const gcloud = 'C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd';

    // 1. Authorize runner public IP temporarily for test execution
    const myIpRes = await fetch('https://api.ipify.org?format=json');
    const myResJson = (await myIpRes.json()) as { ip: string };
    const runnerIp = myResJson.ip;

    execSync(`"${gcloud}" sql instances patch ${instanceName} --project=${gcpProject} --authorized-networks=${runnerIp}/32 --quiet`, { stdio: 'inherit' });

    try {
      // 2. Database Connection
      const secretPayload = execSync(`"${gcloud}" secrets versions access latest --secret=DATABASE_URL --project=${gcpProject}`, { encoding: 'utf8' }).trim();
      const dbUrl = new URL(secretPayload);
      const dbPass = decodeURIComponent(dbUrl.password);
      assert.ok(dbPass, 'Database password found in Secret Manager');

      const pool = new pg.Pool({
        host: dbHost,
        port: 5432,
        user: dbUser,
        password: dbPass,
        database: dbName,
        connectionTimeoutMillis: 10000,
      });
      const client = await pool.connect();

      try {
        // 3. Private ClamAV Access Control & Authenticated Scanner Checks
        const unauthScanRes = await fetch(`${clamavServiceUrl}/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: Buffer.from('test unauthenticated scan payload'),
        });
        assert.equal(unauthScanRes.status, 403, 'Unauthenticated ClamAV /scan must be DENIED with HTTP 403');

        const unauthHealthRes = await fetch(`${clamavServiceUrl}/health`);
        assert.equal(unauthHealthRes.status, 403, 'Unauthenticated ClamAV /health must be DENIED with HTTP 403');

        const realScanner = new ClamAvMalwareScanner({ serviceUrl: clamavServiceUrl });
        const isHealthy = await realScanner.healthCheck();
        assert.equal(isHealthy, true, 'Authorized ClamAV scanner reports healthy via IAM token');

        // 4. Mint Firebase Staging Identities
        const userA1 = await mintFirebaseUser('admin-a');
        const userB1 = await mintFirebaseUser('admin-b');
        assert.ok(userA1.idToken, 'User A1 ID token minted');
        assert.ok(userB1.idToken, 'User B1 ID token minted');

        // 5. Provision Institutional Context in PostgreSQL
        const instAId = randomUUID();
        const instBId = randomUUID();
        const personA1Id = randomUUID();
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
            ($2, 'Staging Admin User B', NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [personA1Id, personB1Id]);

        await client.query(`
          INSERT INTO identities (id, person_id, provider, provider_subject, email, created_at, updated_at)
          VALUES
            ($1, $2, 'firebase', $3, $4, NOW(), NOW()),
            ($5, $6, 'firebase', $7, $8, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [
          randomUUID(), personA1Id, userA1.uid, userA1.email,
          randomUUID(), personB1Id, userB1.uid, userB1.email,
        ]);

        await client.query(`
          INSERT INTO memberships (id, person_id, institution_id, role, status, created_at, updated_at)
          VALUES
            ($1, $2, $3, 'institution_admin', 'active', NOW(), NOW()),
            ($4, $5, $6, 'institution_admin', 'active', NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [
          randomUUID(), personA1Id, instAId,
          randomUUID(), personB1Id, instBId,
        ]);

        // 6. Trusted Worker Fail-Closed Contract Verification
        assert.throws(
          () => {
            new (DocumentVerificationWorker as any)({
              pool,
              storageBucket,
              gcpProjectId: gcpProject,
            });
          },
          /MISSING_TRUSTED_WORKER_AUTHORITY/,
          'Verification worker must fail closed without trusted authority'
        );

        // 7. Clean Document Flow with Autonomous Deployed Verification
        const cleanPayload = Buffer.from(
          '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n180\n%%EOF\n'
        );
        const cleanSha256 = createHash('sha256').update(cleanPayload).digest('hex');

        const createCleanRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userA1.idToken}`,
            'x-institution-id': instAId,
            'Idempotency-Key': `test-create-clean-${Date.now()}`,
          },
          body: JSON.stringify({
            declaredFilename: 'academic_proof.pdf',
            declaredMimeType: 'application/pdf',
            declaredByteSize: cleanPayload.length,
            category: 'academic',
            classification: 'confidential',
            title: 'Live Clean Academic Proof',
          }),
        });
        assert.equal(createCleanRes.status, 201, 'Clean session created');
        const { session: cleanSession, rawToken: cleanRawToken } = (await createCleanRes.json()) as any;

        const transferCleanRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${cleanSession.id}/transfer`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Authorization': `Bearer ${userA1.idToken}`,
            'x-institution-id': instAId,
            'x-upload-token': cleanRawToken,
          },
          body: cleanPayload,
        });
        assert.equal(transferCleanRes.status, 200, 'Clean transfer successful');

        const completeCleanRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${cleanSession.id}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userA1.idToken}`,
            'x-institution-id': instAId,
            'Idempotency-Key': `test-complete-clean-${Date.now()}`,
          },
          body: JSON.stringify({ rawToken: cleanRawToken }),
        });
        assert.equal(completeCleanRes.status, 200, 'Clean complete successful');
        const { version: cleanVersion } = (await completeCleanRes.json()) as any;

        // Poll for autonomous verification by deployed worker (NO manual worker invocation)
        let cleanStatus = 'content_received';
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const verRes = await client.query(
            'SELECT status FROM document_versions WHERE id = $1 AND institution_id = $2',
            [cleanVersion.id, instAId]
          );
          cleanStatus = verRes.rows[0]?.status;
          if (cleanStatus === 'available') break;
        }
        assert.equal(cleanStatus, 'available', 'Deployed worker automatically verified clean document as available');

        // Access grant and download
        const cleanAccessRes = await fetch(`${cloudRunUrl}/api/documents/${cleanSession.documentId}/access`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userA1.idToken}`,
            'x-institution-id': instAId,
            'Idempotency-Key': `test-access-clean-${Date.now()}`,
          },
          body: JSON.stringify({ action: 'download', versionId: cleanVersion.id }),
        });
        assert.equal(cleanAccessRes.status, 201, 'Clean access grant returns 201');
        const { rawAccessToken: cleanAccessToken } = (await cleanAccessRes.json()) as any;

        const cleanExchangeRes = await fetch(`${cloudRunUrl}/api/documents/access/exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userA1.idToken}`,
            'x-institution-id': instAId,
          },
          body: JSON.stringify({ rawAccessToken: cleanAccessToken }),
        });
        assert.equal(cleanExchangeRes.status, 200, 'Clean exchange returns 200');
        const downloadedCleanBytes = Buffer.from(await cleanExchangeRes.arrayBuffer());
        const downloadedCleanSha256 = createHash('sha256').update(downloadedCleanBytes).digest('hex');
        assert.equal(downloadedCleanSha256, cleanSha256, 'Clean downloaded SHA256 matches source');

        // 8. EICAR Synthetic Antivirus Test Flow with Autonomous Deployed Verification
        const eicarPayload = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*', 'ascii');
        const createEicarRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userA1.idToken}`,
            'x-institution-id': instAId,
            'Idempotency-Key': `test-create-eicar-${Date.now()}`,
          },
          body: JSON.stringify({
            declaredFilename: 'eicar_test.com',
            declaredMimeType: 'application/octet-stream',
            declaredByteSize: eicarPayload.length,
            category: 'academic',
            classification: 'confidential',
            title: 'EICAR Test Document',
          }),
        });
        assert.equal(createEicarRes.status, 201, 'EICAR session created');
        const { session: eicarSession, rawToken: eicarRawToken } = (await createEicarRes.json()) as any;

        const transferEicarRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${eicarSession.id}/transfer`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Authorization': `Bearer ${userA1.idToken}`,
            'x-institution-id': instAId,
            'x-upload-token': eicarRawToken,
          },
          body: eicarPayload,
        });
        assert.equal(transferEicarRes.status, 200, 'EICAR transfer successful');

        const completeEicarRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${eicarSession.id}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userA1.idToken}`,
            'x-institution-id': instAId,
            'Idempotency-Key': `test-complete-eicar-${Date.now()}`,
          },
          body: JSON.stringify({ rawToken: eicarRawToken }),
        });
        assert.equal(completeEicarRes.status, 200, 'EICAR complete successful');
        const { version: eicarVersion } = (await completeEicarRes.json()) as any;

        // Poll for autonomous verification of EICAR document by deployed worker
        let eicarStatus = 'content_received';
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const verRes = await client.query(
            'SELECT status FROM document_versions WHERE id = $1 AND institution_id = $2',
            [eicarVersion.id, instAId]
          );
          eicarStatus = verRes.rows[0]?.status;
          if (eicarStatus === 'quarantined') break;
        }
        assert.equal(eicarStatus, 'quarantined', 'Deployed worker automatically quarantined EICAR document');

        // Check DB version status
        const dbEicarRes = await client.query(
          'SELECT status FROM document_versions WHERE id = $1 AND institution_id = $2',
          [eicarVersion.id, instAId]
        );
        assert.equal(dbEicarRes.rows[0]?.status, 'quarantined', 'DB version status is quarantined');

        // Assert Content Access is DENIED
        const eicarAccessRes = await fetch(`${cloudRunUrl}/api/documents/${eicarSession.documentId}/access`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userA1.idToken}`,
            'x-institution-id': instAId,
            'Idempotency-Key': `test-access-eicar-${Date.now()}`,
          },
          body: JSON.stringify({ action: 'download', versionId: eicarVersion.id }),
        });
        assert.ok(
          eicarAccessRes.status === 403 || eicarAccessRes.status === 400 || eicarAccessRes.status === 404 || eicarAccessRes.status === 422,
          `Content access to quarantined document must be denied (got ${eicarAccessRes.status})`
        );

        // 9. Multi-Tenant Negatives
        const crossRead = await fetch(`${cloudRunUrl}/api/documents/${cleanSession.documentId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${userB1.idToken}`,
            'x-institution-id': instBId,
          },
        });
        assert.equal(crossRead.status, 404, 'Cross-tenant read denied with 404');

        const crossGrant = await fetch(`${cloudRunUrl}/api/documents/access/exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userB1.idToken}`,
            'x-institution-id': instBId,
          },
          body: JSON.stringify({ rawAccessToken: cleanAccessToken }),
        });
        assert.ok(crossGrant.status === 403 || crossGrant.status === 404, 'Cross-tenant grant denied');

        const crossTransfer = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${cleanSession.id}/transfer`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Authorization': `Bearer ${userB1.idToken}`,
            'x-institution-id': instBId,
            'x-upload-token': cleanRawToken,
          },
          body: Buffer.from('attack'),
        });
        assert.ok(crossTransfer.status === 403 || crossTransfer.status === 404, 'Cross-tenant transfer denied');

        const crossComplete = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${cleanSession.id}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userB1.idToken}`,
            'x-institution-id': instBId,
            'Idempotency-Key': `cross-complete-${Date.now()}`,
          },
          body: JSON.stringify({ rawToken: cleanRawToken }),
        });
        assert.ok(crossComplete.status === 403 || crossComplete.status === 404, 'Cross-tenant complete denied');
      } finally {
        client.release();
        await pool.end();
      }
    } finally {
      execSync(`"${gcloud}" sql instances patch ${instanceName} --project=${gcpProject} --clear-authorized-networks --quiet`, { stdio: 'inherit' });
    }
  });
});
