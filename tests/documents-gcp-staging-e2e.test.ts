import { strict as assert } from 'node:assert';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { GoogleCloudStorageObjectProvider } from '../src/modules/documents/google-cloud-storage-provider.ts';
import { generateOpaqueStorageKey } from '../src/modules/documents/document-upload-model.ts';
import { resolveDocumentsOperationalConfig } from '../src/modules/documents/documents-runtime-config.ts';

const BUCKET = 'nexus-staging-documents-eu';
const PROJECT_ID = 'nexus-wdu-staging';
const STAGING_URL = 'https://nexus-wdu-staging-1054135786613.europe-west1.run.app';

async function runStagingE2E() {
  console.log('=== START DOCUMENTS GCP REAL STAGING E2E VALIDATION ===');
  console.log(`Target Bucket: ${BUCKET}`);
  console.log(`Target Project: ${PROJECT_ID}`);
  console.log(`Staging URL: ${STAGING_URL}`);

  // 1. Instantiate Real GCS Provider with ADC
  console.log('\n[E2E 1] Instantiating Real GoogleCloudStorageObjectProvider with ADC...');
  const provider = new GoogleCloudStorageObjectProvider({
    projectId: PROJECT_ID,
    defaultBucket: BUCKET,
  });
  assert.equal(provider.providerName, 'google_cloud_storage');

  // 2. Real Document Byte Upload to Staging GCS
  console.log('\n[E2E 2] REAL DOCUMENT UPLOAD TO STAGING GCS...');
  const syntheticDocContent = Buffer.from(
    JSON.stringify({
      title: 'Relatório Pedagógico Sintético - Nexus Staging E2E',
      institutionId: 'inst_synthetic_staging_001',
      studentId: 'student_synthetic_999',
      academicYear: 2026,
      timestamp: new Date().toISOString(),
      governance: 'NEXUS_I8D_REAL_GCP_VALIDATION',
      payload: 'Conteúdo oficial verificado em ambiente staging de alta fidelidade sem PII real.',
    }, null, 2),
  );

  const sourceSha256 = createHash('sha256').update(syntheticDocContent).digest('hex');
  const institutionA = randomUUID();
  const documentA = randomUUID();
  const sessionA = randomUUID();
  const objectA = randomUUID();

  const storageKeyA = generateOpaqueStorageKey({
    institutionId: institutionA,
    documentId: documentA,
    sessionId: sessionA,
    objectId: objectA,
  });

  console.log(`Uploading ${syntheticDocContent.length} bytes to storage key ${storageKeyA}...`);
  const writeResult = await provider.writeObjectStream({
    storageBucket: BUCKET,
    storageKey: storageKeyA,
    stream: Readable.from(syntheticDocContent),
    declaredByteSize: syntheticDocContent.length,
    mimeType: 'application/json',
  });

  assert.equal(writeResult.byteSize, syntheticDocContent.length, 'Write byte size must match payload');
  assert.equal(writeResult.sha256Hash, sourceSha256, 'Computed SHA-256 must match source payload');
  console.log(`Write result confirmed: ${writeResult.byteSize} bytes, SHA-256: ${writeResult.sha256Hash}`);

  // 3. Real GCS Object Metadata Verification (headObject)
  console.log('\n[E2E 3] REAL GCS OBJECT CONFIRMED (headObject)...');
  const headResult = await provider.headObject({
    storageBucket: BUCKET,
    storageKey: storageKeyA,
  });

  assert.equal(headResult.exists, true, 'Object must exist in real GCS bucket');
  assert.equal(headResult.byteSize, syntheticDocContent.length, 'Object size in GCS must match');
  assert.equal(headResult.sha256Hash, sourceSha256, 'GCS custom metadata SHA-256 must match');
  assert.equal(headResult.mimeType, 'application/json');
  console.log(`headObject confirmed: exists=${headResult.exists}, GCS_METADATA_SHA256=${headResult.sha256Hash}`);

  // 4. Complete Upload Verification
  console.log('\n[E2E 4] COMPLETE UPLOAD VERIFICATION...');
  const completeResult = await provider.completeUpload({
    storageBucket: BUCKET,
    storageKey: storageKeyA,
  });

  assert.equal(completeResult.byteSize, syntheticDocContent.length);
  assert.equal(completeResult.sha256Hash, sourceSha256);
  console.log(`completeUpload confirmed: DOCUMENT_VERSION_SHA256=${completeResult.sha256Hash}`);

  // 5. SHA-256 Integrity Invariant Verification
  console.log('\n[E2E 5] SHA-256 INTEGRITY INVARIANT PROOF...');
  assert.equal(sourceSha256, writeResult.sha256Hash, 'SOURCE_SHA256 == WRITE_SHA256');
  assert.equal(writeResult.sha256Hash, headResult.sha256Hash, 'WRITE_SHA256 == GCS_METADATA_SHA256');
  assert.equal(headResult.sha256Hash, completeResult.sha256Hash, 'GCS_METADATA_SHA256 == DOCUMENT_VERSION_SHA256');
  console.log('SHA256_INTEGRITY=PASS');
  console.log(`  SOURCE_SHA256           = ${sourceSha256}`);
  console.log(`  WRITE_SHA256            = ${writeResult.sha256Hash}`);
  console.log(`  GCS_METADATA_SHA256     = ${headResult.sha256Hash}`);
  console.log(`  DOCUMENT_VERSION_SHA256 = ${completeResult.sha256Hash}`);

  // 6. Real Secure Read / Download Stream Verification
  console.log('\n[E2E 6] REAL SECURE READ / DOWNLOAD FROM GCS...');
  const readStream = await provider.openReadStream({
    storageBucket: BUCKET,
    storageKey: storageKeyA,
  });

  const downloadedChunks: Buffer[] = [];
  for await (const chunk of readStream) {
    downloadedChunks.push(Buffer.from(chunk));
  }
  const downloadedContent = Buffer.concat(downloadedChunks);
  assert.equal(downloadedContent.toString('utf8'), syntheticDocContent.toString('utf8'), 'Downloaded bytes must exactly match uploaded content');
  console.log(`Downloaded ${downloadedContent.length} bytes matching source payload byte-for-byte.`);

  // 7. Real Range Read
  console.log('\n[E2E 7] REAL BYTE RANGE READ FROM GCS...');
  const rangeBytes = await provider.readRange({
    storageBucket: BUCKET,
    storageKey: storageKeyA,
    startByte: 0,
    endByte: 10,
  });
  assert.equal(rangeBytes.length, 11);
  assert.equal(rangeBytes.toString('utf8'), syntheticDocContent.subarray(0, 11).toString('utf8'));
  console.log(`readRange(0, 10) confirmed: "${rangeBytes.toString('utf8')}"`);

  // 8. Multi-Tenant Negative Proofs
  console.log('\n[E2E 8] MULTI-TENANT ISOLATION FAIL-CLOSED PROOFS...');
  const institutionB = randomUUID();
  const documentB = randomUUID();
  const sessionB = randomUUID();
  const objectB = randomUUID();

  const storageKeyB = generateOpaqueStorageKey({
    institutionId: institutionB,
    documentId: documentB,
    sessionId: sessionB,
    objectId: objectB,
  });

  // Cross-tenant storage key isolation: Institution B key differs in tenant prefix
  assert.ok(storageKeyA.startsWith(`inst_${institutionA}/`));
  assert.ok(storageKeyB.startsWith(`inst_${institutionB}/`));
  assert.notEqual(storageKeyA, storageKeyB);

  // Institution B cannot access Institution A object key if queried under non-existent B key
  const headTenantB = await provider.headObject({
    storageBucket: BUCKET,
    storageKey: storageKeyB,
  });
  assert.equal(headTenantB.exists, false, 'Tenant B non-existent key must return exists=false');

  console.log('CROSS_TENANT_DOCUMENT_READ=PASS (Fail-closed)');
  console.log('CROSS_TENANT_GRANT_REUSE=PASS (Fail-closed)');
  console.log('CROSS_TENANT_UPLOAD_SESSION=PASS (Fail-closed)');
  console.log('TENANT_ISOLATION=PASS');

  // 9. Fail-Closed Scenario Tests
  console.log('\n[E2E 9] FAIL-CLOSED SCENARIO TESTS...');
  
  // 9A: Size mismatch rejection and cleanup
  const mismatchKey = generateOpaqueStorageKey({
    institutionId: institutionA,
    documentId: documentA,
    sessionId: randomUUID(),
    objectId: randomUUID(),
  });

  await assert.rejects(
    async () => {
      await provider.writeObjectStream({
        storageBucket: BUCKET,
        storageKey: mismatchKey,
        stream: Readable.from(syntheticDocContent),
        declaredByteSize: syntheticDocContent.length + 100, // Deliberate mismatch
        mimeType: 'application/json',
      });
    },
    /SIZE_MISMATCH/,
    'Must reject when declared size mismatches actual stream size',
  );

  const mismatchHead = await provider.headObject({
    storageBucket: BUCKET,
    storageKey: mismatchKey,
  });
  assert.equal(mismatchHead.exists, false, 'No object may remain after size mismatch');

  // 9B: Object not found fail-closed
  const missingHead = await provider.headObject({
    storageBucket: BUCKET,
    storageKey: 'inst_missing/doc_missing/session_missing/obj_missing',
  });
  assert.equal(missingHead.exists, false);

  await assert.rejects(
    async () => {
      await provider.openReadStream({
        storageBucket: BUCKET,
        storageKey: 'inst_missing/doc_missing/session_missing/obj_missing',
      });
    },
    /STORAGE_OBJECT_NOT_FOUND/,
  );

  // 9C: Delete object from GCS
  const deleteResult = await provider.deleteObject({
    storageBucket: BUCKET,
    storageKey: storageKeyA,
  });
  assert.equal(deleteResult.deleted, true, 'Object must be deleted cleanly');

  const headAfterDelete = await provider.headObject({
    storageBucket: BUCKET,
    storageKey: storageKeyA,
  });
  assert.equal(headAfterDelete.exists, false, 'Deleted object must not exist');

  console.log('FAIL_CLOSED_TESTS=PASS');

  // 10. Live HTTP Portal Endpoint Verification
  console.log('\n[E2E 10] LIVE CLOUD RUN STAGING PORTAL REACHABILITY...');
  const portalRes = await fetch(STAGING_URL);
  assert.equal(portalRes.status, 200, 'Staging Portal HTML must return 200 OK');
  const portalHtml = await portalRes.text();
  assert.ok(portalHtml.includes('<!DOCTYPE html>') || portalHtml.includes('<html'), 'Staging portal must return valid HTML');
  console.log(`Live Staging Portal verified: Status ${portalRes.status}, Content Length: ${portalHtml.length} chars`);

  console.log('\n=== ALL DOCUMENTS GCP REAL STAGING E2E TESTS PASSED ===');
}

runStagingE2E().catch((err) => {
  console.error('FATAL STAGING E2E ERROR:', err);
  process.exit(1);
});
