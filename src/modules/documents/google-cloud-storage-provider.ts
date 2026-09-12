import { createHash } from 'node:crypto';
import { Readable, PassThrough } from 'node:stream';
import type {
  ObjectStorageProvider,
  CreateUploadAuthParams,
  UploadAuthResult,
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
  CreateReadAuthParams,
  ReadAuthResult,
} from './object-storage-provider.ts';

/**
 * Minimal GCS File contract for decoupling from heavy SDK instances and allowing clean mock injection.
 */
export interface GcsFileLike {
  name: string;
  createWriteStream(options?: {
    metadata?: {
      contentType?: string;
      metadata?: Record<string, string>;
    };
    resumable?: boolean;
  }): NodeJS.WritableStream;
  createReadStream(options?: { start?: number; end?: number }): NodeJS.ReadableStream;
  getMetadata(): Promise<[{
    size?: string | number;
    contentType?: string;
    updated?: string;
    md5Hash?: string;
    metadata?: Record<string, string>;
  }]>;
  exists(): Promise<[boolean]>;
  delete(options?: { ignoreNotFound?: boolean }): Promise<unknown>;
}

/**
 * Minimal GCS Bucket contract.
 */
export interface GcsBucketLike {
  name: string;
  file(name: string): GcsFileLike;
}

/**
 * Minimal GCS Storage client contract.
 */
export interface GcsStorageClientLike {
  bucket(name: string): GcsBucketLike;
}

export interface GoogleCloudStorageProviderOptions {
  client?: GcsStorageClientLike;
  projectId?: string;
  defaultBucket?: string;
}

/**
 * Production-ready Google Cloud Storage adapter for Documents Foundation.
 * Operates on server-mediated streaming by default.
 * Zero browser storage credentials exposure.
 */
export class GoogleCloudStorageObjectProvider implements ObjectStorageProvider {
  public readonly providerName = 'google_cloud_storage';
  private readonly client?: GcsStorageClientLike;
  private readonly defaultBucket?: string;

  constructor(options: GoogleCloudStorageProviderOptions = {}) {
    this.client = options.client;
    this.defaultBucket = options.defaultBucket;
  }

  private resolveBucket(bucketName?: string): GcsBucketLike {
    const targetBucket = bucketName || this.defaultBucket;
    if (!targetBucket || typeof targetBucket !== 'string' || targetBucket.trim() === '') {
      throw new Error('GCS_BUCKET_REQUIRED: A valid storage bucket name must be configured.');
    }
    if (!this.client) {
      throw new Error('GCS_CLIENT_UNAVAILABLE: GCS Storage client is not configured in this environment.');
    }
    return this.client.bucket(targetBucket.trim());
  }

  /**
   * Authorize upload session.
   * Uses server-mediated streaming: returns metadata without exposing raw cloud storage credentials to browser.
   */
  public async createUploadAuthorization(
    params: CreateUploadAuthParams,
  ): Promise<UploadAuthResult> {
    const bucket = this.resolveBucket(params.storageBucket);
    const authorizedUntil = new Date(Date.now() + params.expiresInSeconds * 1000);

    return {
      storageProvider: this.providerName,
      storageBucket: bucket.name,
      storageKey: params.storageKey,
      authorizedUntil,
    };
  }

