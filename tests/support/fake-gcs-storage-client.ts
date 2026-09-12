import { Readable, PassThrough } from 'node:stream';
import type {
  GcsStorageClientLike,
  GcsBucketLike,
  GcsFileLike,
} from '../../src/modules/documents/google-cloud-storage-provider.ts';

export class FakeGcsFile implements GcsFileLike {
  public content: Buffer = Buffer.alloc(0);
  public contentType?: string;
  public customMetadata: Record<string, string> = {};
  public updated: Date = new Date();
  public existsOnStorage: boolean = false;
  public failNextDelete: boolean = false;

  constructor(public readonly name: string) {}

  createWriteStream(options?: {
    metadata?: { contentType?: string; metadata?: Record<string, string> };
    resumable?: boolean;
  }): NodeJS.WritableStream {
    this.contentType = options?.metadata?.contentType;
    if (options?.metadata?.metadata) {
      this.customMetadata = { ...options.metadata.metadata };
    }

    const pass = new PassThrough();
    const chunks: Buffer[] = [];

    pass.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    pass.on('finish', () => {
      this.content = Buffer.concat(chunks);
      this.existsOnStorage = true;
      this.updated = new Date();
    });

    return pass;
  }

  createReadStream(options?: { start?: number; end?: number }): NodeJS.ReadableStream {
    if (!this.existsOnStorage) {
      const fileName = this.name;
      const errStream = new Readable({
        read() {
          this.emit('error', new Error(`Object not found: ${fileName}`));
        },
      });
      return errStream;
    }

    let buffer = this.content;
    if (options && (options.start !== undefined || options.end !== undefined)) {
      const start = options.start ?? 0;
      const end = options.end !== undefined ? options.end + 1 : buffer.length;
      buffer = buffer.subarray(start, end);
    }

    return Readable.from(buffer);
  }

  async getMetadata(): Promise<[{
    size?: string | number;
    contentType?: string;
    updated?: string;
    md5Hash?: string;
    metadata?: Record<string, string>;
  }]> {
    if (!this.existsOnStorage) {
      const err: any = new Error(`Object not found: ${this.name}`);
      err.code = 404;
      throw err;
    }

    return [{
      size: this.content.length,
      contentType: this.contentType || 'application/octet-stream',
      updated: this.updated.toISOString(),
      metadata: this.customMetadata,
    }];
  }

  async exists(): Promise<[boolean]> {
    return [this.existsOnStorage];
  }

  async delete(options?: { ignoreNotFound?: boolean }): Promise<unknown> {
    if (this.failNextDelete) {
      this.failNextDelete = false;
      throw new Error('SIMULATED_GCS_DELETE_ERROR');
    }

    if (!this.existsOnStorage) {
      if (options?.ignoreNotFound) {
        return {};
      }
      const err: any = new Error(`Not Found: ${this.name}`);
      err.code = 404;
      throw err;
    }

    this.existsOnStorage = false;
    this.content = Buffer.alloc(0);
    return {};
  }
}

export class FakeGcsBucket implements GcsBucketLike {
  public files = new Map<string, FakeGcsFile>();

  constructor(public readonly name: string) {}

  file(name: string): FakeGcsFile {
    let f = this.files.get(name);
    if (!f) {
      f = new FakeGcsFile(name);
      this.files.set(name, f);
    }
    return f;
  }
}

export class FakeGcsStorageClient implements GcsStorageClientLike {
  public buckets = new Map<string, FakeGcsBucket>();

  bucket(name: string): FakeGcsBucket {
    let b = this.buckets.get(name);
    if (!b) {
      b = new FakeGcsBucket(name);
      this.buckets.set(name, b);
    }
    return b;
  }
}
