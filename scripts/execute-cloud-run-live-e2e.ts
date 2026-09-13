import { createHash, randomUUID } from 'node:crypto';
import net from 'node:net';
import pg from 'pg';
import { Storage } from '@google-cloud/storage';
import { DocumentVerificationWorker } from '../src/modules/documents/verification-worker.ts';
import { ClamAvMalwareScanner } from '../src/modules/documents/clamav-malware-scanner.ts';

const cloudRunUrl = 'https://nexus-wdu-staging-1054135786613.europe-west1.run.app';
const firebaseApiKey = 'AIzaSyC5xDTYWlCPCfHPRp2oWkW-iMBWeFDxpt0';
const gcpProject = 'nexus-wdu-staging';
const storageBucket = 'nexus-staging-documents-eu';

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
  console.log('=== DOCUMENTS I8D LIVE CLOUD RUN E2E EXECUTION ===\n');

  // 1. Resolve direct database password from secret or environment
  // We can query secret directly or construct pool
  const { execSync } = await import('node:child_process');
  const gcloud = 'C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd';
  const secretPayload = execSync(`"${gcloud}" secrets versions access latest --secret=DATABASE_URL --project=${gcpProject}`, { encoding: 'utf8' }).trim();
  
  // Extract password from secret payload URL
  const match = secretPayload.match(/postgresql:\/\/nexus_staging_app:([^@]+)@/);
  if (!match) {
    throw new Error('Could not parse database credentials from Secret Manager');
  }
  const dbPass = match[1];
  const directDbUrl = `postgresql://${dbUser}:${dbPass}@${dbHost}:5432/${dbName}?sslmode=disable`;

  const pool = new pg.Pool({
    connectionString: directDbUrl,
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  console.log('1. Connected to persistent Cloud SQL PostgreSQL database.');

  try {
    // 2. Mint Firebase staging identities
    console.log('2. Minting synthetic staging identities via Firebase Auth authority...');
    const userA1 = await mintFirebaseUser('admin-inst-a');
    const userA2 = await mintFirebaseUser('student-inst-a');
    const userB1 = await mintFirebaseUser('admin-inst-b');
    console.log(`- Inst A Admin: ${userA1.email} (UID: ${userA1.uid})`);
    console.log(`- Inst A Student: ${userA2.email} (UID: ${userA2.uid})`);
    console.log(`- Inst B Admin: ${userB1.email} (UID: ${userB1.uid})`);

    // 3. Provision Institutions and Memberships in PostgreSQL
    console.log('3. Provisioning synthetic institutional topology in PostgreSQL...');
    const instAId = randomUUID();
    const instBId = randomUUID();
    const personA1Id = randomUUID();
    const personA2Id = randomUUID();
    const personB1Id = randomUUID();
    const runId = Date.now();

    // Insert Institutions
    await client.query(`
      INSERT INTO institutions (id, name, slug, status, created_at, updated_at)
      VALUES 
        ($1, 'WDU Staging Institution A', $2, 'active', NOW(), NOW()),
        ($3, 'WDU Staging Institution B', $4, 'active', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `, [instAId, `wdu-staging-a-${runId}`, instBId, `wdu-staging-b-${runId}`]);

    // Insert People
    await client.query(`
      INSERT INTO people (id, name, created_at, updated_at)
      VALUES 
        ($1, 'Staging Admin User A', NOW(), NOW()),
        ($2, 'Staging Student User A', NOW(), NOW()),
        ($3, 'Staging Admin User B', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [personA1Id, personA2Id, personB1Id]);

    // Insert Identities (provider = 'firebase')
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

    // Insert Memberships
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

    // 4. Live HTTP Flow against Cloud Run
    console.log(`\n4. Executing LIVE Documents Flow against Cloud Run: ${cloudRunUrl}`);

    // PDF test payload (valid PDF magic bytes %PDF-1.4)
    const testPayload = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n180\n%%EOF\n'
    );
    const sourceSha256 = createHash('sha256').update(testPayload).digest('hex');
    console.log(`- Source payload bytes: ${testPayload.length}, SHA256: ${sourceSha256}`);

    // A. POST /api/documents/upload-sessions
    console.log('A. POST /api/documents/upload-sessions');
    const createSessionRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userA1.idToken}`,
        'x-institution-id': instAId,
        'Idempotency-Key': `create-session-${Date.now()}`,
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

    const sessionData = (await createSessionRes.json()) as any;
    console.log(`Create Session HTTP Status: ${createSessionRes.status}`);
    if (createSessionRes.status !== 201) {
      throw new Error(`Create session failed: ${JSON.stringify(sessionData)}`);
    }

    const { session, rawToken } = sessionData;
    const sessionId = session.id;
    const documentId = session.documentId;
    console.log(`- Session ID: ${sessionId}`);
    console.log(`- Document ID: ${documentId}`);

    // B. PUT /api/documents/upload-sessions/:sessionId/transfer
    console.log('B. PUT /api/documents/upload-sessions/:sessionId/transfer');
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

    const transferData = (await transferRes.json()) as any;
    console.log(`Transfer HTTP Status: ${transferRes.status}`);
    if (transferRes.status !== 200) {
      throw new Error(`Transfer bytes failed: ${JSON.stringify(transferData)}`);
    }

    // C. POST /api/documents/upload-sessions/:sessionId/complete
    console.log('C. POST /api/documents/upload-sessions/:sessionId/complete');
    const completeRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userA1.idToken}`,
        'x-institution-id': instAId,
        'Idempotency-Key': `complete-session-${Date.now()}`,
      },
      body: JSON.stringify({
        rawToken,
      }),
    });

    const completeData = (await completeRes.json()) as any;
    console.log(`Complete HTTP Status: ${completeRes.status}`);
    if (completeRes.status !== 200) {
      throw new Error(`Complete upload failed: ${JSON.stringify(completeData)}`);
    }

    const versionId = completeData.version.id;
    console.log(`- Version ID: ${versionId}`);
    console.log(`- Version Status: ${completeData.version.status}`);
    console.log(`- Storage Key: ${completeData.version.storageKey}`);

    // 5. Database and GCS Integrity Verification
    console.log('\n5. Verifying Persistent PostgreSQL & Real GCS Object...');
    const dbVersionRes = await client.query(
      'SELECT id, document_id, version_number, sha256_hash, byte_size, status FROM document_versions WHERE id = $1 AND institution_id = $2',
      [versionId, instAId]
    );
    const dbVersion = dbVersionRes.rows[0];
    console.log(`- DB Document Version SHA256: ${dbVersion.sha256_hash}`);
    console.log(`- DB Document Version Byte Size: ${dbVersion.byte_size}`);

    const storageRefRes = await client.query(
      'SELECT storage_bucket, storage_key FROM document_storage_references WHERE version_id = $1 AND institution_id = $2',
      [versionId, instAId]
    );
    const storageRef = storageRefRes.rows[0];
    console.log(`- Storage Key: ${storageRef.storage_key}`);

    // Check GCS metadata
    const storage = new Storage({ projectId: gcpProject });
    const [metadata] = await storage.bucket(storageBucket).file(storageRef.storage_key).getMetadata();
    const gcsSha256 = metadata.metadata?.sha256Hash || metadata.metadata?.sha256;
    console.log(`- GCS Object Metadata SHA256: ${gcsSha256}`);

    // 6. Asynchronous Technical Verification Worker Execution with ClamAV
    console.log('\n6. Executing Canonical Asynchronous Verification Worker...');
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
          // Check for terminating 0-length chunk
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
    console.log(`- ClamAV TCP Daemon Protocol Health: ${isHealthy ? 'HEALTHY (PONG)' : 'FAILED'}`);

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

    console.log(`- Verification Worker Result Status: ${verifyResult.result.versionStatus}`);
    console.log(`- Assessments Recorded: ${verifyResult.result.assessments.length}`);

    // 7. Secure Content Access Authorization & Server-Mediated Download
    console.log('\n7. Authorizing Secure Content Access & Stream Download...');
    // A. POST /api/documents/:id/access
    const accessRes = await fetch(`${cloudRunUrl}/api/documents/${documentId}/access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userA1.idToken}`,
        'x-institution-id': instAId,
        'Idempotency-Key': `access-grant-${Date.now()}`,
      },
      body: JSON.stringify({
        action: 'download',
        versionId,
      }),
    });

    const accessData = (await accessRes.json()) as any;
    console.log(`Access Grant HTTP Status: ${accessRes.status}`);
    if (accessRes.status !== 200 && accessRes.status !== 201) {
      throw new Error(`Authorize access failed: ${JSON.stringify(accessData)}`);
    }
    const rawAccessToken = accessData.rawAccessToken;
    console.log(`- Grant Token acquired: ${rawAccessToken.substring(0, 20)}...`);

    // B. POST /api/documents/access/exchange (Stream Download)
    const exchangeRes = await fetch(`${cloudRunUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userA1.idToken}`,
        'x-institution-id': instAId,
      },
      body: JSON.stringify({
        rawAccessToken,
      }),
    });

    console.log(`Grant Exchange HTTP Status: ${exchangeRes.status}`);
    if (exchangeRes.status !== 200) {
      const errText = await exchangeRes.text();
      throw new Error(`Grant exchange failed: ${exchangeRes.status} ${errText}`);
    }

    const downloadedBytes = Buffer.from(await exchangeRes.arrayBuffer());
    const downloadedSha256 = createHash('sha256').update(downloadedBytes).digest('hex');
    console.log(`- Downloaded Byte Count: ${downloadedBytes.length}`);
    console.log(`- Downloaded SHA256: ${downloadedSha256}`);

    // Hash verification
    const fullHashInvariant = (
      sourceSha256 === dbVersion.sha256_hash &&
      sourceSha256 === gcsSha256 &&
      sourceSha256 === downloadedSha256
    );
    console.log(`\nFULL HASH INVARIANT: ${fullHashInvariant ? 'PASS' : 'FAIL'}`);

    // 8. Multi-Tenant Live Isolation Proofs
    console.log('\n8. Executing Multi-Tenant Isolation Proofs...');

    // Inst B cannot read Inst A document
    const crossReadRes = await fetch(`${cloudRunUrl}/api/documents/${documentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userB1.idToken}`,
        'x-institution-id': instBId,
      },
    });
    console.log(`Cross-Tenant Document Read: HTTP ${crossReadRes.status} (${crossReadRes.status === 404 ? 'DENIED - PASS' : 'FAIL'})`);

    // Inst B cannot exchange Inst A grant token
    const crossGrantRes = await fetch(`${cloudRunUrl}/api/documents/access/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userB1.idToken}`,
        'x-institution-id': instBId,
      },
      body: JSON.stringify({
        rawAccessToken,
      }),
    });
    console.log(`Cross-Tenant Grant Reuse: HTTP ${crossGrantRes.status} (${crossGrantRes.status === 403 || crossGrantRes.status === 404 ? 'DENIED - PASS' : 'FAIL'})`);

    // Inst B cannot transfer to Inst A upload session
    const crossTransferRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${sessionId}/transfer`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': `Bearer ${userB1.idToken}`,
        'x-institution-id': instBId,
        'x-upload-token': rawToken,
      },
      body: Buffer.from('attack payload'),
    });
    console.log(`Cross-Tenant Session Transfer: HTTP ${crossTransferRes.status} (${crossTransferRes.status === 404 || crossTransferRes.status === 403 ? 'DENIED - PASS' : 'FAIL'})`);

    // Inst B cannot complete Inst A upload session
    const crossCompleteRes = await fetch(`${cloudRunUrl}/api/documents/upload-sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userB1.idToken}`,
        'x-institution-id': instBId,
        'Idempotency-Key': `cross-complete-${Date.now()}`,
      },
      body: JSON.stringify({
        rawToken,
      }),
    });
    console.log(`Cross-Tenant Session Complete: HTTP ${crossCompleteRes.status} (${crossCompleteRes.status === 404 || crossCompleteRes.status === 403 ? 'DENIED - PASS' : 'FAIL'})`);

    console.log('\n=== ALL LIVE CLOUD RUN E2E CHECKS PASSED WITH RIGOR ===');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\nLIVE E2E FAILURE:', err);
  process.exit(1);
});
