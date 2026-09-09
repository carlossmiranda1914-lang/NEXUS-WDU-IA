import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsModuleDir = path.resolve(rootDir, 'src/modules/documents');

// 1. Check production files in src/modules/documents
const prodFiles = fs.readdirSync(docsModuleDir);

// Verify no test providers in production modules
for (const file of prodFiles) {
  const content = fs.readFileSync(path.join(docsModuleDir, file), 'utf8');
  assert.strictEqual(
    content.includes('MemoryObjectStorageProvider'),
    false,
    `MemoryObjectStorageProvider must not be referenced in production file: ${file}`,
  );
  assert.strictEqual(
    content.includes('DeterministicTestMalwareScanner'),
    false,
    `DeterministicTestMalwareScanner must not be referenced in production file: ${file}`,
  );
}

// 2. Verify forbidden I5 terms in I4 production files
const i4Files = [
  'document-verification-model.ts',
  'document-verification-repository.ts',
  'document-verification-command.ts',
  'malware-scanner.ts',
  'content-type-detector.ts',
];

const forbiddenI5Terms = [
  'download_token',
  'presigned_download_url',
  'createDownloadAuthorization',
  'content_access_token',
  'temporary_download_grant',
  'retention_assignment',
  'retention_hold',
  'executeDeletion',
];

for (const f of i4Files) {
  const filePath = path.join(docsModuleDir, f);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const term of forbiddenI5Terms) {
      assert.strictEqual(
        content.includes(term),
        false,
        `Forbidden future-mission term "${term}" found in ${f}`,
      );
    }
  }
}

// 3. Verify no concrete production storage or malware provider in src/modules/documents
const forbiddenConcreteProviders = [
  'ClamAVScanner',
  'AwsS3StorageProvider',
  'GoogleCloudStorageProvider',
  'AzureBlobStorageProvider',
  'VirusTotalScanner',
  'DefenderScanner',
];

for (const file of prodFiles) {
  const content = fs.readFileSync(path.join(docsModuleDir, file), 'utf8');
  for (const provider of forbiddenConcreteProviders) {
    assert.strictEqual(
      content.includes(provider),
      false,
      `Forbidden concrete provider "${provider}" found in production file: ${file}`,
    );
  }
}

console.log('[DOCUMENTS-VERIFICATION-BOUNDARY-FENCE] PASS: Documents Verification boundary fence and test-support isolation verified statically.');
