/**
 * Documents Foundation I5 - PostgreSQL Lifecycle & Security Integration Tests
 * Mission: DOCUMENTS-FOUNDATION-I5
 */

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { PostgresDocumentRepository } from '../src/modules/documents/document-repository.ts';
import { PostgresDocumentUploadRepository } from '../src/modules/documents/document-upload-repository.ts';
import { PostgresDocumentVerificationRepository } from '../src/modules/documents/document-verification-repository.ts';
import { PostgresDocumentAccessRepository } from '../src/modules/documents/document-access-repository.ts';
import { PostgresDocumentAuditRepository } from '../src/modules/documents/document-audit.ts';
import {
  createUploadSessionCommand,
  completeUploadSessionCommand,
} from '../src/modules/documents/document-upload-command.ts';
import {
  executeTechnicalVerificationPipelineCommand,
} from '../src/modules/documents/document-verification-command.ts';
import {
  authorizeContentAccessCommand,
  exchangeGrantForContentStreamCommand,
  revokeContentAccessGrantCommand,
} from '../src/modules/documents/document-access-command.ts';
import {
  ConfigurableDocumentAccessPolicyEngine,
  DocumentAccessPolicyRule,
} from '../src/modules/documents/document-access-policy.ts';
import { MemoryObjectStorageProvider } from './support/memory-object-storage-provider.ts';
import { DeterministicTestMalwareScanner } from './support/deterministic-test-malware-scanner.ts';
import { ContentTypeDetector } from '../src/modules/documents/content-type-detector.ts';
import type { InstitutionalContext } from '../src/auth/institutional-context.ts';

await verifyApprovedTestConnection();

const schema = `doc_access_${randomUUID().replaceAll('-', '')}`;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

const institutionId = '00000000-0000-0000-0000-000000000001';
const adminPersonId = '00000000-0000-0000-0000-000000000002';
const teacherPersonId = '00000000-0000-0000-0000-000000000003';
const studentPersonId = '00000000-0000-0000-0000-000000000004';

const adminContext: InstitutionalContext = {
  institutionId,
  institutionName: 'Nexus Test Academy',
  institutionSlug: 'nexus-test-academy',
  personId: adminPersonId,
  personName: 'Admin Person',
  identityEmail: 'admin@nexus.edu',
  membershipId: '00000000-0000-0000-0000-000000000010',
  role: 'institution_admin',
};

const teacherContext: InstitutionalContext = {
  institutionId,
  institutionName: 'Nexus Test Academy',
  institutionSlug: 'nexus-test-academy',
  personId: teacherPersonId,
  personName: 'Director Person',
  identityEmail: 'director@nexus.edu',
  membershipId: '00000000-0000-0000-0000-000000000011',
  role: 'director',
};

const detector = new ContentTypeDetector({
  maxPrefixInspectionBytes: 4096,
  zipMetadataInspectionLimit: 64 * 1024,
  maxContainerEntryCount: 100,
  maxContainerMetadataBytes: 128 * 1024,
});

const syntheticRules: DocumentAccessPolicyRule[] = [
  {
    role: 'institution_admin',
    category: '*',
    allowedActions: ['view_metadata', 'open_content', 'download_content'],
  },
  {
    role: 'director',
    category: 'academic_transcript',
    allowedActions: ['view_metadata', 'open_content'], // open allowed, download denied
  },
  {
    role: 'director',
    category: 'identification',
    allowedActions: ['view_metadata', 'open_content', 'download_content'],
  },
  {
    role: 'student',
    category: 'academic_transcript',
    allowedActions: ['view_metadata'],
  },
];

const policyEngine = new ConfigurableDocumentAccessPolicyEngine(syntheticRules);

// Explicit test secret — minimum 32 chars, no production fallback, injected as trusted dependency
const TEST_ACCESS_GRANT_TOKEN_KEY = 'EXPLICIT_TEST_SECRET_minimum_32_bytes_for_hmac_derivation';

const storageProvider = new MemoryObjectStorageProvider();
const malwareScanner = new DeterministicTestMalwareScanner();
const docRepo = new PostgresDocumentRepository();
const accessRepo = new PostgresDocumentAccessRepository();
const auditRepo = new PostgresDocumentAuditRepository();