  /**
   * Stream incoming upload bytes directly into GCS target file while calculating SHA-256 hash and byte size.
   */
  public async writeObjectStream(
    params: WriteObjectStreamParams,
  ): Promise<WriteObjectResult> {
    const bucket = this.resolveBucket(params.storageBucket);
    const file = bucket.file(params.storageKey);

    const hash = createHash('sha256');
    let totalBytes = 0;

    const passThrough = new PassThrough();
    const gcsWriteStream = file.createWriteStream({
      metadata: {
        contentType: params.mimeType || 'application/octet-stream',
      },
      resumable: false,
    });

    return new Promise<WriteObjectResult>((resolve, reject) => {
      let writeFinished = false;
      let streamEnded = false;

      const checkCompletion = async () => {
        if (!writeFinished || !streamEnded) return;

        const sha256Hash = hash.digest('hex');

        // Verify declared size invariant if provided
        if (
          params.declaredByteSize !== undefined &&
          params.declaredByteSize !== totalBytes
        ) {
          try {
            await file.delete({ ignoreNotFound: true });
          } catch {
            // Ignore cleanup failure on error
          }
          return reject(
            new Error(
              `SIZE_MISMATCH: Uploaded stream size (${totalBytes} bytes) does not match declared size (${params.declaredByteSize} bytes).`,
            ),
          );
        }

        resolve({
          byteSize: totalBytes,
          sha256Hash,
          mimeType: params.mimeType || 'application/octet-stream',
        });
      };

      passThrough.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        hash.update(chunk);
      });

      passThrough.on('end', () => {
        streamEnded = true;
        checkCompletion();
      });

      passThrough.on('error', (err) => {
        reject(new Error(`GCS_STREAM_READ_ERROR: ${err.message}`));
      });

      gcsWriteStream.on('finish', () => {
        writeFinished = true;
        checkCompletion();
      });

      gcsWriteStream.on('error', (err) => {
        reject(new Error(`GCS_WRITE_STREAM_ERROR: ${err.message}`));
      });

      params.stream.pipe(passThrough).pipe(gcsWriteStream);
    });
  }

  /**
   * Retrieve metadata for a GCS object.
   */
  public async headObject(params: HeadObjectParams): Promise<HeadObjectResult> {
    try {
      const bucket = this.resolveBucket(params.storageBucket);
      const file = bucket.file(params.storageKey);

      const [exists] = await file.exists();
      if (!exists) {
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

      const [metadata] = await file.getMetadata();
      const byteSize = typeof metadata.size === 'string' ? parseInt(metadata.size, 10) : Number(metadata.size || 0);
      const mimeType = metadata.contentType || 'application/octet-stream';
      const uploadedAt = metadata.updated ? new Date(metadata.updated) : new Date();
      const sha256Hash = metadata.metadata?.sha256Hash || '';

      return {
        exists: true,
        storageProvider: this.providerName,
        storageBucket: params.storageBucket,
        storageKey: params.storageKey,
        byteSize,
        sha256Hash,
        mimeType,
        uploadedAt,
      };
    } catch (err: any) {
      if (err?.code === 404 || err?.message?.includes('Not Found') || err?.message?.includes('not found')) {
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
      throw new Error(`GCS_HEAD_OBJECT_FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Complete an upload session by verifying object presence in GCS.
   */
  public async completeUpload(
    params: CompleteUploadParams,
  ): Promise<StorageObjectMetadata> {
    const head = await this.headObject({
      storageBucket: params.storageBucket,
      storageKey: params.storageKey,
    });

    if (!head.exists) {
      throw new Error(
        `STORAGE_OBJECT_NOT_FOUND: Object does not exist in bucket "${params.storageBucket}" at key "${params.storageKey}".`,
      );
    }

    return {
      storageProvider: this.providerName,
      storageBucket: params.storageBucket,
      storageKey: params.storageKey,
      byteSize: head.byteSize,
      sha256Hash: head.sha256Hash,
      mimeType: head.mimeType,
      uploadedAt: head.uploadedAt || new Date(),
    };
  }

  /**
   * Abort an upload session by cleaning up uncommitted content.
   */
  public async abortUpload(params: AbortUploadParams): Promise<void> {
    await this.deleteUncommittedObject({
      storageBucket: params.storageBucket,
      storageKey: params.storageKey,
    });
  }

  /**
   * Delete an uncommitted temporary object (abort flow).
   */
  public async deleteUncommittedObject(
    params: DeleteObjectParams,
  ): Promise<boolean> {
    try {
      const bucket = this.resolveBucket(params.storageBucket);
      const file = bucket.file(params.storageKey);
      await file.delete({ ignoreNotFound: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Open readable stream from GCS.
   */
  public async openReadStream(
    params: OpenReadStreamParams,
  ): Promise<NodeJS.ReadableStream> {
    const bucket = this.resolveBucket(params.storageBucket);
    const file = bucket.file(params.storageKey);

    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(
        `STORAGE_OBJECT_NOT_FOUND: Object not found in bucket "${params.storageBucket}" at key "${params.storageKey}".`,
      );
    }

    return file.createReadStream();
  }

  /**
   * Read byte range from GCS file.
   */
  public async readRange(params: ReadRangeParams): Promise<Buffer> {
    const bucket = this.resolveBucket(params.storageBucket);
    const file = bucket.file(params.storageKey);

    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(
        `STORAGE_OBJECT_NOT_FOUND: Object not found in bucket "${params.storageBucket}" at key "${params.storageKey}".`,
      );
    }

    const stream = file.createReadStream({
      start: params.startByte,
      end: params.endByte,
    });

    const chunks: Buffer[] = [];
    return new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err) => reject(new Error(`GCS_READ_RANGE_ERROR: ${err.message}`)));
    });
  }

  /**
   * Authorize read access (server-mediated streaming).
   */
  public async createReadAuthorization(
    params: CreateReadAuthParams,
  ): Promise<ReadAuthResult> {
    const authorizedUntil = new Date(Date.now() + params.expiresInSeconds * 1000);
    return {
      storageProvider: this.providerName,
      storageBucket: params.storageBucket,
      storageKey: params.storageKey,
      authorizedUntil,
      contentDisposition: params.action === 'download'
        ? `attachment; filename="${params.displayFilename || 'document'}"`
        : 'inline',
    };
  }

  /**
   * Permanently delete a committed storage object.
   * Fail-closed: returns deleted: false or throws on unexpected storage failure.
   */
  public async deleteObject(
    params: DeleteObjectParams,
  ): Promise<DeleteObjectResult> {
    try {
      const bucket = this.resolveBucket(params.storageBucket);
      const file = bucket.file(params.storageKey);

      await file.delete({ ignoreNotFound: false });
      return { deleted: true };
    } catch (err: any) {
      if (err?.code === 404 || err?.message?.includes('Not Found') || err?.message?.includes('not found')) {
        return { deleted: false, errorCode: 'OBJECT_NOT_FOUND' };
      }
      return { deleted: false, errorCode: err instanceof Error ? err.message : 'GCS_DELETE_ERROR' };
    }
  }
}
