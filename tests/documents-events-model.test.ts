import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOCUMENT_EVENT_TYPES,
  DOCUMENT_EVENT_SCHEMA_VERSION,
  isSupportedSchemaVersion,
  validateEventPayloadSecurity,
  type DocumentEventType,
} from '../src/modules/documents/document-event-model.ts';

describe('Documents Events Model & Payload Security (I7)', () => {
  it('should define exactly the 15 canonical document event types', () => {
    const expectedEvents: DocumentEventType[] = [
      'document.created',
      'document.version_created',
      'document.upload_completed',
      'document.verification_passed',
      'document.quarantined',
      'document.association_created',
      'document.access_granted',
      'document.access_revoked',
      'document.retention_assigned',
      'document.hold_placed',
      'document.hold_released',
      'document.deletion_authorized',
      'document.deletion_started',
      'document.deleted',
      'document.deletion_reconciliation_required',
    ];

    assert.equal(DOCUMENT_EVENT_TYPES.length, 15);
    for (const expected of expectedEvents) {
      assert.ok(
        DOCUMENT_EVENT_TYPES.includes(expected),
        `Expected event type ${expected} is missing`,
      );
    }
  });

  it('should validate supported schema version 1.0 and fail closed on unsupported versions', () => {
    assert.equal(DOCUMENT_EVENT_SCHEMA_VERSION, '1.0');
    assert.equal(isSupportedSchemaVersion('1.0'), true);
    assert.equal(isSupportedSchemaVersion('2.0'), false);
    assert.equal(isSupportedSchemaVersion('0.9'), false);
    assert.equal(isSupportedSchemaVersion(''), false);
    assert.equal(isSupportedSchemaVersion(null as any), false);
  });

  it('should pass payload security scanner on valid domain payload without secrets or PII', () => {
    const validPayload = {
      documentId: 'doc-123',
      versionId: 'ver-456',
      versionNumber: 1,
      mimeType: 'application/pdf',
      byteSize: 2048,
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      storageProvider: 's3',
      storageBucket: 'institutional-vault',
      storageKey: 'institutions/inst-1/doc-123/ver-1.bin',
    };

    assert.doesNotThrow(() => {
      validateEventPayloadSecurity(validPayload);
    });
  });

  it('should fail closed when payload contains secret keys, access tokens, or credentials', () => {
    const forbiddenPayloads = [
      { documentId: 'doc-1', rawAccessToken: 'raw-secret-token-value-123' },
      { documentId: 'doc-1', token: 'bearer-abc-xyz' },
      { documentId: 'doc-1', password: 'plain-text-password' },
      { documentId: 'doc-1', secret: 'super-secret-hmac-key' },
      { documentId: 'doc-1', authorization_header: 'Bearer 12345' },
      { documentId: 'doc-1', nested: { clientSecret: 'sensitive-value' } },
      { documentId: 'doc-1', privateKey: ['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' ') },
    ];

    for (const payload of forbiddenPayloads) {
      assert.throws(
        () => validateEventPayloadSecurity(payload),
        /SECURITY_VIOLATION/,
        `Expected payload with sensitive key to fail validation: ${JSON.stringify(payload)}`,
      );
    }
  });

  it('should fail closed when payload contains non-plain-object or binary data', () => {
    assert.throws(() => validateEventPayloadSecurity(null as any), /SECURITY_VIOLATION/);
    assert.throws(() => validateEventPayloadSecurity('string-payload' as any), /SECURITY_VIOLATION/);
    assert.throws(() => validateEventPayloadSecurity([1, 2, 3] as any), /SECURITY_VIOLATION/);
  });
});
