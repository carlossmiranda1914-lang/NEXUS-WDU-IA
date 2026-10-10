import { createHash, randomUUID } from 'node:crypto';
import { Readable, PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { mkdir, writeFile, readFile, stat, unlink, rename } from 'node:fs/promises';
import { existsSync, createReadStream, createWriteStream } from 'node:fs';
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

export interface StoredLocalMetadata {
  mimeType: string;
  uploadedAt: string;
  sha256Hash: string;
  byteSize: number;
}

/**
 * Local UAT Object Storage Provider.
 * Explicitly classified for LOCAL_UAT visual verification and isolated local test executions.
 * Filesystem-backed for durability across server restarts.
 * Streams directly to/from disk with unique temp files to prevent OOM / Buffer.concat accumulation.
 * Fail-closed: Never active in production environments.
 */
export class LocalUatObjectStorageProvider implements ObjectStorageProvider {
  public readonly providerName = 'local_uat';

  // In-memory cache stores ONLY lightweight metadata, NEVER whole file byte buffers
  private readonly metadataCache = new Map<string, StoredLocalMetadata>();
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('LocalUatObjectStorageProvider is strictly forbidden in production.');
    }
    const rawDir = baseDir || process.env.DOCUMENTS_LOCAL_UAT_STORAGE_DIR;
    if (!rawDir) {
      throw new Error(
        'LOCAL_UAT_STORAGE_DIR_REQUIRED: Local UAT storage requires explicit absolute path configuration (baseDir parameter or DOCUMENTS_LOCAL_UAT_STORAGE_DIR).',
      );
    }
    if (!path.isAbsolute(rawDir)) {
      throw new Error(
        `LOCAL_UAT_STORAGE_DIR_MUST_BE_ABSOLUTE: DOCUMENTS_LOCAL_UAT_STORAGE_DIR must be an absolute path: "${rawDir}". Fallbacks based on process.cwd() or import.meta.url are prohibited.`,
      );
    }
    this.baseDir = path.normalize(rawDir);
  }

  public getEffectiveBaseDir(): string {
    return this.baseDir;
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
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    const { dir, dataPath, metaPath } = this.getFsPaths(params.storageBucket, params.storageKey);

    // Unique per-attempt temporary file to avoid overwriting or clashing with concurrent uploads
    const tempFileId = randomUUID();
    const tempFilePath = path.join(dir, `${path.basename(dataPath)}.${tempFileId}.tmp`);
    const tempMetaPath = path.join(dir, `${path.basename(metaPath)}.${tempFileId}.tmp`);

    await mkdir(dir, { recursive: true });

    const hash = createHash('sha256');
    let totalBytes = 0;

    const passThrough = new PassThrough();
    passThrough.on('data', (chunk: Buffer) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      hash.update(buf);
    });

    const fileWriteStream = createWriteStream(tempFilePath);

    try {
      // Pipe stream directly to disk without storing chunks in memory
      await pipeline(params.stream, passThrough, fileWriteStream);

      if (
        params.declaredByteSize !== undefined &&
        params.declaredByteSize !== totalBytes
      ) {
        throw new Error(
          `SIZE_MISMATCH: Uploaded stream size (${totalBytes} bytes) does not match declared size (${params.declaredByteSize} bytes).`,
        );
      }

      const sha256Hash = hash.digest('hex');
      const mimeType = params.mimeType || 'application/octet-stream';
      const uploadedAt = new Date().toISOString();

      const meta: StoredLocalMetadata = {
        mimeType,
        uploadedAt,
        sha256Hash,
        byteSize: totalBytes,
      };

      // Write temp metadata
      await writeFile(tempMetaPath, JSON.stringify(meta, null, 2), 'utf8');

      // Atomic commit: rename temp files to canonical destination
      await rename(tempFilePath, dataPath);
      await rename(tempMetaPath, metaPath);

      // Cache metadata only
      this.metadataCache.set(mapKey, meta);

      return {
        byteSize: totalBytes,
        sha256Hash,
        mimeType,
      };
    } catch (fsErr) {
      // Clean up ONLY this attempt's temporary files, preserving existing valid files
      try {
        if (existsSync(tempFilePath)) await unlink(tempFilePath);
        if (existsSync(tempMetaPath)) await unlink(tempMetaPath);
      } catch {
        // Ignore secondary cleanup error
      }
      if (!existsSync(dataPath)) {
        this.metadataCache.delete(mapKey);
      }
      throw new Error(
        `LOCAL_UAT_STORAGE_PERSISTENCE_FAILED: Failed to write object to filesystem: ${fsErr instanceof Error ? fsErr.message : String(fsErr)}`,
      );
    }
  }

  public async completeUpload(
    params: CompleteUploadParams,
  ): Promise<StorageObjectMetadata> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    let meta = this.metadataCache.get(mapKey);

    if (!meta) {
      meta = await this.readMetadataFromFs(params.storageBucket, params.storageKey);
    }

    if (!meta) {
      throw new Error(
        `OBJECT_NOT_FOUND: Object not found in local UAT storage: ${mapKey}`,
      );
    }

    return {
      storageProvider: this.providerName,
      storageBucket: params.storageBucket,
      storageKey: params.storageKey,
      byteSize: meta.byteSize,
      sha256Hash: meta.sha256Hash,
      mimeType: meta.mimeType,
      uploadedAt: new Date(meta.uploadedAt),
    };
  }

  private async readMetadataFromFs(bucket: string, key: string): Promise<StoredLocalMetadata | null> {
    const { dataPath, metaPath } = this.getFsPaths(bucket, key);
    if (!existsSync(dataPath) || !existsSync(metaPath)) {
      return null;
    }
    try {
      const metaRaw = await readFile(metaPath, 'utf8');
      const meta: StoredLocalMetadata = JSON.parse(metaRaw);
      this.metadataCache.set(this.getStorageKey(bucket, key), meta);
      return meta;
    } catch {
      return null;
    }
  }

  public async abortUpload(params: AbortUploadParams): Promise<void> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    this.metadataCache.delete(mapKey);
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
    let meta = this.metadataCache.get(mapKey);

    if (!meta) {
      meta = await this.readMetadataFromFs(params.storageBucket, params.storageKey);
    }

    if (!meta) {
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
      byteSize: meta.byteSize,
      sha256Hash: meta.sha256Hash,
      mimeType: meta.mimeType,
      uploadedAt: new Date(meta.uploadedAt),
    };
  }

  public async deleteUncommittedObject(
    params: DeleteObjectParams,
  ): Promise<boolean> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    const existed = this.metadataCache.has(mapKey);
    this.metadataCache.delete(mapKey);
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
    const { dataPath } = this.getFsPaths(params.storageBucket, params.storageKey);

    if (!existsSync(dataPath)) {
      this.metadataCache.delete(mapKey);
      throw new Error(
        `OBJECT_NOT_FOUND: Local UAT storage object not found: ${mapKey}`,
      );
    }

    const stream = createReadStream(dataPath);
    return stream;
  }

  public async readRange(params: ReadRangeParams): Promise<Buffer> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    const { dataPath } = this.getFsPaths(params.storageBucket, params.storageKey);

    if (!existsSync(dataPath)) {
      this.metadataCache.delete(mapKey);
      throw new Error(
        `OBJECT_NOT_FOUND: Local UAT storage object not found: ${mapKey}`,
      );
    }

    const start = Math.max(0, params.startByte);
    const end = params.endByte;
    const stream = createReadStream(dataPath, { start, end });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
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
    const inMem = this.metadataCache.delete(mapKey);
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
