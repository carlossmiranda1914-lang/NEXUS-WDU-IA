import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsModuleDir = path.resolve(rootDir, 'src/modules/documents');

// 1. Check production files in src/modules/documents
const prodFiles = fs.readdirSync(docsModuleDir);

// Verify no test providers or test support imports in production modules
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
  assert.strictEqual(
    content.includes('../../tests/'),
    false,
    `Test paths must not be imported in production file: ${file}`,
  );
}

// 2. Verify forbidden future terms (I7+) in I6 production files
const i6Files = [
  'document-retention-model.ts',
  'document-retention-policy.ts',
  'document-retention-repository.ts',
  'document-retention-command.ts',
  'document-deletion-command.ts',
];

const forbiddenFutureTerms = [
  'ocr_text_extraction',
  'ai_document_summary',
  'cross_institution_share',
  'federated_document_trust',
  'vector_embedding_index',
  'semantic_search_corpus',
];

for (const f of i6Files) {
  const filePath = path.join(docsModuleDir, f);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const term of forbiddenFutureTerms) {
      assert.strictEqual(
        content.includes(term),
        false,
        `Forbidden future-mission term "${term}" found in ${f}`,
      );
    }
  }
}

// 3. Verify no forbidden cross-bounded context imports in I6 files
const forbiddenModules = ['finance', 'enrollments', 'school-tasks', 'student-context', 'academic'];
for (const f of i6Files) {
  const filePath = path.join(docsModuleDir, f);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const mod of forbiddenModules) {
      assert.strictEqual(
        content.includes(`modules/${mod}`),
        false,
        `Forbidden cross-module import from "${mod}" found in ${f}`,
      );
    }
  }
}

console.log('[DOCUMENTS-RETENTION-BOUNDARY-FENCE] PASS: Documents Retention & Deletion boundary fence and test-support isolation verified statically.');
