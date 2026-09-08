import assert from 'node:assert/strict';
import {
  validateDocumentCategory,
  validateMimeType,
  validateSha256Hash,
  validateByteSize,
  canonicalizeJson,
  createCanonicalDocumentsFingerprint,
} from '../src/modules/documents/document-model.ts';
import {
  createDocumentCreationFingerprint,
  createAppendVersionFingerprint,
} from '../src/modules/documents/document-command.ts';

// 1. Invariants validation
assert.throws(() => validateDocumentCategory(''), /Invalid document category/);
assert.throws(() => validateDocumentCategory('a'), /Invalid document category/);
assert.doesNotThrow(() => validateDocumentCategory('identity_proof'));
assert.doesNotThrow(() => validateDocumentCategory('academic_transcript'));

assert.throws(() => validateMimeType(''), /Invalid mime type/);
assert.throws(() => validateMimeType('pdf'), /Invalid mime type/);
assert.doesNotThrow(() => validateMimeType('application/pdf'));
assert.doesNotThrow(() => validateMimeType('image/png'));

assert.throws(() => validateSha256Hash('123'), /Invalid SHA-256 hash/);
assert.throws(() => validateSha256Hash('G'.repeat(64)), /Invalid SHA-256 hash/);
assert.doesNotThrow(() => validateSha256Hash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'));

assert.throws(() => validateByteSize(-1), /Invalid byte size/);
assert.throws(() => validateByteSize(1.5), /Invalid byte size/);
assert.doesNotThrow(() => validateByteSize(0));
assert.doesNotThrow(() => validateByteSize(1024));

// 2. Canonical JSON & Deterministic Hashing
const obj1 = { b: 2, a: 1, c: { z: 26, y: 25 } };
const obj2 = { a: 1, c: { y: 25, z: 26 }, b: 2 };
assert.strictEqual(
  createCanonicalDocumentsFingerprint(obj1),
  createCanonicalDocumentsFingerprint(obj2),
  'Canonical fingerprint must be key-order independent',
);

// 3. Command fingerprint deterministic generation
const fp1 = createDocumentCreationFingerprint(
  '00000000-0000-0000-0000-000000000001',
  {
    category: 'identity_proof',
    classification: 'passport',
    mimeType: 'application/pdf',
    byteSize: 1048576,
    sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    provenance: {
      originType: 'user_upload',
      actorPersonId: '00000000-0000-0000-0000-000000000002',
      sourceDomain: 'portal',
      method: 'direct_upload',
      correlationId: 'req-1234',
    },
  },
  '00000000-0000-0000-0000-000000000002',
);

const fp2 = createDocumentCreationFingerprint(
  '00000000-0000-0000-0000-000000000001',
  {
    category: 'identity_proof',
    classification: 'passport',
    mimeType: 'application/pdf',
    byteSize: 1048576,
    sha256Hash: 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855', // Case insensitive
    provenance: {
      originType: 'user_upload',
      sourceDomain: 'portal',
      actorPersonId: '00000000-0000-0000-0000-000000000002',
      method: 'direct_upload',
      correlationId: 'req-1234',
    },
  },
  '00000000-0000-0000-0000-000000000002',
);

assert.strictEqual(fp1, fp2, 'Fingerprints must match for identical semantic payloads regardless of field ordering or hash case');

console.log('[DOCUMENTS-CORE-MODEL] PASS: Domain invariants and deterministic fingerprinting verified.');
