import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { LocalUatObjectStorageProvider } from '../src/modules/documents/local-uat-storage-provider.ts';

const root = await mkdtemp(path.join(tmpdir(), 'nexus-documents-local-storage-'));
const bucket = 'uat-bucket';
const key = 'institution/document/version/content.bin';
const payload = Buffer.from('Nexus Documents restart durability proof');
const expectedHash = createHash('sha256').update(payload).digest('hex');

try {
  console.log('[LOCAL-STORAGE 1] durable write survives provider restart');
  const providerA = new LocalUatObjectStorageProvider(root);
  const write = await providerA.writeObjectStream({
    storageBucket: bucket,
    storageKey: key,
    declaredByteSize: payload.length,
    mimeType: 'application/octet-stream',
    stream: Readable.from(payload),
  });
  assert.equal(write.byteSize, payload.length);
  assert.equal(write.sha256Hash, expectedHash);

  // New provider instance = process/runtime restart from the storage provider perspective.
  const providerB = new LocalUatObjectStorageProvider(root);
  const head = await providerB.headObject({ storageBucket: bucket, storageKey: key });
  assert.equal(head.exists, true);
  assert.equal(head.byteSize, payload.length);
  assert.equal(head.sha256Hash, expectedHash);

  const stream = await providerB.openReadStream({ storageBucket: bucket, storageKey: key });
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  assert.deepEqual(Buffer.concat(chunks), payload);

  console.log('[LOCAL-STORAGE 2] corrupted durable metadata fails closed');
  const sanitizedBucket = bucket.replace(/[^a-zA-Z0-9._-]/g, '_');
  const sanitizedKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  const metaPath = path.join(root, sanitizedBucket, `${sanitizedKey}.meta.json`);
  const rawMeta = JSON.parse(await readFile(metaPath, 'utf8'));
  rawMeta.sha256Hash = '0'.repeat(64);
  await writeFile(metaPath, JSON.stringify(rawMeta, null, 2), 'utf8');

  const providerC = new LocalUatObjectStorageProvider(root);
  await assert.rejects(
    () => providerC.headObject({ storageBucket: bucket, storageKey: key }),
    /LOCAL_UAT_STORAGE_INTEGRITY_FAILURE/,
  );

  console.log('[LOCAL-STORAGE 3] persistence failure cannot be acknowledged as successful upload');
  const blockerPath = path.join(root, 'not-a-directory');
  await writeFile(blockerPath, 'block mkdir', 'utf8');
  const providerD = new LocalUatObjectStorageProvider(blockerPath);
  await assert.rejects(
    () =>
      providerD.writeObjectStream({
        storageBucket: bucket,
        storageKey: 'durability-failure.bin',
        declaredByteSize: payload.length,
        mimeType: 'application/octet-stream',
        stream: Readable.from(payload),
      }),
    /LOCAL_UAT_DURABILITY_FAILURE/,
  );

  console.log('[DOCUMENTS-LOCAL-STORAGE-INTEGRITY] PASS');
} finally {
  await rm(root, { recursive: true, force: true });
}
