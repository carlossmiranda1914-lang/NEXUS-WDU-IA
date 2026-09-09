import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');

// 1. Verify server.ts does not contain any Documents upload HTTP routes
const serverSource = await readFile(path.join(rootDir, 'server.ts'), 'utf8');
assert.strictEqual(
  serverSource.includes('/api/v1/documents/upload') ||
    serverSource.includes('/api/documents/upload-sessions') ||
    serverSource.includes('/api/v1/storage'),
  false,
  'server.ts must not register any Documents upload HTTP routes in I3',
);

// 2. Verify forbidden directories have no documents upload imports
const forbiddenPaths = [
  'src/modules/finance',
  'src/modules/enrollments',
  'src/modules/iam',
  'src/auth',
  'src/middleware',
];

for (const relPath of forbiddenPaths) {
  const fullPath = path.join(rootDir, relPath);
  const files = await readdir(fullPath);
  for (const file of files) {
    if (file.endsWith('.ts') || file.endsWith('.js')) {
      const content = await readFile(path.join(fullPath, file), 'utf8');
      assert.strictEqual(
        content.includes('document-upload') || content.includes('object-storage-provider'),
        false,
        `Forbidden file ${relPath}/${file} must not import from document-upload or object-storage-provider`,
      );
    }
  }
}

// 3. Verify migration 0033 is purely additive and does not alter forbidden tables
const migration0033 = await readFile(
  path.join(rootDir, 'src/db/migrations/0033_documents_storage_upload_foundation.sql'),
  'utf8',
);

const forbiddenTerms = [
  'alter table finance_',
  'alter table enrollment_',
  'alter table uploaded_documents',
  'alter table student_profiles',
  'alter table academic_',
  'alter table people',
  'alter table institutions',
  'alter table document_associations',
  'drop table',
  'truncate',
];

for (const term of forbiddenTerms) {
  assert.strictEqual(
    migration0033.toLowerCase().includes(term),
    false,
    `Migration 0033 must not contain "${term}"`,
  );
}

// 4. Verify no concrete external cloud storage providers are imported or declared in production files
const documentsDir = path.join(rootDir, 'src/modules/documents');
const docFiles = await readdir(documentsDir);
const forbiddenProviders = [
  '@google-cloud/storage',
  '@aws-sdk/client-s3',
  'aws-sdk',
  '@azure/storage-blob',
  'firebase-admin/storage',
];

for (const file of docFiles) {
  if (file.endsWith('.ts')) {
    const content = await readFile(path.join(documentsDir, file), 'utf8');
    for (const provider of forbiddenProviders) {
      assert.strictEqual(
        content.includes(provider),
        false,
        `Document module file ${file} must not import concrete provider "${provider}" in I3`,
      );
    }

    // Verify test provider is NOT in production module
    const testProviderTerms = ['MemoryObjectStorageProvider', 'memory_test_provider', 'simulateDirectUpload'];
    for (const term of testProviderTerms) {
      assert.strictEqual(
        content.includes(term),
        false,
        `Production module file ${file} must NOT contain test provider reference "${term}"`,
      );
    }

    // Verify I4 capabilities are not implemented in I3 upload files
    if (file.startsWith('document-upload') || file === 'object-storage-provider.ts') {
      const forbiddenI4Terms = ['malware_scan', 'quarantine_reason', 'scan_engine', 'magic_number_verified'];
      for (const term of forbiddenI4Terms) {
        assert.strictEqual(
          content.includes(term),
          false,
          `Document upload file ${file} must not contain I4 verification term "${term}"`,
        );
      }
    }
  }
}

// 5. Verify MemoryObjectStorageProvider is in test support directory
const testSupportPath = path.join(rootDir, 'tests/support/memory-object-storage-provider.ts');
const testSupportStat = await stat(testSupportPath);
assert.ok(testSupportStat.isFile(), 'tests/support/memory-object-storage-provider.ts must exist');

const testSupportContent = await readFile(testSupportPath, 'utf8');
assert.ok(
  testSupportContent.includes('MemoryObjectStorageProvider'),
  'MemoryObjectStorageProvider must be declared in test support file',
);

// 6. Verify schema.ts is untouched
const schemaSource = await readFile(path.join(rootDir, 'src/db/schema.ts'), 'utf8');
assert.strictEqual(
  schemaSource.includes('document_upload_sessions'),
  false,
  'src/db/schema.ts must remain untouched (migration runner is authoritative)',
);

console.log('[DOCUMENTS-UPLOAD-BOUNDARY-FENCE] PASS: Documents Upload boundary fence and test-support isolation verified statically.');
