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

export interface TrustedWorkerAuthority {
  readonly kind: 'trusted_system_worker';
  readonly workerId: string;
  readonly workerName?: string;
  readonly authorizedAt?: Date;
}

export interface VerifyDocumentJobInput {
  institutionId: string;
  documentId: string;
  versionId: string;
  actorPersonId?: string;
  idempotencyKey?: string;
}

export interface VerificationWorkerOptions {
  pool: Pool;
  trustedAuthority: TrustedWorkerAuthority;
  storageProvider?: ObjectStorageProvider;
  malwareScanner?: MalwareScanner;
  storageBucket?: string;
  gcpProjectId?: string;
  clamavHost?: string;
  clamavPort?: number;
  clamavServiceUrl?: string;
}

export interface SystemWorkerContext {
  readonly kind: 'system_worker';
  readonly institutionId: string;
  readonly institutionName: string;
  readonly institutionSlug: string;
  readonly workerId: string;
  readonly workerName: string;
  readonly role: 'system';
  readonly personId: string | null;
  readonly personName?: string;
  readonly identityEmail: string | null;
  readonly membershipId: string | null;
}

export type DocumentExecutionContext = InstitutionalContext | SystemWorkerContext;

export class DocumentVerificationWorker {
  private readonly pool: Pool;
  private readonly trustedAuthority: TrustedWorkerAuthority;
  private readonly storageProvider: ObjectStorageProvider;
  private readonly malwareScanner: MalwareScanner;
  private readonly contentTypeDetector: ContentTypeDetector;

  constructor(options: VerificationWorkerOptions) {
    if (
      !options.trustedAuthority ||
      options.trustedAuthority.kind !== 'trusted_system_worker' ||
      !options.trustedAuthority.workerId
    ) {
      throw new Error(
        'MISSING_TRUSTED_WORKER_AUTHORITY: DocumentVerificationWorker requires explicit trusted system worker authority',
      );
    }
    this.trustedAuthority = options.trustedAuthority;
    this.pool = options.pool;

    const bucket = options.storageBucket || process.env.DOCUMENTS_STORAGE_BUCKET;
    if (!bucket && !options.storageProvider) {
      throw new Error(
        'MISSING_STORAGE_BUCKET_CONFIG: Storage bucket must be explicitly injected or resolved from DOCUMENTS_STORAGE_BUCKET',
      );
    }

    const projectId = options.gcpProjectId || process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId && !options.storageProvider) {
      throw new Error(
        'MISSING_GCP_PROJECT_CONFIG: GCP Project must be explicitly injected or resolved from GOOGLE_CLOUD_PROJECT',
      );
    }

    this.storageProvider =
      options.storageProvider ||
      new GoogleCloudStorageObjectProvider({
        projectId: projectId!,
        defaultBucket: bucket!,
      });

    this.malwareScanner =
      options.malwareScanner ||
      new ClamAvMalwareScanner({
        serviceUrl: options.clamavServiceUrl || process.env.CLAMAV_SERVICE_URL,
        host: options.clamavHost || process.env.CLAMAV_HOST || '127.0.0.1',
        port: options.clamavPort || Number(process.env.CLAMAV_PORT || 3310),
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
    // 1. Validate explicit trusted authority (fail-closed)
    if (
      !this.trustedAuthority ||
      this.trustedAuthority.kind !== 'trusted_system_worker' ||
      !this.trustedAuthority.workerId
    ) {
      throw new Error(
        'MISSING_TRUSTED_WORKER_AUTHORITY: Fail-closed on missing or invalid trusted worker authority',
      );
    }

    // 2. Resolve real institution from database (no fabricated institution metadata)
    const instRes = await this.pool.query<{
      id: string;
      name: string;
      slug: string;
      status: string;
    }>(
      `SELECT id, name, slug, status FROM institutions WHERE id = $1`,
      [job.institutionId],
    );

    if (instRes.rows.length === 0 || instRes.rows[0].status !== 'active') {
      throw new Error(
        `INSTITUTION_NOT_FOUND_OR_INACTIVE: Institution ${job.institutionId} does not exist or is inactive`,
      );
    }

    const inst = instRes.rows[0];

    // 3. Resolve real actor identity if provided, or execute as trusted system worker authority (no fabricated membership, no zero UUID placeholders)
    let personId: string | null = null;
    let personName: string = this.trustedAuthority.workerName || `System Worker (${this.trustedAuthority.workerId})`;
    let identityEmail: string | null = null;
    let membershipId: string | null = null;

    if (job.actorPersonId) {
      const personRes = await this.pool.query<{
        id: string;
        name: string;
        email: string | null;
        membership_id: string | null;
      }>(
        `SELECT p.id, p.name, idn.email, m.id as membership_id
           FROM people p
      LEFT JOIN identities idn ON idn.person_id = p.id
      LEFT JOIN memberships m ON m.person_id = p.id AND m.institution_id = $2 AND m.status = 'active'
          WHERE p.id = $1`,
        [job.actorPersonId, inst.id],
      );

      if (personRes.rows.length > 0) {
        const row = personRes.rows[0];
        personId = row.id;
        personName = row.name;
        identityEmail = row.email;
        if (row.membership_id) {
          membershipId = row.membership_id;
        }
      }
    }

    // Explicit system execution context (WORKER_ROLE=SYSTEM, no institution_admin impersonation, no zero UUIDs)
    const context: SystemWorkerContext = {
      kind: 'system_worker',
      institutionId: inst.id,
      institutionName: inst.name,
      institutionSlug: inst.slug,
      workerId: this.trustedAuthority.workerId,
      workerName: personName,
      role: 'system',
      personId,
      identityEmail,
      membershipId,
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
