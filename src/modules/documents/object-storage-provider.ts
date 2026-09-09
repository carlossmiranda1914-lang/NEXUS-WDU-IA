export interface CreateUploadAuthParams {
  institutionId?: string;
  documentId?: string;
  storageBucket: string;
  storageKey: string;
  declaredByteSize: number;
  declaredMimeType: string;
  expiresInSeconds: number;
}

export interface UploadAuthResult {
  storageProvider: string;
  storageBucket: string;
  storageKey: string;
  uploadUrl?: string;
  headers?: Record<string, string>;
  authorizedUntil: Date;
}

export interface CompleteUploadParams {
  institutionId?: string;
  storageBucket: string;
  storageKey: string;
}

export interface StorageObjectMetadata {
  storageProvider: string;
  storageBucket: string;
  storageKey: string;
  byteSize: number;
  sha256Hash: string;
  mimeType: string;
  etag?: string;
  uploadedAt: Date;
}

export interface AbortUploadParams {
  institutionId?: string;
  storageBucket: string;
  storageKey: string;
}

export interface HeadObjectParams {
  institutionId?: string;
  storageBucket: string;
  storageKey: string;
}

export interface HeadObjectResult {
  exists: boolean;
  storageProvider?: string;
  storageBucket?: string;
  storageKey?: string;
  byteSize: number;
  sha256Hash: string;
  mimeType: string;
  uploadedAt?: Date;
}

export interface DeleteObjectParams {
  institutionId?: string;
  storageBucket: string;
  storageKey: string;
}

/**
 * Provider-neutral object storage abstraction interface.
 * Production concrete provider is NONE in I3.
 */
export interface ObjectStorageProvider {
  readonly providerName: string;

  createUploadAuthorization(params: CreateUploadAuthParams): Promise<UploadAuthResult>;

  completeUpload(params: CompleteUploadParams): Promise<StorageObjectMetadata>;

  abortUpload(params: AbortUploadParams): Promise<void>;

  headObject(params: HeadObjectParams): Promise<HeadObjectResult>;

  deleteUncommittedObject(params: DeleteObjectParams): Promise<boolean>;
}
