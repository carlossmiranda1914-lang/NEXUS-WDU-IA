import { createHash, randomUUID } from 'node:crypto';
import { Readable, PassThrough } from 'node:stream';
import { mkdir, writeFile, readFile, stat, unlink } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import path from 'node:path';
import type {
  ObjectStorageProvider,
  CreateUploadAuthParams,
  UploadAuthResult,
  CreateReadAuthParams,
  ReadAuthResult,
  CompleteUploadParams,
  StorageObjectMetadata,
  AbortUploadParams,
  HeadObjectParams,
  HeadObjectResult,
  DeleteObjectParams,
  DeleteObjectResult,
  OpenReadStreamParams,
  ReadRangeParams,
  WriteObjectStreamParams,
  WriteObjectResult,
} from './object-storage-provider.ts';

interface StoredLocalObject {
  buffer: Buffer;
  mimeType: string;
  uploadedAt: Date;
  sha256Hash: string;
}

interface StoredLocalMetadata {
  mimeType: string;
  uploadedAt: string;
  sha256Hash: string;
  byteSize: number;
}

/**
 * Local UAT Object Storage Provider.
 * Explicitly classified for LOCAL_UAT visual verification and isolated local test executions.
 * Filesystem-backed for durability across server restarts.
 * Fail-closed: Never active in production environments.
 */
export class LocalUatObjectStorageProvider implements ObjectStorageProvider {
  public readonly providerName = 'local_uat';

