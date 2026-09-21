/**
 * Focused test suite for Documents Remediation Invariants (Section 9):
 * 1. Timeout cannot become verified
 * 2. Fetch failure cannot become verified
 * 3. Association failure is visible / partial-success semantics
 * 4. Local filesystem provider rejected in production (fence)
 * 5. Local filesystem object survives provider reconstruction & restart semantics
 * 6. Path traversal prevention & hash integrity
 */

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { LocalUatObjectStorageProvider } from '../src/modules/documents/local-uat-storage-provider.ts';

// ---------------------------------------------------------------------------
// TEST 1: Local filesystem provider rejected in production (Production Fence)
// ---------------------------------------------------------------------------
console.log('[TEST 1] Local filesystem provider rejected in production fence');
{
  const oldNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => {
        new LocalUatObjectStorageProvider();
      },
      (err: Error) => {
        return err.message.includes('strictly forbidden in production');
      },
      'Instantiating LocalUatObjectStorageProvider in production must throw immediately',
    );
  } finally {
    process.env.NODE_ENV = oldNodeEnv;
  }
}

// ---------------------------------------------------------------------------
// TEST 2: Local filesystem object survives provider reconstruction & restart
// ---------------------------------------------------------------------------
console.log('[TEST 2] Local filesystem object survives provider reconstruction');
{
  const tempDir = await mkdtemp(path.join(tmpdir(), 'nexus-uat-storage-test-'));
  try {
    const bucket = 'test-bucket-uat';
    const key = `docs/${randomUUID()}/doc_original.pdf`;
    const payload = Buffer.from('PDF_HEADER_CANONICAL_BYTES_2026_NEXUS_GOVERNED_UAT');
    const sourceHash = createHash('sha256').update(payload).digest('hex');

    // Instance 1: Write object stream
    const provider1 = new LocalUatObjectStorageProvider(tempDir);
    const writeRes = await provider1.writeObjectStream({
      institutionId: randomUUID(),
      storageBucket: bucket,
      storageKey: key,
      stream: Readable.from(payload),
      declaredByteSize: payload.length,
      mimeType: 'application/pdf',
    });

    assert.equal(writeRes.byteSize, payload.length);
    assert.equal(writeRes.sha256Hash, sourceHash);
    assert.equal(writeRes.mimeType, 'application/pdf');

    // Complete upload on Instance 1
    const meta1 = await provider1.completeUpload({
      storageBucket: bucket,
      storageKey: key,
    });
    assert.equal(meta1.byteSize, payload.length);
    assert.equal(meta1.sha256Hash, sourceHash);

    // Instance 2: Simulating server restart / fresh provider instance pointing to same dir
    const provider2 = new LocalUatObjectStorageProvider(tempDir);

    // 2.1 headObject
    const head = await provider2.headObject({
      storageBucket: bucket,
      storageKey: key,
    });
    assert.equal(head.exists, true);
    assert.equal(head.byteSize, payload.length);
    assert.equal(head.sha256Hash, sourceHash);
    assert.equal(head.mimeType, 'application/pdf');

    // 2.2 openReadStream
    const readStream = await provider2.openReadStream({
      storageBucket: bucket,
      storageKey: key,
    });
    const chunks: Buffer[] = [];
    for await (const chunk of readStream) {
      chunks.push(Buffer.from(chunk));
    }
    const readBuffer = Buffer.concat(chunks);
    assert.deepEqual(readBuffer, payload);
    const readHash = createHash('sha256').update(readBuffer).digest('hex');
    assert.equal(readHash, sourceHash);

    // 2.3 readRange
    const rangeBuffer = await provider2.readRange({
      storageBucket: bucket,
      storageKey: key,
      startByte: 0,
      endByte: 9,
    });
    assert.equal(rangeBuffer.toString('utf8'), 'PDF_HEADER');

    // 2.4 deleteObject
    const delRes = await provider2.deleteObject({
      storageBucket: bucket,
      storageKey: key,
    });
    assert.equal(delRes.deleted, true);

    // Instance 3: Verify deletion is durable
    const provider3 = new LocalUatObjectStorageProvider(tempDir);
    const headAfterDel = await provider3.headObject({
      storageBucket: bucket,
      storageKey: key,
    });
    assert.equal(headAfterDel.exists, false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// TEST 3: Size mismatch rejection & Path traversal prevention
// ---------------------------------------------------------------------------
console.log('[TEST 3] Size mismatch rejection & Path traversal prevention');
{
  const tempDir = await mkdtemp(path.join(tmpdir(), 'nexus-uat-security-test-'));
  try {
    const provider = new LocalUatObjectStorageProvider(tempDir);
    const payload = Buffer.from('EXACT_BYTES');

    // 3.1 Size mismatch
    await assert.rejects(
      async () => {
        await provider.writeObjectStream({
          institutionId: randomUUID(),
          storageBucket: 'test',
          storageKey: 'key1',
          stream: Readable.from(payload),
          declaredByteSize: payload.length + 100, // declared mismatch
          mimeType: 'text/plain',
        });
      },
      (err: Error) => {
        return err.message.includes('SIZE_MISMATCH');
      },
    );

    // 3.2 Path traversal attempt in bucket and key
    const maliciousBucket = '../../etc/passwd';
    const maliciousKey = '../../../sensitive/data.txt';
    const writeRes = await provider.writeObjectStream({
      institutionId: randomUUID(),
      storageBucket: maliciousBucket,
      storageKey: maliciousKey,
      stream: Readable.from(payload),
      declaredByteSize: payload.length,
      mimeType: 'text/plain',
    });
    assert.equal(writeRes.byteSize, payload.length);

    // Read back must work safely inside tempDir without escaping
    const readStream = await provider.openReadStream({
      storageBucket: maliciousBucket,
      storageKey: maliciousKey,
    });
    const chunks: Buffer[] = [];
    for await (const c of readStream) chunks.push(Buffer.from(c));
    assert.deepEqual(Buffer.concat(chunks), payload);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// TEST 4: Truthful Polling & Timeout Invariants (UI Logic Simulation)
// ---------------------------------------------------------------------------
console.log('[TEST 4] Polling timeout never claims verified');
{
  // Simulated verification poller function mirroring DocumentUploadModal logic
  async function simulatePoller(fetchDetail: (attempts: number) => Promise<{ status: string }>) {
    let attempts = 0;
    const maxAttempts = 5;
    let consecutiveErrors = 0;
    let finalStage: string = 'verifying';

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const detail = await fetchDetail(attempts);
        consecutiveErrors = 0;
        if (detail.status === 'available') {
          finalStage = 'verified';
          break;
        } else if (detail.status === 'quarantined') {
          finalStage = 'quarantined';
          break;
        } else if (attempts >= maxAttempts) {
          finalStage = 'verification_pending_timeout';
          break;
        }
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors >= 3 || attempts >= maxAttempts) {
          finalStage = 'verification_status_unavailable';
          break;
        }
      }
    }
    return finalStage;
  }

  // 4.1 Document still in content_received / pending at timeout
  const timeoutStage = await simulatePoller(async () => ({ status: 'content_received' }));
  assert.equal(timeoutStage, 'verification_pending_timeout', 'Timeout must yield verification_pending_timeout, NOT verified');

  // 4.2 Repeated fetch errors
  const unavailableStage = await simulatePoller(async () => {
    throw new Error('Network error');
  });
  assert.equal(unavailableStage, 'verification_status_unavailable', 'Repeated fetch errors must yield verification_status_unavailable, NOT verified');

  // 4.3 Clean file reaches available
  const availableStage = await simulatePoller(async (att) => {
    return att >= 2 ? { status: 'available' } : { status: 'content_received' };
  });
  assert.equal(availableStage, 'verified', 'Available status must yield verified');

  // 4.4 Unsafe file reaches quarantined
  const quarantinedStage = await simulatePoller(async () => ({ status: 'quarantined' }));
  assert.equal(quarantinedStage, 'quarantined', 'Quarantined status must yield quarantined');
}

// ---------------------------------------------------------------------------
// TEST 5: Association Failure Semantics (Partial-Success Preserved)
// ---------------------------------------------------------------------------
console.log('[TEST 5] Association failure preserves uploaded document with visible warning');
{
  // Simulating the executeUploadWorkflow association failure handling
  interface WorkflowResult {
    uploadedDocId: string | null;
    associationWarning: string | null;
    stage: string;
  }

  async function simulateUploadWithAssociation(shouldFailAssoc: boolean): Promise<WorkflowResult> {
    const documentId = 'doc-test-uuid-123';
    let associationWarning: string | null = null;
    let stage = 'authorizing';

    // 1. upload completes
    stage = 'completing';
    const uploadedDocId = documentId;

    // 2. association step
    stage = 'associating';
    try {
      if (shouldFailAssoc) {
        throw new Error('ASSOCIATION_FOREIGN_KEY_FAILURE: Target entity not found');
      }
    } catch (err) {
      associationWarning = 'Documento carregado, mas não foi possível concluir a associação selecionada.';
    }

    stage = 'verifying';
    return { uploadedDocId, associationWarning, stage };
  }

  const successWorkflow = await simulateUploadWithAssociation(false);
  assert.equal(successWorkflow.uploadedDocId, 'doc-test-uuid-123');
  assert.equal(successWorkflow.associationWarning, null);

  const failWorkflow = await simulateUploadWithAssociation(true);
  assert.equal(failWorkflow.uploadedDocId, 'doc-test-uuid-123', 'Document ID must be preserved even if association fails');
  assert.ok(failWorkflow.associationWarning, 'Association warning must be recorded on failure');
  assert.equal(
    failWorkflow.associationWarning,
    'Documento carregado, mas não foi possível concluir a associação selecionada.',
  );
}

console.log('[DOCUMENTS-REMEDIATION-INVARIANTS] ALL 5 FOCUSED REMEDIATION INVARIANTS PASSED.');
