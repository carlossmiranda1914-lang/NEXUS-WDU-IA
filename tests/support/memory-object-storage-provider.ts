import { createHash, randomUUID } from 'node:crypto';
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
} from '../../src/modules/documents/object-storage-provider.ts';

export interface SimulateDirectUploadParams {
  storageBucket: string;
  storageKey: string;
  content: Buffer;
  mimeType?: string;
}

/**
 * In-Memory Object Storage Provider strictly for automated testing.
 * NOT for production or development fallback use.
 */
export class MemoryObjectStorageProvider implements ObjectStorageProvider {
  public readonly providerName = 'memory_test_provider';

  // Key format: `${bucket}/${key}`
  private objects = new Map<
    string,
    {
      buffer: Buffer;
      mimeType: string;
      uploadedAt: Date;
    }
  >();

  private failureInjections = new Set<string>();

  public injectFailure(operation: 'complete' | 'head' | 'abort' | 'delete'): void {
    this.failureInjections.add(operation);
  }

  public clearInjectedFailures(): void {
    this.failureInjections.clear();
  }

  /**
   * Test helper to simulate client uploading raw bytes directly to storage.
   */
  public async simulateDirectUpload(
    paramsOrBucket: SimulateDirectUploadParams | string,
    key?: string,
    buffer?: Buffer,
    mimeType: string = 'application/octet-stream',
  ): Promise<StorageObjectMetadata & { exists: true }> {
    let b: string;
    let k: string;
    let buf: Buffer;
    let mime: string;

    if (typeof paramsOrBucket === 'object') {
      b = paramsOrBucket.storageBucket;
      k = paramsOrBucket.storageKey;
      buf = paramsOrBucket.content;
      mime = paramsOrBucket.mimeType || 'application/octet-stream';
    } else {
      b = paramsOrBucket;
      k = key!;
      buf = buffer!;
      mime = mimeType;
    }

    const uploadedAt = new Date();
    this.objects.set(`${b}/${k}`, {
      buffer: buf,
      mimeType: mime,
      uploadedAt,
    });

    const sha256Hash = createHash('sha256').update(buf).digest('hex');
    return {
      exists: true,
      storageProvider: this.providerName,
      storageBucket: b,
      storageKey: k,
      byteSize: buf.length,
      sha256Hash,
      mimeType: mime,
      uploadedAt,
    };
  }

  async createUploadAuthorization(params: CreateUploadAuthParams): Promise<UploadAuthResult> {
    const authorizedUntil = new Date(Date.now() + params.expiresInSeconds * 1000);
    return {
      storageProvider: this.providerName,
      storageBucket: params.storageBucket,
      storageKey: params.storageKey,
      uploadUrl: `memory://${params.storageBucket}/${params.storageKey}?token=${randomUUID()}`,
      authorizedUntil,
    };
  }

  async completeUpload(params: CompleteUploadParams): Promise<StorageObjectMetadata> {
    if (this.failureInjections.has('complete')) {
      throw new Error('Injected completeUpload failure in MemoryObjectStorageProvider');
    }

    const obj = this.objects.get(`${params.storageBucket}/${params.storageKey}`);
    if (!obj) {
      throw new Error(
        `Object not found in storage for completion: ${params.storageBucket}/${params.storageKey}`,
      );
    }

    const sha256Hash = createHash('sha256').update(obj.buffer).digest('hex');

    return {
      storageProvider: this.providerName,
      storageBucket: params.storageBucket,
      storageKey: params.storageKey,
      byteSize: obj.buffer.length,
      sha256Hash,
      mimeType: obj.mimeType,
      uploadedAt: obj.uploadedAt,
    };
  }

  async abortUpload(params: AbortUploadParams): Promise<void> {
    if (this.failureInjections.has('abort')) {
      throw new Error('Injected abortUpload failure in MemoryObjectStorageProvider');
    }
    this.objects.delete(`${params.storageBucket}/${params.storageKey}`);
  }

  async headObject(params: HeadObjectParams): Promise<HeadObjectResult> {
    if (this.failureInjections.has('head')) {
      throw new Error('Injected headObject failure in MemoryObjectStorageProvider');
    }

    const obj = this.objects.get(`${params.storageBucket}/${params.storageKey}`);
    if (!obj) {
      return {
        exists: false,
        byteSize: 0,
        sha256Hash: '',
        mimeType: '',
      };
    }

    const sha256Hash = createHash('sha256').update(obj.buffer).digest('hex');
    return {
      exists: true,
      storageProvider: this.providerName,
      storageBucket: params.storageBucket,
      storageKey: params.storageKey,
      byteSize: obj.buffer.length,
      sha256Hash,
      mimeType: obj.mimeType,
      uploadedAt: obj.uploadedAt,
    };
  }

  async deleteUncommittedObject(params: DeleteObjectParams): Promise<boolean> {
    if (this.failureInjections.has('delete')) {
      throw new Error('Injected deleteUncommittedObject failure in MemoryObjectStorageProvider');
    }
    const had = this.objects.has(`${params.storageBucket}/${params.storageKey}`);
    this.objects.delete(`${params.storageBucket}/${params.storageKey}`);
    return had;
  }
}
