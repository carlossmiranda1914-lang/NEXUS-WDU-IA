import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');

// 1. Verify server.ts does not contain any Documents HTTP routes
const serverSource = await readFile(path.join(rootDir, 'server.ts'), 'utf8');
assert.strictEqual(
  serverSource.includes('/api/v1/documents'),
  false,
  'server.ts must not register any /api/v1/documents HTTP routes in I1',
);

// 2. Verify forbidden directories have no documents imports or mutations
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
        content.includes('modules/documents'),
        false,
        `Forbidden file ${relPath}/${file} must not import from modules/documents`,
      );
    }
  }
}

// 3. Verify migration 0031 is purely additive and does not alter forbidden tables
const migration0031 = await readFile(
  path.join(rootDir, 'src/db/migrations/0031_documents_core_authority.sql'),
  'utf8',
);

const forbiddenTables = [
  'finance_',
  'enrollment_applications',
  'enrollment_documents',
  'uploaded_documents',
  'student_profiles',
  'academic_',
  'operational_logs',
];

for (const forbidden of forbiddenTables) {
  assert.strictEqual(
    migration0031.toLowerCase().includes(`alter table ${forbidden}`),
    false,
    `Migration 0031 must not alter table ${forbidden}`,
  );
  assert.strictEqual(
    migration0031.toLowerCase().includes(`drop table ${forbidden}`),
    false,
    `Migration 0031 must not drop table ${forbidden}`,
  );
}

console.log('[DOCUMENTS-BOUNDARY-FENCE] PASS: Documents boundary fence verified statically.');
