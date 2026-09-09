import assert from 'node:assert/strict';
import {
  calculateEffectiveSizeLimit,
  sanitizeDeclaredFilename,
  validateDeclaredMimeType,
  validateDeclaredByteSize,
  generateOpaqueStorageKey,
  generateCsprngUploadToken,
  hashUploadToken,
  verifyUploadToken,
  validateUploadSessionTransition,
} from '../src/modules/documents/document-upload-model.ts';
import {
  createUploadSessionFingerprint,
  resumeUploadSessionFingerprint,
  cancelUploadSessionFingerprint,
  completeUploadSessionFingerprint,
} from '../src/modules/documents/document-upload-command.ts';
import { MemoryObjectStorageProvider } from '../src/modules/documents/object-storage-provider.ts';

// 1. Size Policy Evaluation - FAIL CLOSED invariant
assert.throws(
  () => calculateEffectiveSizeLimit({} as any),
  /GLOBAL_SIZE_LIMIT_REQUIRED/,
  'Missing global limit must fail closed',
);

assert.throws(
  () => calculateEffectiveSizeLimit({ globalMaxByteSize: 0 } as any),
  /GLOBAL_SIZE_LIMIT_REQUIRED/,
  'Zero global limit must fail closed',
);

assert.throws(
  () => calculateEffectiveSizeLimit({ globalMaxByteSize: -100 } as any),
  /GLOBAL_SIZE_LIMIT_REQUIRED/,
  'Negative global limit must fail closed',
);

// Global limit alone
const limit1 = calculateEffectiveSizeLimit({ globalMaxByteSize: 50 * 1024 * 1024 });
assert.strictEqual(limit1, 50 * 1024 * 1024);

// Global + Institution limit (institution tighter)
const limit2 = calculateEffectiveSizeLimit({
  globalMaxByteSize: 50 * 1024 * 1024,
  institutionMaxByteSize: 20 * 1024 * 1024,
});
assert.strictEqual(limit2, 20 * 1024 * 1024);

// Global + Category limit (category tighter)
const limit3 = calculateEffectiveSizeLimit({
  globalMaxByteSize: 50 * 1024 * 1024,
  categoryMaxByteSize: 5 * 1024 * 1024,
});
assert.strictEqual(limit3, 5 * 1024 * 1024);

// Global + Institution + Category (min evaluated)
const limit4 = calculateEffectiveSizeLimit({
  globalMaxByteSize: 50 * 1024 * 1024,
  institutionMaxByteSize: 30 * 1024 * 1024,
  categoryMaxByteSize: 10 * 1024 * 1024,
});
assert.strictEqual(limit4, 10 * 1024 * 1024);

// Declared size validations
assert.throws(() => validateDeclaredByteSize(0), /Invalid declaredByteSize/i);
assert.throws(() => validateDeclaredByteSize(-10), /Invalid declaredByteSize/i);
assert.throws(() => validateDeclaredByteSize(1.5), /Invalid declaredByteSize/i);
assert.doesNotThrow(() => validateDeclaredByteSize(1024));

// 2. Filename Safety and Sanitization
assert.throws(() => sanitizeDeclaredFilename(''), /declaredFilename/i);
assert.throws(() => sanitizeDeclaredFilename('   '), /declaredFilename/i);
assert.throws(() => sanitizeDeclaredFilename('test\0bad.pdf'), /control|invalid|unsafe/i);
assert.throws(() => sanitizeDeclaredFilename('test\nfile.pdf'), /control|invalid|unsafe/i);

// Path traversal stripping
assert.strictEqual(sanitizeDeclaredFilename('../../../etc/passwd'), 'passwd');
assert.strictEqual(sanitizeDeclaredFilename('..\\..\\windows\\system32\\cmd.exe'), 'cmd.exe');
assert.strictEqual(sanitizeDeclaredFilename('/var/data/uploads/my-doc.pdf'), 'my-doc.pdf');
assert.strictEqual(sanitizeDeclaredFilename('C:\\Users\\admin\\secret.png'), 'secret.png');
assert.strictEqual(sanitizeDeclaredFilename('clean_filename_v1.0.pdf'), 'clean_filename_v1.0.pdf');

