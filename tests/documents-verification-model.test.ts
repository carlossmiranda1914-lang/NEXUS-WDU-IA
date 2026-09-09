import assert from 'node:assert/strict';
import {
  ContentTypeDetector,
  type ContentTypeDetectorConfig,
} from '../src/modules/documents/content-type-detector.ts';
import {
  evaluateVerificationOutcome,
  calculateNextRetry,
  type DocumentTechnicalAssessment,
} from '../src/modules/documents/document-verification-model.ts';

const config: ContentTypeDetectorConfig = {
  maxPrefixInspectionBytes: 4096,
  zipMetadataInspectionLimit: 64 * 1024,
  maxContainerEntryCount: 100,
  maxContainerMetadataBytes: 128 * 1024,
};

const detector = new ContentTypeDetector(config);

// Helper to create synthetic ZIP buffer with local file entries
function createSyntheticZipBuffer(entries: { filename: string; content: string }[]): Buffer {
  const parts: Buffer[] = [];
  for (const entry of entries) {
    const fnBuf = Buffer.from(entry.filename, 'utf8');
    const contentBuf = Buffer.from(entry.content, 'utf8');
    const header = Buffer.alloc(30);

    // Signature: PK\x03\x04
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0, 6); // flags
    header.writeUInt16LE(0, 8); // compression: 0 (store)
    header.writeUInt16LE(0, 10); // time
    header.writeUInt16LE(0, 12); // date
    header.writeUInt32LE(0, 14); // crc32
    header.writeUInt32LE(contentBuf.length, 18); // compressed size
    header.writeUInt32LE(contentBuf.length, 22); // uncompressed size
    header.writeUInt16LE(fnBuf.length, 26); // filename length
    header.writeUInt16LE(0, 28); // extra field length

    parts.push(header);
    parts.push(fnBuf);
    parts.push(contentBuf);
  }
  return Buffer.concat(parts);
}

// 1. SIMPLE FORMATS DETECTION
const pdfBuf = Buffer.from('%PDF-1.7 standard document content bytes here');
const pdfDetected = detector.detect(pdfBuf);
assert.strictEqual(pdfDetected.mimeType, 'application/pdf');
assert.strictEqual(pdfDetected.canonicalExtension, '.pdf');
assert.strictEqual(pdfDetected.isContainer, false);

const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const pngDetected = detector.detect(pngBuf);
assert.strictEqual(pngDetected.mimeType, 'image/png');
assert.strictEqual(pngDetected.canonicalExtension, '.png');

const jpgBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const jpgDetected = detector.detect(jpgBuf);
assert.strictEqual(jpgDetected.mimeType, 'image/jpeg');
assert.strictEqual(jpgDetected.canonicalExtension, '.jpg');

// 2. PLAIN ZIP VS OPENXML DOCX / XLSX
// Plain ZIP with text files
const plainZipBuf = createSyntheticZipBuffer([
  { filename: 'readme.txt', content: 'hello world' },
  { filename: 'data.csv', content: 'id,name\n1,alice' },
]);
const plainZipDetected = detector.detect(plainZipBuf);
assert.strictEqual(plainZipDetected.mimeType, 'application/zip');
assert.strictEqual(plainZipDetected.canonicalExtension, '.zip');
assert.strictEqual(plainZipDetected.containerType, 'plain_zip');
assert.notStrictEqual(
  plainZipDetected.mimeType,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'Plain ZIP with PK magic must NOT be detected as DOCX',
);

// Valid DOCX container with [Content_Types].xml and word/
const docxZipBuf = createSyntheticZipBuffer([
  { filename: '[Content_Types].xml', content: '<?xml version="1.0"?><Types/>' },
  { filename: 'word/document.xml', content: '<w:document><w:body/></w:document>' },
]);
const docxDetected = detector.detect(docxZipBuf);
assert.strictEqual(
  docxDetected.mimeType,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
);
assert.strictEqual(docxDetected.canonicalExtension, '.docx');
assert.strictEqual(docxDetected.containerType, 'opc_docx');

// Valid XLSX container with [Content_Types].xml and xl/
const xlsxZipBuf = createSyntheticZipBuffer([
  { filename: '[Content_Types].xml', content: '<?xml version="1.0"?><Types/>' },
  { filename: 'xl/workbook.xml', content: '<workbook/>' },
]);
const xlsxDetected = detector.detect(xlsxZipBuf);
assert.strictEqual(
  xlsxDetected.mimeType,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
);
assert.strictEqual(xlsxDetected.canonicalExtension, '.xlsx');
assert.strictEqual(xlsxDetected.containerType, 'opc_xlsx');

// 3. FAKE DOCX EXTENSION WITH PLAIN ZIP IS REJECTED
const fakeDocxMismatch = detector.evaluateCompatibility(
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'malicious_payload.docx',
  plainZipDetected,
);
assert.strictEqual(fakeDocxMismatch.isCompatible, false);
assert.strictEqual(fakeDocxMismatch.isDangerousMismatch, true);
assert.ok(fakeDocxMismatch.reason?.includes('OpenXML OPC'));

// 4. TRUNCATED ZIP FAILS CLOSED
const truncatedZipBuf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]); // truncated before header completion
const truncatedDetected = detector.detect(truncatedZipBuf);
assert.strictEqual(truncatedDetected.containerType, 'corrupted_zip');
assert.strictEqual(truncatedDetected.isKnown, false);

