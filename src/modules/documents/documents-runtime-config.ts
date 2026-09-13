import type { ObjectStorageProvider } from './object-storage-provider.ts';
import {
  type DocumentAccessPolicyEngine,
  ConfigurableDocumentAccessPolicyEngine,
} from './document-access-policy.ts';
import type { RetentionPolicyEngine } from './document-retention-policy.ts';
import type { DocumentSizePolicyConfig } from './document-upload-model.ts';
import {
  GoogleCloudStorageObjectProvider,
  type GcsStorageClientLike,
} from './google-cloud-storage-provider.ts';

export interface DocumentsOperationalRuntimeConfig {
  storageProvider: ObjectStorageProvider | null;
  storageBucket: string | null;
  uploadPolicyConfig: DocumentSizePolicyConfig | null;
  policyEngine: DocumentAccessPolicyEngine | null;
  retentionPolicyEngine: RetentionPolicyEngine | null;
  accessGrantTokenKey: string | null;
  deletionPseudonymizationKey: string | null;
}

export interface ResolveDocumentsConfigOptions {
  env?: Record<string, string | undefined>;
  storageClient?: GcsStorageClientLike;
  customStorageProvider?: ObjectStorageProvider;
  customPolicyEngine?: DocumentAccessPolicyEngine;
  customRetentionPolicyEngine?: RetentionPolicyEngine;
}

/**
 * Validates and resolves Documents operational dependencies from runtime configuration.
 * Adheres strictly to fail-closed semantics: missing or invalid dependencies evaluate to null,
 * disabling dependent operational mutations while leaving read-only workspace fully functional.
 */
export function resolveDocumentsOperationalConfig(
  options: ResolveDocumentsConfigOptions = {},
): DocumentsOperationalRuntimeConfig {
  const env = options.env || process.env;

  // 1. Secrets validation (fail-closed if below 32 chars)
  const rawAccessKey = env.DOCUMENTS_ACCESS_GRANT_TOKEN_KEY?.trim();
  const accessGrantTokenKey =
    rawAccessKey && rawAccessKey.length >= 32 ? rawAccessKey : null;

  const rawDeletionKey = env.DOCUMENTS_DELETION_PSEUDONYMIZATION_KEY?.trim();
  const deletionPseudonymizationKey =
    rawDeletionKey && rawDeletionKey.length >= 32 ? rawDeletionKey : null;

  // 2. Storage Bucket
  const rawBucket = env.DOCUMENTS_STORAGE_BUCKET?.trim();
  const storageBucket = rawBucket && rawBucket.length > 0 ? rawBucket : null;

  // 3. Upload Size Policy (governed operational configuration; fail-closed if non-positive)
  let uploadPolicyConfig: DocumentSizePolicyConfig | null = null;
  const rawGlobalLimit = env.DOCUMENTS_GLOBAL_MAX_BYTE_SIZE?.trim();
  if (rawGlobalLimit) {
    const parsedGlobal = Number(rawGlobalLimit);
    if (!Number.isNaN(parsedGlobal) && parsedGlobal > 0) {
      const rawInstLimit = env.DOCUMENTS_INSTITUTION_MAX_BYTE_SIZE?.trim();
      const parsedInst = rawInstLimit ? Number(rawInstLimit) : undefined;
      uploadPolicyConfig = {
        globalMaxByteSize: parsedGlobal,
        institutionMaxByteSize:
          parsedInst && !Number.isNaN(parsedInst) && parsedInst > 0
            ? parsedInst
            : undefined,
      };
    }
  }

  // 4. Storage Provider Resolution
  let storageProvider: ObjectStorageProvider | null = null;
  if (options.customStorageProvider) {
    storageProvider = options.customStorageProvider;
  } else if (storageBucket) {
    const projectId =
      env.GOOGLE_CLOUD_PROJECT?.trim() || env.GCP_PROJECT_ID?.trim();
    storageProvider = new GoogleCloudStorageObjectProvider({
      client: options.storageClient,
      projectId,
      defaultBucket: storageBucket,
    });
  }

  // 5. Policy Engines (fail-closed if unconfigured)
  let policyEngine: DocumentAccessPolicyEngine | null =
    options.customPolicyEngine || null;
  if (!policyEngine && env.DOCUMENTS_ACCESS_POLICY_CONFIG?.trim()) {
    try {
      const parsed = JSON.parse(env.DOCUMENTS_ACCESS_POLICY_CONFIG.trim());
      if (Array.isArray(parsed)) {
        policyEngine = new ConfigurableDocumentAccessPolicyEngine(parsed);
      }
    } catch (e) {
      console.error('[DOCUMENTS-CONFIG] Invalid DOCUMENTS_ACCESS_POLICY_CONFIG:', e);
    }
  }
  const retentionPolicyEngine: RetentionPolicyEngine | null =
    options.customRetentionPolicyEngine || null;

  return {
    storageProvider,
    storageBucket,
    uploadPolicyConfig,
    policyEngine,
    retentionPolicyEngine,
    accessGrantTokenKey,
    deletionPseudonymizationKey,
  };
}
