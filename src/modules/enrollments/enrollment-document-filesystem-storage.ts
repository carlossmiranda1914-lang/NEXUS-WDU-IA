import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import {
  assertEnrollmentDocumentStorageKey,
  ENROLLMENT_DOCUMENT_MAX_BYTES,
  EnrollmentDocumentStorageError,
  isEnrollmentDocumentContentType,
  type EnrollmentDocumentContentType,
  type EnrollmentDocumentStorage,
} from './enrollment-document-storage.ts';

function pathFor(root: string, storageKey: string, extension: '.blob' | '.tmp'): string {
  assertEnrollmentDocumentStorageKey(storageKey);
  const filePath = path.resolve(root, `${storageKey}${extension}`);
  if (path.dirname(filePath) !== path.resolve(root)) throw new EnrollmentDocumentStorageError('INVALID_KEY', 'Chave de armazenamento fora da raiz privada.');
  return filePath;
}

async function* readFile(pathname: string): AsyncIterable<Uint8Array> {
  for await (const chunk of createReadStream(pathname)) yield chunk as Uint8Array;
}

export class FilesystemEnrollmentDocumentStorage implements EnrollmentDocumentStorage {
  constructor(private readonly root: string) {
    if (!path.isAbsolute(root)) throw new EnrollmentDocumentStorageError('CONFIGURATION', 'ENROLLMENT_DOCUMENT_STORAGE_ROOT deve ser absoluto.');
  }

  async put(input: { storageKey: string; contentType: EnrollmentDocumentContentType; content: AsyncIterable<Uint8Array> }): Promise<{ byteSize: number; sha256: string }> {
    if (!isEnrollmentDocumentContentType(input.contentType)) throw new EnrollmentDocumentStorageError('INVALID_CONTENT_TYPE', 'Tipo documental não permitido.');
    const destination = pathFor(this.root, input.storageKey, '.blob');
    const temporary = pathFor(this.root, `${input.storageKey.slice(0, 48)}_${randomBytes(8).toString('hex')}`, '.tmp');
    await mkdir(this.root, { recursive: true });
    const output = createWriteStream(temporary, { flags: 'wx' });
    const hash = createHash('sha256');
    let byteSize = 0;
    try {
      for await (const chunk of input.content) {
        byteSize += chunk.byteLength;
        if (byteSize > ENROLLMENT_DOCUMENT_MAX_BYTES) throw new EnrollmentDocumentStorageError('MAX_BYTES_EXCEEDED', 'O ficheiro excede o limite de 6 MB.');
        hash.update(chunk);
        if (!output.write(chunk)) await new Promise<void>((resolve, reject) => { output.once('drain', resolve); output.once('error', reject); });
      }
      if (!byteSize) throw new EnrollmentDocumentStorageError('WRITE_FAILED', 'O ficheiro documental está vazio.');
      await new Promise<void>((resolve, reject) => output.end(() => resolve()).once('error', reject));
      await rename(temporary, destination);
      return { byteSize, sha256: hash.digest('hex') };
    } catch (error) {
      output.destroy();
      await rm(temporary, { force: true }).catch(() => undefined);
      if (error instanceof EnrollmentDocumentStorageError) throw error;
      throw new EnrollmentDocumentStorageError('WRITE_FAILED', 'Não foi possível persistir o ficheiro documental.');
    }
  }

  async open(storageKey: string): Promise<{ content: AsyncIterable<Uint8Array> }> {
    const pathname = pathFor(this.root, storageKey, '.blob');
    try { await stat(pathname); } catch { throw new EnrollmentDocumentStorageError('NOT_FOUND', 'Ficheiro documental não encontrado.'); }
    return { content: readFile(pathname) };
  }

  async delete(storageKey: string): Promise<void> {
    await rm(pathFor(this.root, storageKey, '.blob'), { force: true });
  }
}

export function createFilesystemEnrollmentDocumentStorage(environment: NodeJS.ProcessEnv = process.env): FilesystemEnrollmentDocumentStorage {
  const root = environment.ENROLLMENT_DOCUMENT_STORAGE_ROOT?.trim();
  if (!root) throw new EnrollmentDocumentStorageError('CONFIGURATION', 'ENROLLMENT_DOCUMENT_STORAGE_ROOT é obrigatório para armazenamento documental.');
  return new FilesystemEnrollmentDocumentStorage(root);
}
