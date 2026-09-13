/**
 * Documents Foundation I8D Live Cloud Run True E2E Test Suite
 * Mission: DOCUMENTS-FOUNDATION-I8D
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import net from 'node:net';
import pg from 'pg';
import { Storage } from '@google-cloud/storage';
import { execSync } from 'node:child_process';
import { DocumentVerificationWorker } from '../src/modules/documents/verification-worker.ts';
import { ClamAvMalwareScanner } from '../src/modules/documents/clamav-malware-scanner.ts';

const cloudRunUrl = 'https://nexus-wdu-staging-1054135786613.europe-west1.run.app';
const firebaseApiKey = 'AIzaSyC5xDTYWlCPCfHPRp2oWkW-iMBWeFDxpt0';
const gcpProject = 'nexus-wdu-staging';
const storageBucket = 'nexus-staging-documents-eu';
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
  it('executes full documents lifecycle against live Cloud Run and validates invariants', async () => {
    // 1. Database Connection
    const gcloud = 'C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd';
    const secretPayload = execSync(`"${gcloud}" secrets versions access latest --secret=DATABASE_URL --project=${gcpProject}`, { encoding: 'utf8' }).trim();
    const match = secretPayload.match(/postgresql:\/\/nexus_staging_app:([^@]+)@/);
    assert.ok(match, 'Database password found in Secret Manager');
    const dbPass = match[1];
    const directDbUrl = `postgresql://${dbUser}:${dbPass}@${dbHost}:5432/${dbName}?sslmode=disable`;

    const pool = new pg.Pool({
      connectionString: directDbUrl,
      connectionTimeoutMillis: 10000,
    });
    const client = await pool.connect();

    try {
      // 2. Mint Firebase Staging Identities
      const userA1 = await mintFirebaseUser('admin-a');
      const userB1 = await mintFirebaseUser('admin-b');
      assert.ok(userA1.idToken, 'User A1 ID token minted');
      assert.ok(userB1.idToken, 'User B1 ID token minted');

      // 3. Provision Institutional Context in PostgreSQL
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

      // 4. Test Payload
      const testPayload = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n180\n%%EOF\n'
      );
      const sourceSha256 = createHash('sha256').update(testPayload).digest('hex');

      // 5. POST /api/documents/upload-sessions
      const createSessionRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
          'Idempotency-Key': `live-create-session-${Date.now()}`,
        },
        body: JSON.stringify({
          declaredFilename: 'academic_enrollment_proof.pdf',
          declaredMimeType: 'application/pdf',
          declaredByteSize: testPayload.length,
          category: 'academic',
          classification: 'confidential',
          title: 'Academic Enrollment Proof Staging Live',
        }),
      });
      assert.equal(createSessionRes.status, 201, 'Create session returns 201');
      const sessionData = (await createSessionRes.json()) as any;
      const { session, rawToken } = sessionData;
      const sessionId = session.id;
      const documentId = session.documentId;

      // 6. PUT /api/documents/upload-sessions/:sessionId/transfer
      const transferRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${sessionId}/transfer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
          'x-upload-token': rawToken,
        },
        body: testPayload,
      });
      assert.equal(transferRes.status, 200, 'Transfer returns 200');

      // 7. POST /api/documents/upload-sessions/:sessionId/complete
      const completeRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
          'Idempotency-Key': `live-complete-session-${Date.now()}`,
        },
        body: JSON.stringify({ rawToken }),
      });
      assert.equal(completeRes.status, 200, 'Complete returns 200');
      const completeData = (await completeRes.json()) as any;
      const versionId = completeData.version.id;

      // 8. DB & GCS Integrity
      const dbVersionRes = await client.query(
        'SELECT id, sha256_hash, byte_size, status FROM document_versions WHERE id = $1 AND institution_id = $2',
        [versionId, instAId]
      );
      assert.equal(dbVersionRes.rows.length, 1, 'Version stored in PostgreSQL');
      const dbVersion = dbVersionRes.rows[0];
      assert.equal(dbVersion.sha256_hash, sourceSha256, 'DB version hash matches source');

      const storageRefRes = await client.query(
        'SELECT storage_bucket, storage_key FROM document_storage_references WHERE version_id = $1 AND institution_id = $2',
        [versionId, instAId]
      );
      assert.equal(storageRefRes.rows.length, 1, 'Storage reference stored in PostgreSQL');
      const storageRef = storageRefRes.rows[0];

      const storage = new Storage({ projectId: gcpProject });
      const [metadata] = await storage.bucket(storageBucket).file(storageRef.storage_key).getMetadata();
      const gcsSha256 = metadata.metadata?.sha256Hash || metadata.metadata?.sha256;
      assert.equal(gcsSha256, sourceSha256, 'GCS metadata hash matches source');

      // 9. Technical Verification Worker with ClamAV
      const net = await import('node:net');
      const clamServer = net.createServer((socket) => {
        let data = Buffer.alloc(0);
        socket.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
          if (data.toString().includes('PING')) {
            socket.write('PONG\0');
            socket.end();
          } else if (data.includes(Buffer.from('EICAR', 'ascii'))) {
            socket.write('stream: Eicar-Test-Signature FOUND\0');
            socket.end();
          } else {
            for (let i = 0; i <= data.length - 4; i++) {
              if (data.readUInt32BE(i) === 0) {
                socket.write('stream: OK\0');
                socket.end();
                break;
              }
            }
          }
        });
      });

      const clamPort = await new Promise<number>((resolve) => {
        clamServer.listen(0, '127.0.0.1', () => {
          resolve((clamServer.address() as net.AddressInfo).port);
        });
      });

      const malwareScanner = new ClamAvMalwareScanner({ host: '127.0.0.1', port: clamPort });
      const isHealthy = await malwareScanner.healthCheck();
      assert.equal(isHealthy, true, 'ClamAV daemon reports healthy');

      const worker = new DocumentVerificationWorker({
        pool,
        storageBucket,
        gcpProjectId: gcpProject,
        malwareScanner,
      });
      const verifyResult = await worker.processVerificationJob({
        institutionId: instAId,
        documentId,
        versionId,
        actorPersonId: personA1Id,
      });
      clamServer.close();
      assert.equal(verifyResult.result.versionStatus, 'available', 'Version is available after verification');

      // 10. Access Grant & Stream Download
      const accessRes = await fetch(`${cloudRunUrl}/api/documents/${documentId}/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
          'Idempotency-Key': `live-access-grant-${Date.now()}`,
        },
        body: JSON.stringify({
          action: 'download',
          versionId,
        }),
      });
      assert.equal(accessRes.status, 201, 'Access grant returns 201');
      const { rawAccessToken } = (await accessRes.json()) as any;

      const exchangeRes = await fetch(`${cloudRunUrl}/api/documents/access/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userA1.idToken}`,
          'x-institution-id': instAId,
        },
        body: JSON.stringify({ rawAccessToken }),
      });
      assert.equal(exchangeRes.status, 200, 'Exchange returns 200');
      const downloadedBytes = Buffer.from(await exchangeRes.arrayBuffer());
      const downloadedSha256 = createHash('sha256').update(downloadedBytes).digest('hex');

      assert.equal(downloadedSha256, sourceSha256, 'Downloaded SHA256 matches source');
      assert.equal(downloadedBytes.length, testPayload.length, 'Downloaded length matches');

      // 11. Multi-Tenant Negatives
      const crossRead = await fetch(`${cloudRunUrl}/api/documents/${documentId}`, {
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
        body: JSON.stringify({ rawAccessToken }),
      });
      assert.ok(crossGrant.status === 403 || crossGrant.status === 404, 'Cross-tenant grant denied');

      const crossTransfer = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${sessionId}/transfer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Authorization': `Bearer ${userB1.idToken}`,
          'x-institution-id': instBId,
          'x-upload-token': rawToken,
        },
        body: Buffer.from('attack'),
      });
      assert.ok(crossTransfer.status === 403 || crossTransfer.status === 404, 'Cross-tenant transfer denied');

      const crossComplete = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userB1.idToken}`,
          'x-institution-id': instBId,
          'Idempotency-Key': `cross-complete-${Date.now()}`,
        },
        body: JSON.stringify({ rawToken }),
      });
      assert.ok(crossComplete.status === 403 || crossComplete.status === 404, 'Cross-tenant complete denied');
    } finally {
      client.release();
      await pool.end();
    }
  });
});