  // In-memory cache: `${storageBucket}/${storageKey}`
  private readonly storage = new Map<string, StoredLocalObject>();
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('LocalUatObjectStorageProvider is strictly forbidden in production.');
    }
    this.baseDir = baseDir || process.env.DOCUMENTS_LOCAL_UAT_STORAGE_DIR || path.resolve(process.cwd(), '.uat-storage');
  }

  private getStorageKey(bucket: string, key: string): string {
    return `${bucket.trim()}/${key.trim()}`;
  }

  private getFsPaths(bucket: string, key: string): { dataPath: string; metaPath: string; dir: string } {
    const sanitizedBucket = bucket.replace(/[^a-zA-Z0-9._-]/g, '_');
    const sanitizedKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
    const dir = path.join(this.baseDir, sanitizedBucket);
    const dataPath = path.join(dir, sanitizedKey);
    const metaPath = path.join(dir, `${sanitizedKey}.meta.json`);
    return { dataPath, metaPath, dir };
  }

  public async createUploadAuthorization(
    params: CreateUploadAuthParams,
  ): Promise<UploadAuthResult> {
    const authorizedUntil = new Date(Date.now() + params.expiresInSeconds * 1000);
    return {
      storageProvider: this.providerName,
      storageBucket: params.storageBucket,
      storageKey: params.storageKey,
      authorizedUntil,
    };
  }

  public async writeObjectStream(
    params: WriteObjectStreamParams,
  ): Promise<WriteObjectResult> {
    const hash = createHash('sha256');
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    const passThrough = new PassThrough();

    return new Promise<WriteObjectResult>((resolve, reject) => {
      passThrough.on('data', (chunk: Buffer) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(buf);
        totalBytes += buf.length;
        hash.update(buf);
      });

      passThrough.on('end', async () => {
        try {
          if (
            params.declaredByteSize !== undefined &&
            params.declaredByteSize !== totalBytes
          ) {
            return reject(
              new Error(
                `SIZE_MISMATCH: Uploaded stream size (${totalBytes} bytes) does not match declared size (${params.declaredByteSize} bytes).`,
              ),
            );
          }

          const sha256Hash = hash.digest('hex');
          const buffer = Buffer.concat(chunks);
          const mimeType = params.mimeType || 'application/octet-stream';
          const uploadedAt = new Date();

          const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
          this.storage.set(mapKey, {
            buffer,
            mimeType,
            uploadedAt,
            sha256Hash,
          });

          // Persist to filesystem for UAT restart durability
          try {
            const { dir, dataPath, metaPath } = this.getFsPaths(params.storageBucket, params.storageKey);
            await mkdir(dir, { recursive: true });
            await writeFile(dataPath, buffer);
            const meta: StoredLocalMetadata = {
              mimeType,
              uploadedAt: uploadedAt.toISOString(),
              sha256Hash,
              byteSize: totalBytes,
            };
            await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
          } catch (fsErr) {
            console.warn('[LOCAL-UAT-STORAGE] Warning: failed to persist to filesystem:', fsErr);
          }

          resolve({
            byteSize: totalBytes,
            sha256Hash,
            mimeType,
          });
        } catch (error) {
          reject(error);
        }
      });

      passThrough.on('error', (err) => {
        reject(new Error(`LOCAL_UAT_STREAM_READ_ERROR: ${err.message}`));
      });

      params.stream.pipe(passThrough);
    });
  }

  public async completeUpload(
    params: CompleteUploadParams,
  ): Promise<StorageObjectMetadata> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    let stored = this.storage.get(mapKey);

    if (!stored) {
      stored = await this.readFromFs(params.storageBucket, params.storageKey);
    }

    if (!stored) {
      throw new Error(
        `OBJECT_NOT_FOUND: Object not found in local UAT storage: ${mapKey}`,
      );
    }

    return {
      storageProvider: this.providerName,
      storageBucket: params.storageBucket,
      storageKey: params.storageKey,
      byteSize: stored.buffer.length,
      sha256Hash: stored.sha256Hash,
      mimeType: stored.mimeType,
      uploadedAt: stored.uploadedAt,
    };
  }

  private async readFromFs(bucket: string, key: string): Promise<StoredLocalObject | null> {
    const { dataPath, metaPath } = this.getFsPaths(bucket, key);
    if (!existsSync(dataPath) || !existsSync(metaPath)) {
      return null;
    }
    try {
      const buffer = await readFile(dataPath);
      const metaRaw = await readFile(metaPath, 'utf8');
      const meta: StoredLocalMetadata = JSON.parse(metaRaw);
      const stored: StoredLocalObject = {
        buffer,
        mimeType: meta.mimeType || 'application/octet-stream',
        uploadedAt: new Date(meta.uploadedAt),
        sha256Hash: meta.sha256Hash,
      };
      this.storage.set(this.getStorageKey(bucket, key), stored);
      return stored;
    } catch {
      return null;
    }
  }

  public async abortUpload(params: AbortUploadParams): Promise<void> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    this.storage.delete(mapKey);
    const { dataPath, metaPath } = this.getFsPaths(params.storageBucket, params.storageKey);
    try {
      if (existsSync(dataPath)) await unlink(dataPath);
      if (existsSync(metaPath)) await unlink(metaPath);
    } catch {
      // Ignored for abort
    }
  }

  public async headObject(params: HeadObjectParams): Promise<HeadObjectResult> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    let stored = this.storage.get(mapKey);

    if (!stored) {
      stored = await this.readFromFs(params.storageBucket, params.storageKey);
    }

    if (!stored) {
      return {
        exists: false,
        storageProvider: this.providerName,
        storageBucket: params.storageBucket,
        storageKey: params.storageKey,
        byteSize: 0,
        sha256Hash: '',
        mimeType: '',
      };
    }

    return {
      exists: true,
      storageProvider: this.providerName,
      storageBucket: params.storageBucket,
      storageKey: params.storageKey,
      byteSize: stored.buffer.length,
      sha256Hash: stored.sha256Hash,
      mimeType: stored.mimeType,
      uploadedAt: stored.uploadedAt,
    };
  }

  public async deleteUncommittedObject(
    params: DeleteObjectParams,
  ): Promise<boolean> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    const existed = this.storage.has(mapKey);
    this.storage.delete(mapKey);
    const { dataPath, metaPath } = this.getFsPaths(params.storageBucket, params.storageKey);
    try {
      if (existsSync(dataPath)) await unlink(dataPath);
      if (existsSync(metaPath)) await unlink(metaPath);
    } catch {
      // Ignore
    }
    return existed;
  }

  public async openReadStream(
    params: OpenReadStreamParams,
  ): Promise<NodeJS.ReadableStream> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    let stored = this.storage.get(mapKey);

    if (!stored) {
      stored = await this.readFromFs(params.storageBucket, params.storageKey);
    }

    if (!stored) {
      throw new Error(
        `OBJECT_NOT_FOUND: Local UAT storage object not found: ${mapKey}`,
      );
    }

    return Readable.from(stored.buffer);
  }

  public async readRange(params: ReadRangeParams): Promise<Buffer> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    let stored = this.storage.get(mapKey);

    if (!stored) {
      stored = await this.readFromFs(params.storageBucket, params.storageKey);
    }

    if (!stored) {
      throw new Error(
        `OBJECT_NOT_FOUND: Local UAT storage object not found: ${mapKey}`,
      );
    }

    const start = Math.max(0, params.startByte);
    const end = Math.min(stored.buffer.length, params.endByte + 1);
    return stored.buffer.subarray(start, end);
  }

  public async createReadAuthorization(
    params: CreateReadAuthParams,
  ): Promise<ReadAuthResult> {
    const authorizedUntil = new Date(Date.now() + params.expiresInSeconds * 1000);
    return {
      storageProvider: this.providerName,
      storageBucket: params.storageBucket,
      storageKey: params.storageKey,
      authorizedUntil,
      readUrl: `/api/documents/${params.documentId}/versions/${params.versionId}/content?token=${randomUUID()}`,
    };
  }

  public async deleteObject(
    params: DeleteObjectParams,
  ): Promise<DeleteObjectResult> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    const inMem = this.storage.delete(mapKey);
    let fsDeleted = false;
    const { dataPath, metaPath } = this.getFsPaths(params.storageBucket, params.storageKey);
    try {
      if (existsSync(dataPath)) {
        await unlink(dataPath);
        fsDeleted = true;
      }
      if (existsSync(metaPath)) {
        await unlink(metaPath);
      }
    } catch {
      // Ignore
    }
    return { deleted: inMem || fsDeleted };
  }
}
