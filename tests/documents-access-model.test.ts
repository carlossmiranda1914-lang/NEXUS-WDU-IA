/**
 * Documents Foundation I5 - Unit Tests: Access Model & Policy Engine
 * Mission: DOCUMENTS-FOUNDATION-I5
 */

import assert from 'node:assert';
import test from 'node:test';
import {
  generateSecureAccessToken,
  hashAccessToken,
  maskAccessToken,
  sanitizeDisplayFilename,
  CONTENT_ACCESS_GRANT_TTL_SECONDS,
} from '../src/modules/documents/document-access-model.ts';
import {
  ConfigurableDocumentAccessPolicyEngine,
  DocumentAccessPolicyRule,
} from '../src/modules/documents/document-access-policy.ts';

test('DOCUMENTS-ACCESS-MODEL: Token security, hashing and sanitization', () => {
  const token1 = generateSecureAccessToken();
  const token2 = generateSecureAccessToken();

  assert.strictEqual(typeof token1, 'string');
  assert.strictEqual(token1.length, 64); // 32 bytes hex = 64 characters
  assert.notStrictEqual(token1, token2, 'Generated tokens must be cryptographically unique');

  const hash1 = hashAccessToken(token1);
  const hash1Repeat = hashAccessToken(token1);
  const hash2 = hashAccessToken(token2);

  assert.strictEqual(hash1.length, 64); // SHA-256 hex is 64 chars
  assert.strictEqual(hash1, hash1Repeat, 'Hashing must be deterministic');
  assert.notStrictEqual(hash1, hash2, 'Distinct tokens must produce distinct hashes');
  assert.notStrictEqual(hash1, token1, 'Hash must not equal plaintext token');

  const masked = maskAccessToken(token1);
  assert.strictEqual(masked.length, 11); // 4 + 3 dots + 4 = 11 chars
  assert.ok(masked.startsWith(token1.slice(0, 4)));
  assert.ok(masked.endsWith(token1.slice(-4)));

  assert.strictEqual(CONTENT_ACCESS_GRANT_TTL_SECONDS, 300, 'TTL must be exactly 300 seconds');

  // Display filename sanitization
  assert.strictEqual(sanitizeDisplayFilename('normal.pdf'), 'normal.pdf');
  assert.strictEqual(sanitizeDisplayFilename('../../etc/passwd.pdf'), '.._.._etc_passwd.pdf');
  assert.strictEqual(sanitizeDisplayFilename(''), 'document.bin');
  assert.strictEqual(sanitizeDisplayFilename('invalid\x00name.docx'), 'invalidname.docx');
});

test('DOCUMENTS-ACCESS-POLICY: Explicit synthetic policy fixtures and fail-closed rule enforcement', () => {
  // Explicit synthetic policy rules fixtures (NO global invented matrix)
  const syntheticRules: DocumentAccessPolicyRule[] = [
    {
      role: 'institution_admin',
      category: '*',
      allowedActions: ['view_metadata', 'open_content', 'download_content'],
    },
    {
      role: 'teacher',
      category: 'academic_transcript',
      allowedActions: ['view_metadata', 'open_content'], // open allowed, download denied
    },
    {
      role: 'secretariat',
      category: 'identification',
      allowedActions: ['view_metadata', 'open_content', 'download_content'],
    },
    {
      role: 'student',
      category: 'academic_transcript',
      allowedActions: ['view_metadata'], // only metadata
    },
  ];

  const engine = new ConfigurableDocumentAccessPolicyEngine(syntheticRules);
  const instId = '11111111-1111-1111-1111-111111111111';
  const personId = '22222222-2222-2222-2222-222222222222';

  // 1. Admin wildcard access to available document
  const adminOpenRes = engine.evaluateAccess({
    institutionId: instId,
    personId,
    role: 'institution_admin',
    documentCategory: 'financial_proof',
    action: 'open_content',
    versionStatus: 'available',
  });
  assert.strictEqual(adminOpenRes.allowed, true);

  // 2. Teacher open allowed on academic_transcript
  const teacherOpenRes = engine.evaluateAccess({
    institutionId: instId,
    personId,
    role: 'teacher',
    documentCategory: 'academic_transcript',
    action: 'open_content',
    versionStatus: 'available',
  });
  assert.strictEqual(teacherOpenRes.allowed, true);

  // 3. Teacher download DENIED on academic_transcript (Open allowed / Download denied separation)
  const teacherDownloadRes = engine.evaluateAccess({
    institutionId: instId,
    personId,
    role: 'teacher',
    documentCategory: 'academic_transcript',
    action: 'download_content',
    versionStatus: 'available',
  });
  assert.strictEqual(teacherDownloadRes.allowed, false);
  assert.ok(teacherDownloadRes.reason?.includes('ACTION_NOT_PERMITTED'));

  // 4. Teacher access DENIED on sensitive financial_proof (fail closed)
  const teacherFinanceRes = engine.evaluateAccess({
    institutionId: instId,
    personId,
    role: 'teacher',
    documentCategory: 'financial_proof',
    action: 'view_metadata',
    versionStatus: 'available',
  });
  assert.strictEqual(teacherFinanceRes.allowed, false);
  assert.ok(teacherFinanceRes.reason?.includes('POLICY_DENIED'));

  // 5. Version status eligibility: content_received -> DENIED
  const receivedRes = engine.evaluateAccess({
    institutionId: instId,
    personId,
    role: 'institution_admin',
    documentCategory: 'identification',
    action: 'open_content',
    versionStatus: 'content_received',
  });
  assert.strictEqual(receivedRes.allowed, false);
  assert.ok(receivedRes.reason?.includes('NOT_AVAILABLE_FOR_ACCESS'));

  // 6. Version status eligibility: superseded -> DENIED
  const verifyingRes = engine.evaluateAccess({
    institutionId: instId,
    personId,
    role: 'institution_admin',
    documentCategory: 'identification',
    action: 'open_content',
    versionStatus: 'superseded',
  });
  assert.strictEqual(verifyingRes.allowed, false);
  assert.ok(verifyingRes.reason?.includes('NOT_AVAILABLE_FOR_ACCESS'));

  // 7. Version status eligibility: quarantined -> DENIED (quarantine blocks open and download)
  const quarantinedOpenRes = engine.evaluateAccess({
    institutionId: instId,
    personId,
    role: 'institution_admin',
    documentCategory: 'identification',
    action: 'open_content',
    versionStatus: 'quarantined',
  });
  assert.strictEqual(quarantinedOpenRes.allowed, false);
  assert.ok(quarantinedOpenRes.reason?.includes('ACCESS_DENIED_QUARANTINED'));

  const quarantinedDownloadRes = engine.evaluateAccess({
    institutionId: instId,
    personId,
    role: 'institution_admin',
    documentCategory: 'identification',
    action: 'download_content',
    versionStatus: 'quarantined',
  });
  assert.strictEqual(quarantinedDownloadRes.allowed, false);
  assert.ok(quarantinedDownloadRes.reason?.includes('ACCESS_DENIED_QUARANTINED'));

  // 8. Document status: archived -> DENIED
  const archivedDocRes = engine.evaluateAccess({
    institutionId: instId,
    personId,
    role: 'institution_admin',
    documentCategory: 'identification',
    action: 'view_metadata',
    documentStatus: 'archived',
    versionStatus: 'available',
  });
  assert.strictEqual(archivedDocRes.allowed, false);
  assert.ok(archivedDocRes.reason?.includes('DOCUMENT_ARCHIVED'));

  console.log('[DOCUMENTS-ACCESS-MODEL] PASS: Unit models, token security, sanitization and policy engine verified.');
});
