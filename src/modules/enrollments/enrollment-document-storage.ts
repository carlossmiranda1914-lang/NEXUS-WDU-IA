import { createHash, randomBytes } from 'node:crypto';

export const ENROLLMENT_DOCUMENT_ALLOWED_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type EnrollmentDocumentContentType = (typeof ENROLLMENT_DOCUMENT_ALLOWED_CONTENT_TYPES)[number];
export const ENROLLMENT_DOCUMENT_MAX_BYTES = 6 * 1024 * 1024;

export class EnrollmentDocumentStorageError extends Error {
  constructor(public readonly code: 'CONFIGURATION' | 'INVALID_KEY' | 'INVALID_CONTENT_TYPE' | 'MAX_BYTES_EXCEEDED' | 'NOT_FOUND' | 'WRITE_FAILED', message: string) {
    super(message);
    this.name = 'EnrollmentDocumentStorageError';
  }
}

export interface EnrollmentDocumentStorage {
  put(input: { storageKey: string; contentType: EnrollmentDocumentContentType; content: AsyncIterable<Uint8Array> }): Promise<{ byteSize: number; sha256: string }>;
  open(storageKey: string): Promise<{ content: AsyncIterable<Uint8Array> }>;
  delete(storageKey: string): Promise<void>;
}

export function isEnrollmentDocumentContentType(value: unknown): value is EnrollmentDocumentContentType {
  return typeof value === 'string' && (ENROLLMENT_DOCUMENT_ALLOWED_CONTENT_TYPES as readonly string[]).includes(value);
}

export function createEnrollmentDocumentStorageKey(): string {
  return randomBytes(32).toString('hex');
}

export function assertEnrollmentDocumentStorageKey(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-z0-9_-]{32,128}$/.test(value)) {
    throw new EnrollmentDocumentStorageError('INVALID_KEY', 'Chave de armazenamento documental inválida.');
  }
}

export async function collectEnrollmentDocumentContent(content: AsyncIterable<Uint8Array>): Promise<{ chunks: Uint8Array[]; byteSize: number; sha256: string }> {
  const hash = createHash('sha256');
  const chunks: Uint8Array[] = [];
  let byteSize = 0;
  for await (const chunk of content) {
    byteSize += chunk.byteLength;
    if (byteSize > ENROLLMENT_DOCUMENT_MAX_BYTES) throw new EnrollmentDocumentStorageError('MAX_BYTES_EXCEEDED', 'O ficheiro excede o limite de 6 MB.');
    hash.update(chunk);
    chunks.push(chunk);
  }
  if (!byteSize) throw new EnrollmentDocumentStorageError('WRITE_FAILED', 'O ficheiro documental está vazio.');
  return { chunks, byteSize, sha256: hash.digest('hex') };
}
