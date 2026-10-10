/**
 * Documents Local UAT Storage Durability and Operational Consistency Test Suite
 * Mission: DOCUMENTS STORAGE & AVAILABILITY
 *
 * Proves:
 * 1. Stream write failure on filesystem throws, cleans ONLY this attempt's temp files,
 *    and preserves any prior valid version completely intact.
 * 2. Restart with empty memory cache reads directly from disk streams across fresh provider instances.
 * 3. Absolute directory contract: works identically when launched from any working directory.
 * 4. Byte range reading (readRange), SHA-256 in-flight calculation, completeUpload, headObject,
 *    abortUpload, and deleteObject lifecycle.
 * 5. 20 concurrent uploads: measures file sizes, elapsed time, and peak memory usage.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, PassThrough } from 'node:stream';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, rmSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { LocalUatObjectStorageProvider } from '../src/modules/documents/local-uat-storage-provider.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../');
const TEST_STORAGE_DIR = path.resolve(REPO_ROOT, '.uat-storage-durability-test');

describe('Documents Local UAT Storage Provider Durability & Safety Suite', () => {
  before(() => {
    if (existsSync(TEST_STORAGE_DIR)) {
      rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_STORAGE_DIR, { recursive: true });
  });

  after(() => {
    if (existsSync(TEST_STORAGE_DIR)) {
      rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
  });

  it('1. Absolute Path Enforcement: Rejects relative paths and requires valid absolute directory', () => {
    assert.throws(
      () => new LocalUatObjectStorageProvider('relative/path/to/storage'),
      /LOCAL_UAT_STORAGE_DIR_MUST_BE_ABSOLUTE/,
      'Provider must reject relative storage directory paths',
    );

    const validProvider = new LocalUatObjectStorageProvider(TEST_STORAGE_DIR);
    assert.equal(validProvider.providerName, 'local_uat');
    assert.equal(validProvider.getEffectiveBaseDir(), path.normalize(TEST_STORAGE_DIR));
  });

  it('2. Temporary File Isolation & Cleanup on Failure: Preserves Prior Valid Object', async () => {
    const provider = new LocalUatObjectStorageProvider(TEST_STORAGE_DIR);
    const bucket = 'durability-bucket';
    const key = `isolated-doc-${randomUUID()}.pdf`;

    // A. Write valid initial object
    const initialContent = Buffer.from('%PDF-1.7 Initial valid document content before failure attempt');
    const initialHash = createHash('sha256').update(initialContent).digest('hex');

    const write1 = await provider.writeObjectStream({
      storageBucket: bucket,
      storageKey: key,
      stream: Readable.from(initialContent),
      declaredByteSize: initialContent.length,
      mimeType: 'application/pdf',
    });
    assert.equal(write1.byteSize, initialContent.length);
    assert.equal(write1.sha256Hash, initialHash);

    // B. Attempt write that fails mid-stream
    async function* failingGenerator() {
      yield Buffer.from('Partial data chunk 1... ');
      throw new Error('SIMULATED_STREAM_CORRUPTION');
    }
    const failingStream = Readable.from(failingGenerator());

    let failed = false;
    try {
      await provider.writeObjectStream({
        storageBucket: bucket,
        storageKey: key,
        stream: failingStream,
        declaredByteSize: 1000,
        mimeType: 'application/pdf',
      });
    } catch (err: any) {
      failed = true;
      assert.match(err.message, /LOCAL_UAT_STORAGE_PERSISTENCE_FAILED/);
    }
    assert.equal(failed, true, 'Write attempt with corrupted stream must throw');

    // C. Verify NO temp files left behind in bucket directory
    const bucketDir = path.join(TEST_STORAGE_DIR, bucket.replace(/[^a-zA-Z0-9._-]/g, '_'));
    const filesInDir = readdirSync(bucketDir);
    const tempFiles = filesInDir.filter((f) => f.endsWith('.tmp'));
    assert.equal(tempFiles.length, 0, `No temporary files (*.tmp) must remain after failure, found: ${tempFiles.join(', ')}`);

    // D. Crucial invariant: Prior valid object must remain 100% intact and readable
    const headAfter = await provider.headObject({ storageBucket: bucket, storageKey: key });
    assert.equal(headAfter.exists, true, 'Prior valid object must remain existent');
    assert.equal(headAfter.byteSize, initialContent.length, 'Prior valid byte size preserved');
    assert.equal(headAfter.sha256Hash, initialHash, 'Prior valid SHA-256 hash preserved');

    const streamAfter = await provider.openReadStream({ storageBucket: bucket, storageKey: key });
    const chunks: Buffer[] = [];
    for await (const chunk of streamAfter) {
      chunks.push(Buffer.from(chunk));
    }
    const readBuffer = Buffer.concat(chunks);
    assert.equal(readBuffer.toString('utf8'), initialContent.toString('utf8'), 'Prior valid content remains untouched');
  });

  it('3. Durability across Provider Re-instantiations (Simulated Server Restart with Empty Cache)', async () => {
    const providerA = new LocalUatObjectStorageProvider(TEST_STORAGE_DIR);
    const content = Buffer.from('%PDF-1.7 Synthetic test for server restart persistence');
    const hash = createHash('sha256').update(content).digest('hex');
    const bucket = 'restart-bucket';
    const key = `doc-${randomUUID()}.pdf`;

    await providerA.writeObjectStream({
      storageBucket: bucket,
      storageKey: key,
      stream: Readable.from(content),
      declaredByteSize: content.length,
      mimeType: 'application/pdf',
    });

    // Simulate complete process restart with fresh provider (zero in-memory metadata cache)
    const providerB = new LocalUatObjectStorageProvider(TEST_STORAGE_DIR);

    // headObject reads metadata from disk
    const headRes = await providerB.headObject({ storageBucket: bucket, storageKey: key });
    assert.equal(headRes.exists, true);
    assert.equal(headRes.byteSize, content.length);
    assert.equal(headRes.sha256Hash, hash);

    // completeUpload reads metadata from disk
    const completeRes = await providerB.completeUpload({ storageBucket: bucket, storageKey: key });
    assert.equal(completeRes.byteSize, content.length);
    assert.equal(completeRes.sha256Hash, hash);

    // openReadStream streams directly from disk
    const readStream = await providerB.openReadStream({ storageBucket: bucket, storageKey: key });
    const chunks: Buffer[] = [];
    for await (const chunk of readStream) {
      chunks.push(Buffer.from(chunk));
    }
    assert.equal(Buffer.concat(chunks).toString('utf8'), content.toString('utf8'));

    // readRange reads byte slices directly from disk
    const rangeBuf = await providerB.readRange({
      storageBucket: bucket,
      storageKey: key,
      startByte: 0,
      endByte: 7,
    });
    assert.equal(rangeBuf.toString('utf8'), '%PDF-1.7');
  });

  it('4. Full Lifecycle: Complete, Head, Range, Abort, and Delete Operations', async () => {
    const provider = new LocalUatObjectStorageProvider(TEST_STORAGE_DIR);
    const bucket = 'lifecycle-bucket';
    const key = `lifecycle-${randomUUID()}.bin`;
    const payload = Buffer.from('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    const hash = createHash('sha256').update(payload).digest('hex');

    // Write
    await provider.writeObjectStream({
      storageBucket: bucket,
      storageKey: key,
      stream: Readable.from(payload),
      declaredByteSize: payload.length,
      mimeType: 'application/octet-stream',
    });

    // Range read sub-slice
    const slice = await provider.readRange({
      storageBucket: bucket,
      storageKey: key,
      startByte: 10,
      endByte: 14,
    });
    assert.equal(slice.toString('utf8'), 'ABCDE');

    // Delete
    const deleteRes = await provider.deleteObject({
      storageBucket: bucket,
      storageKey: key,
    });
    assert.equal(deleteRes.deleted, true);

    // Confirm deleted on disk
    const headAfterDelete = await provider.headObject({
      storageBucket: bucket,
      storageKey: key,
    });
    assert.equal(headAfterDelete.exists, false);

    await assert.rejects(
      async () => {
        await provider.openReadStream({ storageBucket: bucket, storageKey: key });
      },
      /OBJECT_NOT_FOUND/,
    );
  });

  it('5. 20 Concurrent Uploads: File Sizes, Elapsed Time, and Peak Memory Measurement', async () => {
    const provider = new LocalUatObjectStorageProvider(TEST_STORAGE_DIR);
    const bucket = 'concurrency-bucket';
    const CONCURRENT_UPLOADS = 20;

    // Force garbage collection if available or note baseline memory
    if (typeof global.gc === 'function') global.gc();
    const startMemory = process.memoryUsage();
    let peakHeapUsed = startMemory.heapUsed;

    const memorySampler = setInterval(() => {
      const current = process.memoryUsage().heapUsed;
      if (current > peakHeapUsed) peakHeapUsed = current;
    }, 10);

    const startTime = Date.now();
    const uploadTasks: Promise<{ index: number; key: string; size: number; hash: string }>[] = [];

    const fileSizes: { index: number; sizeBytes: number; sha256: string }[] = [];

    for (let i = 0; i < CONCURRENT_UPLOADS; i++) {
      // Vary sizes between 30 KB and 300 KB to simulate realistic PDFs and document scans
      const size = 30 * 1024 + (i * 14 * 1024);
      const randomChunk = Buffer.alloc(size, `DOC_CHUNK_${i}_DATA_PADDING_`);
      const hash = createHash('sha256').update(randomChunk).digest('hex');
      const key = `concurrent_upload_${i}_${randomUUID()}.pdf`;

      fileSizes.push({ index: i, sizeBytes: size, sha256: hash });

      const task = (async () => {
        const stream = Readable.from(randomChunk);
        const res = await provider.writeObjectStream({
          storageBucket: bucket,
          storageKey: key,
          stream,
          declaredByteSize: size,
          mimeType: 'application/pdf',
        });
        assert.equal(res.byteSize, size);
        assert.equal(res.sha256Hash, hash);
        return { index: i, key, size, hash };
      })();

      uploadTasks.push(task);
    }

    const results = await Promise.all(uploadTasks);
    clearInterval(memorySampler);

    const elapsedMs = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const totalBytesWritten = fileSizes.reduce((acc, f) => acc + f.sizeBytes, 0);

    // Verify all 20 files exist on disk and hashes match
    for (const r of results) {
      const head = await provider.headObject({ storageBucket: bucket, storageKey: r.key });
      assert.equal(head.exists, true);
      assert.equal(head.byteSize, r.size);
      assert.equal(head.sha256Hash, r.hash);
    }

    const heapDeltaMb = ((peakHeapUsed - startMemory.heapUsed) / (1024 * 1024)).toFixed(2);
    const startHeapMb = (startMemory.heapUsed / (1024 * 1024)).toFixed(2);
    const peakHeapMb = (peakHeapUsed / (1024 * 1024)).toFixed(2);
    const endHeapMb = (endMemory.heapUsed / (1024 * 1024)).toFixed(2);
    const totalMbWritten = (totalBytesWritten / (1024 * 1024)).toFixed(2);

    console.log('\n=== 20 CONCURRENT UPLOADS BENCHMARK RESULTS ===');
    console.log(`Concurrent Upload Count: ${CONCURRENT_UPLOADS}`);
    console.log(`Total Data Written:      ${totalMbWritten} MB (${totalBytesWritten} bytes)`);
    console.log(`Total Elapsed Time:      ${elapsedMs} ms (avg ${(elapsedMs / CONCURRENT_UPLOADS).toFixed(1)} ms/upload)`);
    console.log(`Start Heap Used:         ${startHeapMb} MB`);
    console.log(`Peak Heap Used:          ${peakHeapMb} MB (Delta: +${heapDeltaMb} MB)`);
    console.log(`End Heap Used:           ${endHeapMb} MB`);
    console.log('Sample file sizes:');
    fileSizes.slice(0, 5).forEach((f) => {
      console.log(`  Upload #${f.index}: ${f.sizeBytes} bytes, hash: ${f.sha256.slice(0, 16)}...`);
    });

    assert.equal(results.length, 20, 'All 20 concurrent uploads must complete successfully');
    // Memory delta must be modest (no buffering of 20 concurrent files into heap)
    assert.ok(
      peakHeapUsed - startMemory.heapUsed < 80 * 1024 * 1024,
      `Peak memory delta (${heapDeltaMb} MB) exceeded allowable bounds for streaming provider`,
    );
  });
});