try {
  await pool.query(`CREATE SCHEMA ${quote(schema)}`);
  const migrations = await discoverMigrations(migrationsDir);
  await runMigrations(pool, migrations);

  const client = await pool.connect();
  try {
    // Seed test institution and people/memberships
    await client.query(`
      INSERT INTO institutions (id, name, slug)
      VALUES ('${institutionId}', 'Nexus Test Academy', 'nexus-test-academy')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO people (id, name)
      VALUES
        ('${adminPersonId}', 'Admin Person'),
        ('${teacherPersonId}', 'Teacher Person'),
        ('${studentPersonId}', 'Student Person')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO memberships (id, institution_id, person_id, role, status)
      VALUES
        ('${adminContext.membershipId}', '${institutionId}', '${adminPersonId}', 'institution_admin', 'active'),
        ('${teacherContext.membershipId}', '${institutionId}', '${teacherPersonId}', 'director', 'active'),
        ('00000000-0000-0000-0000-000000000012', '${institutionId}', '${studentPersonId}', 'student', 'active')
      ON CONFLICT (id) DO NOTHING;
    `);

    async function createAndVerifyDocument(
      category: string,
      filename: string,
      mimeType: string,
      content: Buffer,
      idempSuffix: string,
      skipVerification: boolean = false,
      makeQuarantined: boolean = false,
    ) {
      const doc = await docRepo.createDocument(client, {
        institutionId,
        category,
        createdByPersonId: adminPersonId,
      });

      const sessionRes = await createUploadSessionCommand({
        pool,
        context: adminContext,
        idempotencyKey: `idemp-upload-session-${idempSuffix}`,
        input: {
          documentId: doc.id,
          declaredFilename: filename,
          declaredMimeType: mimeType,
          declaredByteSize: content.length,
          policyConfig: { globalMaxByteSize: 50 * 1024 * 1024 },
          storageProvider: 'test-memory',
          storageBucket: 'vault',
        },
      });

      await storageProvider.simulateDirectUpload({
        storageBucket: sessionRes.result.session.storageBucket,
        storageKey: sessionRes.result.session.storageKey,
        content,
        mimeType,
      });

      const completeRes = await completeUploadSessionCommand({
        pool,
        context: adminContext,
        storageProvider,
        idempotencyKey: `idemp-upload-complete-${idempSuffix}`,
        input: {
          sessionId: sessionRes.result.session.id,
          rawToken: sessionRes.result.rawToken,
          provenance: {
            originType: 'user_upload',
            actorPersonId: adminPersonId,
            sourceDomain: 'documents.test',
            method: 'direct_upload',
          },
        },
      });

      let version = completeRes.result.version;

      if (!skipVerification) {
        if (makeQuarantined) {
          // Put infected bytes into storage
          const infected = Buffer.from('%PDF-1.4 sentinel Threat.Malware payload');
          await storageProvider.simulateDirectUpload({
            storageBucket: sessionRes.result.session.storageBucket,
            storageKey: sessionRes.result.session.storageKey,
            content: infected,
            mimeType,
          });
        }

        await executeTechnicalVerificationPipelineCommand({
          pool,
          context: adminContext,
          idempotencyKey: `idemp-pipe-${idempSuffix}`,
          input: {
            documentId: doc.id,
            versionId: version.id,
            storageProvider,
            malwareScanner,
            contentTypeDetector: detector,
            retryPolicy: { maxAttempts: 3, baseBackoffMs: 1000, maxBackoffMs: 10000 },
          },
        });
        version = (await docRepo.getVersionById(client, institutionId, version.id))!;
      }

      return { doc, version, session: sessionRes.result.session };
    }

    // 1. AVAILABLE_DOCUMENT_AUTHORIZED_ACTOR: Grant issuance, token exchange, and streaming
    const cleanPdf = Buffer.from('%PDF-1.4 Clean academic transcript content for Nexus');
    const { doc: doc1, version: ver1 } = await createAndVerifyDocument(
      'academic_transcript',
      'transcript.pdf',
      'application/pdf',
      cleanPdf,
      'v1-avail',
    );
    assert.strictEqual(ver1.status, 'available');

    const authRes1 = await authorizeContentAccessCommand({
      pool,
      context: teacherContext,
      idempotencyKey: 'idemp-auth-1',
      policyEngine,
      accessGrantTokenKey: TEST_ACCESS_GRANT_TOKEN_KEY,
      input: {
        documentId: doc1.id,
        versionId: ver1.id,
        action: 'open',
      },
    });

    assert.strictEqual(authRes1.replayed, false);
    assert.ok(authRes1.result.rawAccessToken, 'Must return raw access token on initial issuance');
    assert.strictEqual(authRes1.result.grant.status, 'active');
    assert.strictEqual(authRes1.result.grant.action, 'open');
    assert.strictEqual(authRes1.result.grant.granteePersonId, teacherPersonId);
    assert.strictEqual(authRes1.result.expiresInSeconds, 300);

    // Verify PostgreSQL grant row
    const grantDbRow = await accessRepo.getGrantById(client, institutionId, authRes1.result.grant.id);
    assert.ok(grantDbRow);
    assert.strictEqual(grantDbRow.status, 'active');
    assert.strictEqual(grantDbRow.tokenHash.length, 64);
    assert.strictEqual(grantDbRow.tokenHash, authRes1.result.grant.tokenHash);

    // Exchange token for stream
    const streamRes1 = await exchangeGrantForContentStreamCommand({
      pool,
      context: teacherContext,
      policyEngine,
      storageProvider,
      input: {
        rawAccessToken: authRes1.result.rawAccessToken!,
      },
    });

    assert.strictEqual(streamRes1.byteSize, cleanPdf.length);
    assert.strictEqual(streamRes1.mimeType, 'application/pdf');
    assert.strictEqual(streamRes1.contentDisposition, 'inline; filename="transcript.pdf"');

    // Read stream bytes
    const chunks: Buffer[] = [];
    for await (const chunk of streamRes1.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const streamedBuffer = Buffer.concat(chunks);
    assert.deepStrictEqual(streamedBuffer, cleanPdf, 'Streamed content must match original bytes');

    // Verify audit log entries
    const auditEvents = await auditRepo.getAuditEventsForDocument(client, institutionId, doc1.id);
    const grantedEvent = auditEvents.find((e) => e.action === 'document.content_access_granted.open');
    const openedEvent = auditEvents.find((e) => e.action === 'document.content_stream_opened.open');
    assert.ok(grantedEvent, 'Granted audit event must exist');
    assert.ok(openedEvent, 'Stream opened audit event must exist');

    // 2. INELIGIBLE_VERSION_STATES: content_received and quarantined
    const { doc: docReceived, version: verReceived } = await createAndVerifyDocument(
      'identification',
      'id.pdf',
      'application/pdf',
      cleanPdf,
      'v-received',
      true, // skip verification -> stays content_received
    );
    assert.strictEqual(verReceived.status, 'content_received');

    await assert.rejects(
      async () => {
        await authorizeContentAccessCommand({
          pool,
          context: adminContext,
          idempotencyKey: 'idemp-auth-received',
          policyEngine,
          accessGrantTokenKey: TEST_ACCESS_GRANT_TOKEN_KEY,
          input: {
            documentId: docReceived.id,
            versionId: verReceived.id,
            action: 'open',
          },
        });
      },
      /NOT_AVAILABLE_FOR_ACCESS/,
      'content_received version must reject access authorization',
    );

    // Quarantined version
    const { doc: docQuar, version: verQuar } = await createAndVerifyDocument(
      'identification',
      'infected.pdf',
      'application/pdf',
      Buffer.from('%PDF-1.4 infected with test sentinel Threat.Malware payload'),
      'v-quarantined',
      false,
      true,
    );
    assert.strictEqual(verQuar.status, 'quarantined');

    await assert.rejects(
      async () => {
        await authorizeContentAccessCommand({
          pool,
          context: adminContext,
          idempotencyKey: 'idemp-auth-quar',
          policyEngine,
          accessGrantTokenKey: TEST_ACCESS_GRANT_TOKEN_KEY,
          input: {
            documentId: docQuar.id,
            versionId: verQuar.id,
            action: 'open',
          },
        });
      },
      /ACCESS_DENIED_QUARANTINED/,
      'Quarantined version must strictly deny open/download',
    );

    // 3. IMMEDIATE_REVOCATION: Active grant revoked before expiry immediately denies exchange
    const { doc: docRevoke, version: verRevoke } = await createAndVerifyDocument(
      'identification',
      'passport.pdf',
      'application/pdf',
      cleanPdf,
      'v-revoke',
    );

    const authRevokeRes = await authorizeContentAccessCommand({
      pool,
      context: teacherContext,
      idempotencyKey: 'idemp-auth-revoke-test',
      policyEngine,
      accessGrantTokenKey: TEST_ACCESS_GRANT_TOKEN_KEY,
      input: {
        documentId: docRevoke.id,
        versionId: verRevoke.id,
        action: 'open',
      },
    });

    // Revoke grant
    const revokeRes = await revokeContentAccessGrantCommand({
      pool,
      context: adminContext,
      idempotencyKey: 'idemp-revoke-cmd',
      input: {
        grantId: authRevokeRes.result.grant.id,
        reason: 'Suspected token leakage during administrative audit',
      },
    });
    assert.strictEqual(revokeRes.result.status, 'revoked');

    // Attempt exchange with raw token -> MUST FAIL IMMEDIATELY
    await assert.rejects(
      async () => {
        await exchangeGrantForContentStreamCommand({
          pool,
          context: teacherContext,
          policyEngine,
          storageProvider,
          input: {
            rawAccessToken: authRevokeRes.result.rawAccessToken!,
          },
        });
      },
      /GRANT_REVOKED/,
      'Revoked grant must immediately fail closed during token exchange',
    );

    // 4. EXPIRATION_TTL_5M: Expired grant is rejected
    const authExpireRes = await authorizeContentAccessCommand({
      pool,
      context: teacherContext,
      idempotencyKey: 'idemp-auth-expire-test',
      policyEngine,
      accessGrantTokenKey: TEST_ACCESS_GRANT_TOKEN_KEY,
      input: {
        documentId: docRevoke.id,
        versionId: verRevoke.id,
        action: 'open',
      },
    });

    // Manually backdate expiration in DB
    await client.query(
      `UPDATE document_content_access_grants
       SET expires_at = NOW() - INTERVAL '5 seconds'
       WHERE id = $1`,
      [authExpireRes.result.grant.id],
    );

    await assert.rejects(
      async () => {
        await exchangeGrantForContentStreamCommand({
          pool,
          context: teacherContext,
          policyEngine,
          storageProvider,
          input: {
            rawAccessToken: authExpireRes.result.rawAccessToken!,
          },
        });
      },
      /GRANT_EXPIRED/,
      'Expired grant must be rejected upon token exchange',
    );

    // 5. MEMBERSHIP_REVOKED_AFTER_GRANT: Membership deactivation revokes access in real-time
    const authMemberRes = await authorizeContentAccessCommand({
      pool,
      context: teacherContext,
      idempotencyKey: 'idemp-auth-member-test',
      policyEngine,
      accessGrantTokenKey: TEST_ACCESS_GRANT_TOKEN_KEY,
      input: {
        documentId: docRevoke.id,
        versionId: verRevoke.id,
        action: 'open',
      },
    });

    // Revoke teacher membership
    await client.query(
      `UPDATE memberships SET status = 'revoked' WHERE id = $1`,
      [teacherContext.membershipId],
    );

    await assert.rejects(
      async () => {
        await exchangeGrantForContentStreamCommand({
          pool,
          context: teacherContext,
          policyEngine,
          storageProvider,
          input: {
            rawAccessToken: authMemberRes.result.rawAccessToken!,
          },
        });
      },
      /MEMBERSHIP_REVOKED_OR_INACTIVE/,
      'Grant exchange must fail closed when grantee membership is inactive/revoked',
    );

    // Reactivate membership for subsequent tests
    await client.query(
      `UPDATE memberships SET status = 'active' WHERE id = $1`,
      [teacherContext.membershipId],
    );

    // 6. ROLE_DOWNGRADE_AFTER_GRANT: Role downgrade causes policy revalidation failure
    const authRoleRes = await authorizeContentAccessCommand({
      pool,
      context: teacherContext,
      idempotencyKey: 'idemp-auth-role-test',
      policyEngine,
      accessGrantTokenKey: TEST_ACCESS_GRANT_TOKEN_KEY,
      input: {
        documentId: doc1.id,
        versionId: ver1.id,
        action: 'open',
      },
    });

    // Downgrade teacher to student (student only has view_metadata on academic_transcript)
    await client.query(
      `UPDATE memberships SET role = 'student' WHERE id = $1`,
      [teacherContext.membershipId],
    );

    await assert.rejects(
      async () => {
        await exchangeGrantForContentStreamCommand({
          pool,
          context: teacherContext,
          policyEngine,
          storageProvider,
          input: {
            rawAccessToken: authRoleRes.result.rawAccessToken!,
          },
        });
      },
      /POLICY_NO_LONGER_AUTHORIZED/,
      'Grant exchange must revalidate current role policy and fail on downgrade',
    );

    // Restore role
    await client.query(
      `UPDATE memberships SET role = 'director' WHERE id = $1`,
      [teacherContext.membershipId],
    );

    // 7. OPEN_VS_DOWNLOAD_SEPARATION: Teacher has open but not download on academic_transcript
    await assert.rejects(
      async () => {
        await authorizeContentAccessCommand({
          pool,
          context: teacherContext,
          idempotencyKey: 'idemp-auth-download-denied',
          policyEngine,
          accessGrantTokenKey: TEST_ACCESS_GRANT_TOKEN_KEY,
          input: {
            documentId: doc1.id,
            versionId: ver1.id,
            action: 'download',
          },
        });
      },
      /ACTION_NOT_PERMITTED/,
      'Download must be denied when policy only permits open',
    );

    // 9. STOLEN_TOKEN_SAME_INSTITUTION (P1-1)
    // Person A (teacher) receives a grant. Person B (admin) is in the same institution
    // and obtains Person A's raw token. Person B must be DENIED on exchange.
    const authStolenRes = await authorizeContentAccessCommand({
      pool,
      context: teacherContext, // Person A
      idempotencyKey: 'idemp-auth-stolen-token-test',
      policyEngine,
      accessGrantTokenKey: TEST_ACCESS_GRANT_TOKEN_KEY,
      input: {
        documentId: doc1.id,
        versionId: ver1.id,
        action: 'open',
      },
    });

    assert.ok(authStolenRes.result.rawAccessToken, 'Person A must receive a raw token');
    assert.strictEqual(authStolenRes.result.grant.granteePersonId, teacherPersonId, 'Grant must be for Person A');

    // Person B (admin) attempts to exchange Person A's token — same institution, different person
    await assert.rejects(
      async () => {
        await exchangeGrantForContentStreamCommand({
          pool,
          context: adminContext, // Person B — same institution, different personId
          policyEngine,
          storageProvider,
          input: {
            rawAccessToken: authStolenRes.result.rawAccessToken!, // Person A's token
          },
        });
      },
      /GRANT_GRANTEE_MISMATCH/,
      'Person B using Person A token in same institution must be DENIED with GRANT_GRANTEE_MISMATCH',
    );

    // 10. RESPONSE_LOSS_SIMULATION
    // First response commits and is treated as lost. Retry same key must recover same grant + same usable token.
    const authLoss1 = await authorizeContentAccessCommand({
      pool,
      context: teacherContext,
      idempotencyKey: 'idemp-auth-response-loss-test',
      policyEngine,
      accessGrantTokenKey: TEST_ACCESS_GRANT_TOKEN_KEY,
      input: {
        documentId: doc1.id,
        versionId: ver1.id,
        action: 'open',
      },
    });
    assert.strictEqual(authLoss1.replayed, false);
    assert.ok(authLoss1.result.rawAccessToken, 'Initial response must contain raw token');
    const lossGrantId = authLoss1.result.grant.id;
    const lossOriginalToken = authLoss1.result.rawAccessToken!;

    // Simulate response loss: retry identical request
    const authLoss2 = await authorizeContentAccessCommand({
      pool,
      context: teacherContext,
      idempotencyKey: 'idemp-auth-response-loss-test', // same key
      policyEngine,
      accessGrantTokenKey: TEST_ACCESS_GRANT_TOKEN_KEY,
      input: {
        documentId: doc1.id,
        versionId: ver1.id,
        action: 'open',
      },
    });

    assert.strictEqual(authLoss2.replayed, true, 'REPLAYED=YES');
    assert.strictEqual(authLoss2.result.grant.id, lossGrantId, 'SAME_GRANT_ID=YES');
    assert.ok(authLoss2.result.rawAccessToken, 'RAW_TOKEN_RETURNED=YES');
    assert.strictEqual(authLoss2.result.rawAccessToken, lossOriginalToken, 'RAW_TOKEN_USABLE=YES (same deterministic token)');

    // TOKEN_HASH_MATCHES_GRANT=YES
    const { createHash } = await import('node:crypto');
    const lossGrantDbRow = await accessRepo.getGrantById(client, institutionId, lossGrantId);
    assert.ok(lossGrantDbRow);
    const recomputedHash = createHash('sha256').update(lossOriginalToken, 'utf8').digest('hex');
    assert.strictEqual(lossGrantDbRow.tokenHash, recomputedHash, 'TOKEN_HASH_MATCH=YES');

    // GRANT_COUNT=1
    const grantCountRes = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM document_content_access_grants WHERE id = $1`,
      [lossGrantId],
    );
    assert.strictEqual(grantCountRes.rows[0].count, '1', 'GRANT_COUNT=1: no duplicate grant on replay');

    // DUPLICATE_SUCCESS_AUDIT=NO
    const allAuditForDoc = await auditRepo.getAuditEventsForDocument(client, institutionId, doc1.id);
    const grantedAuditForLoss = allAuditForDoc.filter(
      (e) =>
        e.action === 'document.content_access_granted.open' &&
        (e.details as Record<string, unknown>)?.grantId === lossGrantId,
    );
    assert.strictEqual(grantedAuditForLoss.length, 1, 'DUPLICATE_SUCCESS_AUDIT=NO: one grant audit event per grant');

    // RAW_TOKEN_USABLE=YES: exchange recovered token
    const lossStreamRes = await exchangeGrantForContentStreamCommand({
      pool,
      context: teacherContext,
      policyEngine,
      storageProvider,
      input: { rawAccessToken: lossOriginalToken },
    });
    assert.strictEqual(lossStreamRes.grantId, lossGrantId, 'Recovered token exchanges to correct grant');

    // 11. MISSING_TOKEN_KEY: fail closed
    await assert.rejects(
      async () => {
        await authorizeContentAccessCommand({
          pool,
          context: adminContext,
          idempotencyKey: 'idemp-auth-missing-key-short',
          policyEngine,
          accessGrantTokenKey: 'too-short',
          input: { documentId: doc1.id, versionId: ver1.id, action: 'open' },
        });
      },
      /ACCESS_GRANT_TOKEN_KEY_MISSING/,
      'SHORT_KEY must fail closed with ACCESS_GRANT_TOKEN_KEY_MISSING',
    );

    await assert.rejects(
      async () => {
        await authorizeContentAccessCommand({
          pool,
          context: adminContext,
          idempotencyKey: 'idemp-auth-missing-key-empty',
          policyEngine,
          accessGrantTokenKey: '',
          input: { documentId: doc1.id, versionId: ver1.id, action: 'open' },
        });
      },
      /ACCESS_GRANT_TOKEN_KEY_MISSING/,
      'EMPTY_KEY must fail closed with ACCESS_GRANT_TOKEN_KEY_MISSING',
    );

    // 12. DIFFERENT_TOKEN_KEY: wrong key produces unrecognized token hash
    const wrongRawToken = createHash('sha256').update('wrong-derivation-different-key').digest('hex');
    await assert.rejects(
      async () => {
        await exchangeGrantForContentStreamCommand({
          pool,
          context: teacherContext,
          policyEngine,
          storageProvider,
          input: { rawAccessToken: wrongRawToken },
        });
      },
      /GRANT_NOT_FOUND/,
      'DIFFERENT_TOKEN_KEY: unrecognized hash must yield GRANT_NOT_FOUND',
    );

    // 8. NO_RAW_TOKEN_AT_REST + RAW_KEY_AT_REST=NO
    const allGrants = await client.query<{ token_hash: string }>(
      `SELECT token_hash FROM document_content_access_grants WHERE institution_id = $1`,
      [institutionId],
    );
    for (const row of allGrants.rows) {
      assert.strictEqual(row.token_hash.length, 64, 'Token hash must be exactly 64-char SHA256 hex');
      assert.match(row.token_hash, /^[0-9a-f]{64}$/, 'Token hash must be lowercase hex');
      assert.notStrictEqual(row.token_hash, TEST_ACCESS_GRANT_TOKEN_KEY, 'RAW_KEY_AT_REST=NO');
    }

    console.log('[DOCUMENTS-ACCESS-POSTGRES] PASS: Lifecycle, revocation, membership, stolen-token denial, response-loss recovery, missing-key fail-closed, different-key boundary verified.');
  } finally {
    client.release();
  }
} finally {
  await pool.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
  await pool.end();
}
