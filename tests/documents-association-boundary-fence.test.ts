import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');

// 1. Verify server.ts does not contain any Documents HTTP routes
const serverSource = await readFile(path.join(rootDir, 'server.ts'), 'utf8');
assert.strictEqual(
  serverSource.includes('/api/v1/documents') || serverSource.includes('/api/documents/associations'),
  false,
  'server.ts must not register any Documents association HTTP routes in I2',
);

// 2. Verify forbidden directories have no documents association imports
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
        content.includes('document-association'),
        false,
        `Forbidden file ${relPath}/${file} must not import from document-association`,
      );
    }
  }
}

// 3. Verify migration 0032 is purely additive and does not alter forbidden tables or add business approval flags
const migration0032 = await readFile(
  path.join(rootDir, 'src/db/migrations/0032_documents_associations_authority.sql'),
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
  'approved boolean',
  'is_approved',
  'is_paid',
  'is_enrolled',
];

for (const term of forbiddenTerms) {
  assert.strictEqual(
    migration0032.toLowerCase().includes(term),
    false,
    `Migration 0032 must not contain "${term}"`,
  );
}

// 4. Verify I2 files do not directly import domain repositories or tables
const i2Dir = path.join(rootDir, 'src/modules/documents');
const i2Files = await readdir(i2Dir);
for (const file of i2Files) {
  if (file.includes('association')) {
    const content = await readFile(path.join(i2Dir, file), 'utf8');
    assert.strictEqual(
      content.includes('../enrollments') || content.includes('../finance') || content.includes('../academic'),
      false,
      `I2 file ${file} must not import directly from other bounded contexts`,
    );
  }
}

console.log('[DOCUMENTS-ASSOCIATION-BOUNDARY-FENCE] PASS: Documents Association boundary fence verified statically.');