const truncatedCompat = detector.evaluateCompatibility(
  'application/zip',
  'archive.zip',
  truncatedDetected,
);
assert.strictEqual(truncatedCompat.isCompatible, false);
assert.strictEqual(truncatedCompat.isDangerousMismatch, true);

// 5. EVALUATE VERIFICATION OUTCOME INVARIANTS
const baseAssessment = (type: any, status: any): DocumentTechnicalAssessment => ({
  id: '00000000-0000-0000-0000-000000000001',
  institutionId: '00000000-0000-0000-0000-000000000002',
  documentId: '00000000-0000-0000-0000-000000000003',
  versionId: '00000000-0000-0000-0000-000000000004',
  verificationId: '00000000-0000-0000-0000-000000000005',
  assessmentType: type,
  status,
  provider: 'test_provider',
  attemptNumber: 1,
  startedAt: new Date(),
  completedAt: new Date(),
  facts: {},
  createdAt: new Date(),
});

// All 4 pass -> available
const allPass = [
  baseAssessment('integrity', 'pass'),
  baseAssessment('size', 'pass'),
  baseAssessment('real_type', 'pass'),
  baseAssessment('malware', 'pass'),
];
const passEval = evaluateVerificationOutcome(allPass);
assert.strictEqual(passEval.overallStatus, 'available');
assert.strictEqual(passEval.isReadyForAvailability, true);
assert.strictEqual(passEval.allMandatoryPassed, true);

// Malware fail -> quarantined
const malwareFail = [
  baseAssessment('integrity', 'pass'),
  baseAssessment('size', 'pass'),
  baseAssessment('real_type', 'pass'),
  { ...baseAssessment('malware', 'fail'), errorMessage: 'Trojan.Win32.Test' },
];
const malwareEval = evaluateVerificationOutcome(malwareFail);
assert.strictEqual(malwareEval.overallStatus, 'quarantined');
assert.strictEqual(malwareEval.isReadyForAvailability, false);
assert.ok(malwareEval.quarantineReason?.includes('Trojan'));

// Integrity fail -> quarantined
const integrityFail = [
  { ...baseAssessment('integrity', 'fail'), errorMessage: 'Hash divergence' },
  baseAssessment('size', 'pass'),
  baseAssessment('real_type', 'pass'),
  baseAssessment('malware', 'pass'),
];
const intEval = evaluateVerificationOutcome(integrityFail);
assert.strictEqual(intEval.overallStatus, 'quarantined');
assert.strictEqual(intEval.isReadyForAvailability, false);

// Real-type fail -> quarantined
const typeFail = [
  baseAssessment('integrity', 'pass'),
  baseAssessment('size', 'pass'),
  { ...baseAssessment('real_type', 'fail'), errorMessage: 'MIME mismatch: exe declared as pdf' },
  baseAssessment('malware', 'pass'),
];
const typeEval = evaluateVerificationOutcome(typeFail);
assert.strictEqual(typeEval.overallStatus, 'quarantined');

// Inconclusive -> inconclusive, not available
const inconclusiveSet = [
  baseAssessment('integrity', 'pass'),
  baseAssessment('size', 'pass'),
  baseAssessment('real_type', 'pass'),
  baseAssessment('malware', 'inconclusive'),
];
const incEval = evaluateVerificationOutcome(inconclusiveSet);
assert.strictEqual(incEval.overallStatus, 'inconclusive');
assert.strictEqual(incEval.isReadyForAvailability, false);

// Missing / pending -> under_verification
const pendingSet = [
  baseAssessment('integrity', 'pass'),
  baseAssessment('size', 'pass'),
];
const pendEval = evaluateVerificationOutcome(pendingSet);
assert.strictEqual(pendEval.overallStatus, 'under_verification');
assert.strictEqual(pendEval.isReadyForAvailability, false);

// Fail-Closed Conflict: Malicious dominates Clean
const conflictSet = [
  baseAssessment('integrity', 'pass'),
  baseAssessment('size', 'pass'),
  baseAssessment('real_type', 'pass'),
  { ...baseAssessment('malware', 'pass'), attemptNumber: 1 },
  { ...baseAssessment('malware', 'fail'), attemptNumber: 2, errorMessage: 'Malware discovered on rescan' },
];
const conflictEval = evaluateVerificationOutcome(conflictSet);
assert.strictEqual(conflictEval.overallStatus, 'quarantined');

// 6. RETRY CALCULATION WITH 24H DUE_AT CEILING
const startedAt = new Date();
const dueAt = new Date(startedAt.getTime() + 24 * 3600 * 1000);
const retryPolicy = {
  maxAttempts: 3,
  baseBackoffMs: 1000,
  maxBackoffMs: 10000,
};

const retry1 = calculateNextRetry(1, retryPolicy, startedAt, dueAt);
assert.ok(retry1);
assert.ok(retry1.getTime() > Date.now());

const retryMaxExceeded = calculateNextRetry(3, retryPolicy, startedAt, dueAt);
assert.strictEqual(retryMaxExceeded, null, 'Retry must not be scheduled when max attempts exceeded');

const expiredDueAt = new Date(Date.now() - 1000);
const retryAfterExpiry = calculateNextRetry(1, retryPolicy, startedAt, expiredDueAt);
assert.strictEqual(retryAfterExpiry, null, 'Retry must not exceed 24h due_at window');

console.log('[DOCUMENTS-VERIFICATION-MODEL] PASS: ContentTypeDetector, OpenXML/plain-ZIP inspection, evaluation rules, and retry policies verified.');