// 3. Declared MIME Validation
assert.throws(() => validateDeclaredMimeType(''), /declaredMimeType/i);
assert.throws(() => validateDeclaredMimeType('pdf'), /declaredMimeType/i);
assert.throws(() => validateDeclaredMimeType('application/'), /declaredMimeType/i);
assert.doesNotThrow(() => validateDeclaredMimeType('application/pdf'));
assert.doesNotThrow(() => validateDeclaredMimeType('image/png'));
assert.doesNotThrow(() => validateDeclaredMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'));

// 4. Opaque Storage Key Generation (NO PII)
const instId = '11111111-1111-1111-1111-111111111111';
const docId = '22222222-2222-2222-2222-222222222222';
const sessId = '33333333-3333-3333-3333-333333333333';
const objId = '44444444-4444-4444-4444-444444444444';

const storageKey = generateOpaqueStorageKey({
  institutionId: instId,
  documentId: docId,
  sessionId: sessId,
  objectId: objId,
});

assert.strictEqual(storageKey, `inst_${instId}/doc_${docId}/session_${sessId}/${objId}`);
assert.ok(!storageKey.includes('john'), 'No student name in storage key');
assert.ok(!storageKey.includes('@'), 'No email in storage key');
assert.ok(!storageKey.includes('.pdf'), 'No declared filename or extension in storage key');

// 5. CSPRNG Token Generation, Hashing & Verification
const rawToken = generateCsprngUploadToken();
assert.strictEqual(rawToken.length, 128, '64 raw random bytes in hex is 128 hex chars');
const tokenHash = hashUploadToken(rawToken);
assert.strictEqual(tokenHash.length, 64, 'SHA-256 hash must be 64 hex chars');

assert.strictEqual(verifyUploadToken(rawToken, tokenHash), true, 'Valid raw token must verify against its hash');
assert.strictEqual(verifyUploadToken('invalid_token', tokenHash), false, 'Invalid raw token must fail verification');
assert.strictEqual(verifyUploadToken(rawToken, 'a'.repeat(64)), false, 'Mismatched hash must fail verification');

// 6. Upload Session Lifecycle State Machine
// Valid transitions
assert.doesNotThrow(() => validateUploadSessionTransition('created', 'authorized'));
assert.doesNotThrow(() => validateUploadSessionTransition('authorized', 'uploading'));
assert.doesNotThrow(() => validateUploadSessionTransition('authorized', 'cancelled'));
assert.doesNotThrow(() => validateUploadSessionTransition('authorized', 'expired'));
assert.doesNotThrow(() => validateUploadSessionTransition('uploading', 'completed'));
assert.doesNotThrow(() => validateUploadSessionTransition('uploading', 'failed'));
assert.doesNotThrow(() => validateUploadSessionTransition('uploading', 'cancelled'));
assert.doesNotThrow(() => validateUploadSessionTransition('uploading', 'expired'));
assert.doesNotThrow(() => validateUploadSessionTransition('failed', 'uploading')); // Retry upload within session

// Invalid transitions from terminal states
assert.throws(() => validateUploadSessionTransition('completed', 'uploading'), /Invalid upload session state transition/);
assert.throws(() => validateUploadSessionTransition('completed', 'cancelled'), /Invalid upload session state transition/);
assert.throws(() => validateUploadSessionTransition('cancelled', 'authorized'), /Invalid upload session state transition/);
assert.throws(() => validateUploadSessionTransition('cancelled', 'completed'), /Invalid upload session state transition/);
assert.throws(() => validateUploadSessionTransition('expired', 'completed'), /Invalid upload session state transition/);

// 7. Command Fingerprint Determinism
const fpCreate1 = createUploadSessionFingerprint(
  instId,
  {
    documentId: docId,
    declaredFilename: 'id.pdf',
    declaredMimeType: 'application/pdf',
    declaredByteSize: 1024,
    policyConfig: { globalMaxByteSize: 50 * 1024 * 1024 },
    storageProvider: 'test-memory',
    storageBucket: 'vault',
    provenance: { sourceDomain: 'portal', method: 'upload', correlationId: 'c1' },
  },
  'person-1',
);

const fpCreate2 = createUploadSessionFingerprint(
  instId,
  {
    documentId: docId,
    declaredByteSize: 1024,
    declaredFilename: 'id.pdf',
    declaredMimeType: 'application/pdf',
    storageBucket: 'vault',
    storageProvider: 'test-memory',
    policyConfig: { globalMaxByteSize: 50 * 1024 * 1024 },
    provenance: { correlationId: 'c1', method: 'upload', sourceDomain: 'portal' },
  },
  'person-1',
);

assert.strictEqual(fpCreate1, fpCreate2, 'Fingerprints must match regardless of object property ordering');

// 8. Test MemoryObjectStorageProvider Contract
const memoryProvider = new MemoryObjectStorageProvider();
assert.strictEqual(memoryProvider.providerName, 'memory_test_provider');

const testContent = Buffer.from('Hello Nexus Documents Foundation I3');
const simulated = await memoryProvider.simulateDirectUpload({
  storageBucket: 'test-bucket',
  storageKey: storageKey,
  content: testContent,
  mimeType: 'text/plain',
});

assert.strictEqual(simulated.storageBucket, 'test-bucket');
assert.strictEqual(simulated.storageKey, storageKey);
assert.strictEqual(simulated.byteSize, testContent.length);
assert.ok(simulated.sha256Hash.length === 64, 'SHA-256 hash must be 64 characters');

const head = await memoryProvider.headObject({
  storageBucket: 'test-bucket',
  storageKey: storageKey,
});
assert.strictEqual(head.exists, true);
assert.strictEqual(head.byteSize, testContent.length);
assert.strictEqual(head.sha256Hash, simulated.sha256Hash);

// Uncommitted object cleanup test
const deleted = await memoryProvider.deleteUncommittedObject({
  storageBucket: 'test-bucket',
  storageKey: storageKey,
});
assert.strictEqual(deleted, true);

const headAfterDelete = await memoryProvider.headObject({
  storageBucket: 'test-bucket',
  storageKey: storageKey,
});
assert.strictEqual(headAfterDelete.exists, false);

console.log('[DOCUMENTS-UPLOAD-MODEL] PASS: Domain models, size policy, sanitization, token security, lifecycle and test provider verified.');
