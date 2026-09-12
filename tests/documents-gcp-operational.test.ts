import { strict as assert } from 'node:assert';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import express from 'express';
import { GoogleCloudStorageObjectProvider } from '../src/modules/documents/google-cloud-storage-provider.ts';
import { resolveDocumentsOperationalConfig } from '../src/modules/documents/documents-runtime-config.ts';
import { registerDocumentRoutes } from '../src/modules/documents/document.controller.ts';
import { generateOpaqueStorageKey } from '../src/modules/documents/document-upload-model.ts';
import { FakeGcsStorageClient } from './support/fake-gcs-storage-client.ts';
import type { AuthRequest } from '../src/middleware/auth.ts';

const BUCKET = 'nexus-prod-documents-eu';

async function run() {
  console.log('=== START DOCUMENTS GCP OPERATIONAL TESTS ===');

  const fakeClient = new FakeGcsStorageClient();
  const provider = new GoogleCloudStorageObjectProvider({
    client: fakeClient,
    defaultBucket: BUCKET,
    projectId: 'nexus-wdu-prod',
  });

  // TEST 0: Real SDK instantiated when no custom storageClient is injected
  console.log('[TEST 0] PRODUCTION_CONFIG_WITH_BUCKET -> Real SDK-backed client object instantiated...');
  const realSdkProvider = new GoogleCloudStorageObjectProvider({
    projectId: 'nexus-wdu-prod',
    defaultBucket: BUCKET,
  });
  assert.equal(realSdkProvider.providerName, 'google_cloud_storage');
  assert.ok((realSdkProvider as any).client, 'Real client instance must be created inside provider');
  assert.equal(typeof (realSdkProvider as any).client.bucket, 'function', 'client must implement GcsStorageClientLike');

  const autoRuntimeConfig = resolveDocumentsOperationalConfig({
    env: {
      GOOGLE_CLOUD_PROJECT: 'nexus-wdu-prod',
      DOCUMENTS_STORAGE_BUCKET: BUCKET,
    },
  });
  assert.ok(autoRuntimeConfig.storageProvider, 'storageProvider must be instantiated in runtime without injected fake client');
  assert.equal(autoRuntimeConfig.storageProvider?.providerName, 'google_cloud_storage');

  // TEST 1: WRITE_STREAM & SHA-256 verification
  console.log('[TEST 1] WRITE_STREAM...');
  const testPayload = Buffer.from('Hello, Google Cloud Storage Documents Foundation!');
  const expectedHash = createHash('sha256').update(testPayload).digest('hex');
  const storageKey1 = 'inst_123/doc_456/session_789/test-obj-1';

  const writeResult = await provider.writeObjectStream({
    storageBucket: BUCKET,
    storageKey: storageKey1,
    stream: Readable.from(testPayload),
    declaredByteSize: testPayload.length,
    mimeType: 'text/plain',
  });

  assert.equal(writeResult.byteSize, testPayload.length, 'Byte size must match stream length');
  assert.equal(writeResult.sha256Hash, expectedHash, 'SHA-256 hash must be accurately computed');
  assert.equal(writeResult.mimeType, 'text/plain');

  // TEST 1B: WRITE_STREAM size mismatch fail-closed & cleanup
  console.log('[TEST 1B] WRITE_STREAM size mismatch rejection & cleanup...');
  const mismatchKey = 'inst_123/doc_456/session_789/mismatch-obj';
  await assert.rejects(
    async () => {
      await provider.writeObjectStream({
        storageBucket: BUCKET,
        storageKey: mismatchKey,
        stream: Readable.from(testPayload),
        declaredByteSize: testPayload.length + 50, // Intentional mismatch
        mimeType: 'text/plain',
      });
    },
    /SIZE_MISMATCH/,
    'Must fail closed and throw SIZE_MISMATCH when declared size does not match stream payload',
  );

  const mismatchHead = await provider.headObject({
    storageBucket: BUCKET,
    storageKey: mismatchKey,
  });
  assert.equal(mismatchHead.exists, false, 'No committed object may remain after size mismatch');

  // TEST 2: HEAD_OBJECT & COMPLETE_UPLOAD SHA-256 Roundtrip
  console.log('[TEST 2] HEAD_OBJECT & COMPLETE_UPLOAD SHA-256 Roundtrip...');
  const headResult = await provider.headObject({
    storageBucket: BUCKET,
    storageKey: storageKey1,
  });

  assert.equal(headResult.exists, true, 'Object must exist');
  assert.equal(headResult.storageProvider, 'google_cloud_storage');
  assert.equal(headResult.byteSize, testPayload.length);
  assert.equal(headResult.sha256Hash, expectedHash, 'SHA-256 hash must survive storage round-trip into headObject');
  assert.equal(headResult.mimeType, 'text/plain');

  const completeResult = await provider.completeUpload({
    storageBucket: BUCKET,
    storageKey: storageKey1,
  });
  assert.equal(completeResult.sha256Hash, expectedHash, 'SHA-256 hash must survive into completeUpload metadata');

  // Explicit GCS_SHA256_ROUNDTRIP invariant verification
  assert.equal(
    expectedHash,
    writeResult.sha256Hash,
    'source payload hash == writeResult.sha256Hash',
  );
  assert.equal(
    writeResult.sha256Hash,
    headResult.sha256Hash,
    'writeResult.sha256Hash == headObject.sha256Hash',
  );
  assert.equal(
    headResult.sha256Hash,
    completeResult.sha256Hash,
    'headObject.sha256Hash == completeUpload.sha256Hash',
  );
  console.log('GCS_SHA256_ROUNDTRIP=PASS');

  const headNonExistent = await provider.headObject({
    storageBucket: BUCKET,
    storageKey: 'non-existent-key',
  });
  assert.equal(headNonExistent.exists, false, 'Non-existent object exists property must be false');

  // TEST 3: READ_STREAM
  console.log('[TEST 3] READ_STREAM...');
  const readStream = await provider.openReadStream({
    storageBucket: BUCKET,
    storageKey: storageKey1,
  });

  const readChunks: Buffer[] = [];
  for await (const chunk of readStream) {
    readChunks.push(Buffer.from(chunk));
  }
  const fullReadBuffer = Buffer.concat(readChunks);
  assert.equal(fullReadBuffer.toString('utf8'), testPayload.toString('utf8'));

  // TEST 4: READ_RANGE
  console.log('[TEST 4] READ_RANGE...');
  const rangeBuffer = await provider.readRange({
    storageBucket: BUCKET,
    storageKey: storageKey1,
    startByte: 0,
    endByte: 4, // 'Hello'
  });
  assert.equal(rangeBuffer.toString('utf8'), 'Hello');

  // TEST 5: DELETE_OBJECT (Committed content deletion)
  console.log('[TEST 5] DELETE_OBJECT...');
  const deleteResult = await provider.deleteObject({
    storageBucket: BUCKET,
    storageKey: storageKey1,
  });
  assert.equal(deleteResult.deleted, true, 'deleteObject must report deleted=true');

  const headAfterDelete = await provider.headObject({
    storageBucket: BUCKET,
    storageKey: storageKey1,
  });
  assert.equal(headAfterDelete.exists, false, 'Object must be deleted from storage');

  // Non-existent deletion reports deleted: false with errorCode
  const deleteMissing = await provider.deleteObject({
    storageBucket: BUCKET,
    storageKey: 'never-existed-key',
  });
  assert.equal(deleteMissing.deleted, false);
  assert.equal(deleteMissing.errorCode, 'OBJECT_NOT_FOUND');

  // TEST 6: DELETE_UNCOMMITTED (Abort cleanup)
  console.log('[TEST 6] DELETE_UNCOMMITTED...');
  const storageKeyUncommitted = 'inst_123/doc_456/session_999/uncommitted-obj';
  await provider.writeObjectStream({
    storageBucket: BUCKET,
    storageKey: storageKeyUncommitted,
    stream: Readable.from(Buffer.from('Uncommitted temporary content')),
    mimeType: 'application/octet-stream',
  });

  const uncommittedDeleted = await provider.deleteUncommittedObject({
    storageBucket: BUCKET,
    storageKey: storageKeyUncommitted,
  });
  assert.equal(uncommittedDeleted, true);

  // Deleting already deleted/non-existent uncommitted object succeeds silently
  const uncommittedMissing = await provider.deleteUncommittedObject({
    storageBucket: BUCKET,
    storageKey: storageKeyUncommitted,
  });
  assert.equal(uncommittedMissing, true);

  // TEST 7: TENANT_KEY_PRESERVED
  console.log('[TEST 7] TENANT_KEY_PRESERVED...');
  const institutionId = randomUUID();
  const documentId = randomUUID();
  const sessionId = randomUUID();
  const objectId = randomUUID();

  const generatedKey = generateOpaqueStorageKey({
    institutionId,
    documentId,
    sessionId,
    objectId,
  });

  assert.equal(
    generatedKey,
    `inst_${institutionId}/doc_${documentId}/session_${sessionId}/${objectId}`,
    'Storage key must preserve canonical tenant namespace structure',
  );

  // TEST 8: NO_BUCKET_FROM_BROWSER & NO_CREDENTIAL_EXPOSURE
  console.log('[TEST 8] NO_BUCKET_FROM_BROWSER & NO_CREDENTIAL_EXPOSURE...');
  const uploadAuth = await provider.createUploadAuthorization({
    storageBucket: BUCKET,
    storageKey: generatedKey,
    declaredByteSize: 1024,
    declaredMimeType: 'application/pdf',
    expiresInSeconds: 900,
  });

  assert.equal(uploadAuth.storageProvider, 'google_cloud_storage');
  assert.equal(uploadAuth.storageBucket, BUCKET);
  assert.equal(uploadAuth.uploadUrl, undefined, 'Server-mediated streaming does not expose raw direct URL');
  assert.equal(uploadAuth.headers, undefined, 'No storage access credentials exposed');

  // TEST 9: CONFIG_RESOLVER & FAIL-CLOSED CHECKS
  console.log('[TEST 9] CONFIG_RESOLVER & FAIL-CLOSED CHECKS...');
  
  // 9A: Empty environment -> All null
  const emptyConfig = resolveDocumentsOperationalConfig({ env: {} });
  assert.equal(emptyConfig.storageProvider, null);
  assert.equal(emptyConfig.storageBucket, null);
  assert.equal(emptyConfig.uploadPolicyConfig, null);
  assert.equal(emptyConfig.accessGrantTokenKey, null);
  assert.equal(emptyConfig.deletionPseudonymizationKey, null);

  // 9B: Short secret (< 32 chars) -> Rejected fail-closed
  const shortSecretConfig = resolveDocumentsOperationalConfig({
    env: {
      DOCUMENTS_ACCESS_GRANT_TOKEN_KEY: 'too-short',
      DOCUMENTS_DELETION_PSEUDONYMIZATION_KEY: 'also-too-short',
      DOCUMENTS_STORAGE_BUCKET: BUCKET,
    },
  });
  assert.equal(shortSecretConfig.accessGrantTokenKey, null, 'Short access secret must fail closed');
  assert.equal(shortSecretConfig.deletionPseudonymizationKey, null, 'Short deletion secret must fail closed');

  // 9C: Full valid configuration
  const validSecretA = 'a'.repeat(32);
  const validSecretB = 'b'.repeat(32);
  const fullConfig = resolveDocumentsOperationalConfig({
    env: {
      GOOGLE_CLOUD_PROJECT: 'nexus-wdu-prod',
      DOCUMENTS_STORAGE_BUCKET: BUCKET,
      DOCUMENTS_ACCESS_GRANT_TOKEN_KEY: validSecretA,
      DOCUMENTS_DELETION_PSEUDONYMIZATION_KEY: validSecretB,
      DOCUMENTS_GLOBAL_MAX_BYTE_SIZE: '10485760', // 10MB
      DOCUMENTS_INSTITUTION_MAX_BYTE_SIZE: '5242880', // 5MB
    },
    storageClient: fakeClient,
  });

  assert.notEqual(fullConfig.storageProvider, null);
  assert.equal(fullConfig.storageBucket, BUCKET);
  assert.equal(fullConfig.uploadPolicyConfig?.globalMaxByteSize, 10485760);
  assert.equal(fullConfig.uploadPolicyConfig?.institutionMaxByteSize, 5242880);
  assert.equal(fullConfig.accessGrantTokenKey, validSecretA);
  assert.equal(fullConfig.deletionPseudonymizationKey, validSecretB);

  // TEST 10: ROUTE_WIRING_INTEGRATION
  console.log('[TEST 10] ROUTE_WIRING_INTEGRATION...');
  const app = express();
  app.use(express.json());

  // Mock auth middleware for test
  const mockAuth = (req: AuthRequest, res: any, next: any) => {
    req.institutionalContext = {
      personId: 'person_test',
      personName: 'Test User',
      identityEmail: 'test@nexus.local',
      membershipId: 'membership_test',
      institutionId: 'inst_test',
      institutionName: 'Test School',
      institutionSlug: 'test-school',
      role: 'director',
    };
    next();
  };

  registerDocumentRoutes(app, {
    requireAuth: mockAuth as any,
    ...fullConfig,
  });

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const metaRes = await fetch(`${baseUrl}/api/documents/metadata`);
    assert.equal(metaRes.status, 200);
    const metadata = await metaRes.json();

    assert.equal(metadata.operationalAvailability.canUpload, true, 'canUpload must be true when bucket and upload policy are configured');
    assert.equal(metadata.operationalAvailability.canAccess, false, 'canAccess is false when policyEngine is null');
    assert.equal(metadata.operationalAvailability.canHold, false, 'canHold is false when retentionPolicyEngine is null');
    assert.equal(metadata.operationalAvailability.canDelete, false, 'canDelete is false when retentionPolicyEngine is null');
    console.log('[TEST 10] Metadata availability response verified:', metadata.operationalAvailability);
  } finally {
    server.close();
  }

  console.log('=== ALL DOCUMENTS GCP OPERATIONAL TESTS PASSED ===');
}

run().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
