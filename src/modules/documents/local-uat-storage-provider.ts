import { createHash, randomUUID } from 'node:crypto';
import { Readable, PassThrough } from 'node:stream';
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

/**
 * Local UAT Object Storage Provider.
 * Explicitly classified for LOCAL_UAT visual verification and isolated local test executions.
 * Fail-closed: Never active in production environments.
 */
export class LocalUatObjectStorageProvider implements ObjectStorageProvider {
  public readonly providerName = 'local_uat';

  // Map key: `${storageBucket}/${storageKey}`
  private readonly storage = new Map<string, StoredLocalObject>();

  private getStorageKey(bucket: string, key: string): string {
    return `${bucket.trim()}/${key.trim()}`;
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

      passThrough.on('end', () => {
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

        resolve({
          byteSize: totalBytes,
          sha256Hash,
          mimeType,
        });
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
    const stored = this.storage.get(mapKey);

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

  public async abortUpload(params: AbortUploadParams): Promise<void> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    this.storage.delete(mapKey);
  }

  public async headObject(params: HeadObjectParams): Promise<HeadObjectResult> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    const stored = this.storage.get(mapKey);

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
    return existed;
  }

  public async openReadStream(
    params: OpenReadStreamParams,
  ): Promise<NodeJS.ReadableStream> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    const stored = this.storage.get(mapKey);

    if (!stored) {
      throw new Error(
        `OBJECT_NOT_FOUND: Local UAT storage object not found: ${mapKey}`,
      );
    }

    return Readable.from(stored.buffer);
  }

  public async readRange(params: ReadRangeParams): Promise<Buffer> {
    const mapKey = this.getStorageKey(params.storageBucket, params.storageKey);
    const stored = this.storage.get(mapKey);

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
    const deleted = this.storage.delete(mapKey);
    return { deleted };
  }
}
