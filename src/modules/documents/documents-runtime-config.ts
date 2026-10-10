import path from 'node:path';
import type { ObjectStorageProvider } from './object-storage-provider.ts';
import {
  type DocumentAccessPolicyEngine,
  type DocumentAccessPolicyRule,
  ConfigurableDocumentAccessPolicyEngine,
} from './document-access-policy.ts';
import {
  type RetentionPolicyEngine,
  type RetentionPolicyConfig,
  ConfigurableRetentionPolicyEngine,
} from './document-retention-policy.ts';
import { CANONICAL_DOCUMENT_CATEGORIES } from './document-model.ts';
import type { DocumentSizePolicyConfig } from './document-upload-model.ts';
import {
  GoogleCloudStorageObjectProvider,
  type GcsStorageClientLike,
} from './google-cloud-storage-provider.ts';
import { LocalUatObjectStorageProvider } from './local-uat-storage-provider.ts';

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

const DEFAULT_LOCAL_UAT_ROLES = [
  'admin',
  'institution_admin',
  'director',
  'secretary',
  'staff',
  'teacher',
  'guardian',
  'student',
  'superadmin',
] as const;

function createLocalUatAccessPolicyRules(): DocumentAccessPolicyRule[] {
  const rules: DocumentAccessPolicyRule[] = [];
  for (const role of DEFAULT_LOCAL_UAT_ROLES) {
    rules.push({
      role,
      category: '*',
      allowedActions: ['open_content', 'download_content'],
    });
  }
  return rules;
}

function createLocalUatRetentionPolicies(): RetentionPolicyConfig[] {
  return CANONICAL_DOCUMENT_CATEGORIES.map((cat) => ({
    policyId: `local-uat-retention-${cat.id}`,
    policyVersion: '1.0',
    jurisdictionProfileId: 'DEFAULT_JURISDICTION',
    jurisdictionProfileVersion: '1.0',
    category: cat.id,
    clockTriggerType: 'document_verified',
    retentionDurationDays: 365 * 5,
    allowedHoldTypes: ['legal', 'administrative'],
    allowedDeletionAuthorityScopePatterns: ['admin', 'institution_admin', 'director'],
  }));
}

// Singleton local UAT storage provider for in-memory persistence during local sessions
let sharedLocalUatStorageProvider: LocalUatObjectStorageProvider | null = null;

export function getSharedLocalUatStorageProvider(customDir?: string): LocalUatObjectStorageProvider {
  if (!sharedLocalUatStorageProvider) {
    const rawDir = customDir || process.env.DOCUMENTS_LOCAL_UAT_STORAGE_DIR;
    if (!rawDir) {
      throw new Error(
        'LOCAL_UAT_STORAGE_DIR_REQUIRED: Local UAT storage requires explicit absolute path configuration (DOCUMENTS_LOCAL_UAT_STORAGE_DIR).',
      );
    }
    if (!path.isAbsolute(rawDir)) {
      throw new Error(
        `LOCAL_UAT_STORAGE_DIR_MUST_BE_ABSOLUTE: DOCUMENTS_LOCAL_UAT_STORAGE_DIR must be an absolute path: "${rawDir}".`,
      );
    }
    sharedLocalUatStorageProvider = new LocalUatObjectStorageProvider(rawDir);
    console.log(
      `[DOCUMENTS STORAGE] Local UAT Storage Provider initialized with verified absolute directory: ${sharedLocalUatStorageProvider.getEffectiveBaseDir()}`,
    );
  }
  return sharedLocalUatStorageProvider;
}

/**
 * Validates and resolves Documents operational dependencies from runtime configuration.
 * In production (NODE_ENV === 'production'), adheres strictly to fail-closed semantics.
 * In non-production/local-UAT, provides fully functional local UAT operational defaults
 * so that the real browser UAT workflow (upload, verification, access, hold, deletion)
 * operates seamlessly without fake mocks or hardcoded frontend data.
 */
export function resolveDocumentsOperationalConfig(
  options: ResolveDocumentsConfigOptions = {},
): DocumentsOperationalRuntimeConfig {
  const env = options.env || process.env;
  const isProduction = env.NODE_ENV === 'production';

  // 1. Secrets validation (32+ chars; local fallback in non-production)
  const rawAccessKey = env.DOCUMENTS_ACCESS_GRANT_TOKEN_KEY?.trim();
  const accessGrantTokenKey =
    rawAccessKey && rawAccessKey.length >= 32
      ? rawAccessKey
      : !isProduction
      ? 'nexus-local-uat-access-grant-token-key-32chars!'
      : null;

  const rawDeletionKey = env.DOCUMENTS_DELETION_PSEUDONYMIZATION_KEY?.trim();
  const deletionPseudonymizationKey =
    rawDeletionKey && rawDeletionKey.length >= 32
      ? rawDeletionKey
      : !isProduction
      ? 'nexus-local-uat-deletion-pseudonymization-key-32chars!'
      : null;

  // 2. Storage Bucket
  const rawBucket = env.DOCUMENTS_STORAGE_BUCKET?.trim();
  const storageBucket =
    rawBucket && rawBucket.length > 0
      ? rawBucket
      : !isProduction
      ? 'nexus-local-uat-documents-bucket'
      : null;

  // 3. Upload Size Policy (governed operational configuration)
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
  } else if (!isProduction) {
    // 50MB default limit for local UAT
    uploadPolicyConfig = {
      globalMaxByteSize: 50 * 1024 * 1024,
      institutionMaxByteSize: 50 * 1024 * 1024,
    };
  }

  // 4. Storage Provider Resolution
  let storageProvider: ObjectStorageProvider | null = null;
  if (options.customStorageProvider) {
    storageProvider = options.customStorageProvider;
  } else if (
    (env.DOCUMENTS_STORAGE_PROVIDER === 'local_uat' ||
      env.DOCUMENTS_STORAGE_PROVIDER === 'local' ||
      !env.DOCUMENTS_STORAGE_BUCKET ||
      env.DOCUMENTS_STORAGE_BUCKET.includes('local')) &&
    !isProduction
  ) {
    storageProvider = getSharedLocalUatStorageProvider();
  } else if (storageBucket) {
    const projectId =
      env.GOOGLE_CLOUD_PROJECT?.trim() || env.GCP_PROJECT_ID?.trim();
    if (projectId) {
      storageProvider = new GoogleCloudStorageObjectProvider({
        client: options.storageClient,
        projectId,
        defaultBucket: storageBucket,
      });
    } else if (!isProduction) {
      storageProvider = getSharedLocalUatStorageProvider();
    }
  } else if (!isProduction) {
    storageProvider = getSharedLocalUatStorageProvider();
  }

  // 5. Policy Engines
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
  if (!policyEngine && !isProduction) {
    policyEngine = new ConfigurableDocumentAccessPolicyEngine(
      createLocalUatAccessPolicyRules(),
    );
  }

  let retentionPolicyEngine: RetentionPolicyEngine | null =
    options.customRetentionPolicyEngine || null;
  if (!retentionPolicyEngine && !isProduction) {
    retentionPolicyEngine = new ConfigurableRetentionPolicyEngine(
      createLocalUatRetentionPolicies(),
    );
  }

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
