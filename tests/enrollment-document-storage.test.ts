import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createEnrollmentDocumentStorageKey, EnrollmentDocumentStorageError } from '../src/modules/enrollments/enrollment-document-storage.ts';
import { createFilesystemEnrollmentDocumentStorage, FilesystemEnrollmentDocumentStorage } from '../src/modules/enrollments/enrollment-document-filesystem-storage.ts';

async function* chunks(...values: Uint8Array[]): AsyncIterable<Uint8Array> { for (const value of values) yield value; }
async function readAll(content: AsyncIterable<Uint8Array>): Promise<Buffer> { const values: Uint8Array[] = []; for await (const value of content) values.push(value); return Buffer.concat(values); }

test('private filesystem storage writes atomically, hashes, opens and deletes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nexus-doc-storage-'));
  try {
    const storage = new FilesystemEnrollmentDocumentStorage(root);
    const storageKey = createEnrollmentDocumentStorageKey();
    const content = Buffer.from('%PDF-1.7\nprivate Nexus evidence');
    const result = await storage.put({ storageKey, contentType: 'application/pdf', content: chunks(content) });
    assert.equal(result.byteSize, content.length);
    assert.equal(result.sha256, createHash('sha256').update(content).digest('hex'));
    assert.deepEqual(await readAll((await storage.open(storageKey)).content), content);
    await storage.delete(storageKey);
    await assert.rejects(() => storage.open(storageKey), (error: unknown) => error instanceof EnrollmentDocumentStorageError && error.code === 'NOT_FOUND');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('private filesystem storage rejects invalid MIME, traversal and oversized content', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nexus-doc-storage-'));
  try {
    const storage = new FilesystemEnrollmentDocumentStorage(root);
    await assert.rejects(() => storage.put({ storageKey: '../escape', contentType: 'application/pdf', content: chunks(Buffer.from('x')) }), /Chave/);
    await assert.rejects(() => storage.put({ storageKey: createEnrollmentDocumentStorageKey(), contentType: 'text/plain' as any, content: chunks(Buffer.from('x')) }), /Tipo documental/);
    await storage.put({ storageKey: createEnrollmentDocumentStorageKey(), contentType: 'image/png', content: chunks(Buffer.alloc(6 * 1024 * 1024)) });
    await assert.rejects(() => storage.put({ storageKey: createEnrollmentDocumentStorageKey(), contentType: 'image/png', content: chunks(Buffer.alloc(6 * 1024 * 1024 + 1)) }), (error: unknown) => error instanceof EnrollmentDocumentStorageError && error.code === 'MAX_BYTES_EXCEEDED');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('failed writes remove temporary artifacts and missing root configuration fails closed', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nexus-doc-storage-'));
  try {
    const storage = new FilesystemEnrollmentDocumentStorage(root);
    async function* broken(): AsyncIterable<Uint8Array> { yield Buffer.from('partial'); throw new Error('stream interrupted'); }
    await assert.rejects(() => storage.put({ storageKey: createEnrollmentDocumentStorageKey(), contentType: 'application/pdf', content: broken() }), /persistir/);
    assert.deepEqual(await readdir(root), []);
    assert.throws(() => createFilesystemEnrollmentDocumentStorage({}), /ENROLLMENT_DOCUMENT_STORAGE_ROOT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
