/**
 * Dedicated Asynchronous Technical Verification Worker
 * Mission: DOCUMENTS-FOUNDATION-I8D / I4
 */

import type { Pool } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { executeTechnicalVerificationPipelineCommand, type PipelineExecutionResult } from './document-verification-command.ts';
import { GoogleCloudStorageObjectProvider } from './google-cloud-storage-provider.ts';
import { ClamAvMalwareScanner } from './clamav-malware-scanner.ts';
import { ContentTypeDetector } from './content-type-detector.ts';
import type { MalwareScanner } from './malware-scanner.ts';
import type { ObjectStorageProvider } from './object-storage-provider.ts';

export interface VerifyDocumentJobInput {
  institutionId: string;
  documentId: string;
  versionId: string;
  actorPersonId?: string;
  idempotencyKey?: string;
}

export interface VerificationWorkerOptions {
  pool: Pool;
  storageProvider?: ObjectStorageProvider;
  malwareScanner?: MalwareScanner;
  storageBucket?: string;
  gcpProjectId?: string;
}

export class DocumentVerificationWorker {
  private readonly pool: Pool;
  private readonly storageProvider: ObjectStorageProvider;
  private readonly malwareScanner: MalwareScanner;
  private readonly contentTypeDetector: ContentTypeDetector;

  constructor(options: VerificationWorkerOptions) {
    this.pool = options.pool;
    const bucket = options.storageBucket || process.env.DOCUMENTS_STORAGE_BUCKET || 'nexus-staging-documents-eu';
    const projectId = options.gcpProjectId || process.env.GOOGLE_CLOUD_PROJECT || 'nexus-wdu-staging';

    this.storageProvider =
      options.storageProvider ||
      new GoogleCloudStorageObjectProvider({
        projectId,
        defaultBucket: bucket,
      });

    this.malwareScanner =
      options.malwareScanner ||
      new ClamAvMalwareScanner({
        host: process.env.CLAMAV_HOST || '127.0.0.1',
        port: Number(process.env.CLAMAV_PORT || 3310),
      });

    this.contentTypeDetector = new ContentTypeDetector({
      maxPrefixInspectionBytes: 4096,
      zipMetadataInspectionLimit: 65536,
      maxContainerEntryCount: 100,
      maxContainerMetadataBytes: 131072,
    });
  }

  public async processVerificationJob(job: VerifyDocumentJobInput): Promise<{
    replayed: boolean;
    result: PipelineExecutionResult;
  }> {
    const context: InstitutionalContext = {
      institutionId: job.institutionId,
      institutionName: 'Staging Institution',
      institutionSlug: 'staging-inst',
      personId: job.actorPersonId || '00000000-0000-0000-0000-000000000001',
      personName: 'Verification Worker System',
      identityEmail: 'worker@nexus.edu',
      membershipId: '00000000-0000-0000-0000-000000000001',
      role: 'institution_admin',
    };

    const idempotencyKey =
      job.idempotencyKey ||
      `verify-job:${job.institutionId}:${job.documentId}:${job.versionId}`;

    return executeTechnicalVerificationPipelineCommand({
      pool: this.pool,
      context,
      idempotencyKey,
      input: {
        documentId: job.documentId,
        versionId: job.versionId,
        storageProvider: this.storageProvider,
        malwareScanner: this.malwareScanner,
        contentTypeDetector: this.contentTypeDetector,
        retryPolicy: {
          maxAttempts: 3,
          baseBackoffMs: 30000,
          maxBackoffMs: 3600000,
        },
      },
    });
  }
}
