import { execSync } from 'node:child_process';

const cwd = 'D:/Nexus/repo/NEXUS-WDU-IA';

// --- 1. Prepare staged document-access-command.ts ---
const baseCmdContent = execSync('git show HEAD:src/modules/documents/document-access-command.ts', {
  cwd,
  encoding: 'utf-8',
}).replace(/\r\n/g, '\n');

const cmdStart = baseCmdContent.indexOf('export async function exchangeGrantForContentStreamCommand');
const cmdEnd = baseCmdContent.indexOf('/**\n * Revoke an existing active access grant immediately.');

if (cmdStart === -1 || cmdEnd === -1) {
  throw new Error('Could not find exchangeGrantForContentStreamCommand boundaries in HEAD');
}

const replacementExchangeFunc = `export async function exchangeGrantForContentStreamCommand(params: {
  pool: Pool;
  context: InstitutionalContext;
  policyEngine: DocumentAccessPolicyEngine;
  storageProvider: ObjectStorageProvider;
  input: ExchangeGrantForStreamCommandInput;
  authorizationAuthority?: DocumentAuthorizationAuthority;
}): Promise<ContentStreamResult> {
  const { pool, context, policyEngine, storageProvider, input } = params;

  // FAIL_CLOSED: trusted dependencies must be present
  if (!policyEngine || typeof policyEngine.evaluateAccess !== 'function') {
    throw new Error('POLICY_ENGINE_MISSING: A trusted policy engine is required to exchange access grant');
  }
  if (!storageProvider || typeof storageProvider.openReadStream !== 'function') {
    throw new Error('STORAGE_PROVIDER_MISSING: A trusted storage provider is required to exchange access grant');
  }

  if (!input.rawAccessToken || typeof input.rawAccessToken !== 'string') {
    throw new Error('TOKEN_REQUIRED: Raw access token is mandatory for content stream exchange');
  }

  const tokenHash = hashAccessToken(input.rawAccessToken);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch and Lock Grant (scoped to context institution for tenant isolation)
    const grant = await accessRepo.getGrantByTokenHashForUpdate(
      client,
      context.institutionId,
      tokenHash,
    );

    if (!grant) {
      throw new Error(
        \`GRANT_NOT_FOUND: No access grant found for token in institution \${context.institutionId}\`,
      );
    }

    // 2. CURRENT_ACTOR_MUST_EQUAL_GRANTEE
    // Proves: the current authenticated actor is exactly the person who received the grant.
    // Prevents: token stolen by another person within the same institution.
    if (context.institutionId !== grant.institutionId || context.personId !== grant.granteePersonId) {
      throw new Error(
        \`GRANT_GRANTEE_MISMATCH: The authenticated actor does not match the grant grantee. \` +
        \`Access denied.\`,
      );
    }

    // 3. Check Immediate Revocation
    if (grant.status === 'revoked') {
      throw new Error(
        \`GRANT_REVOKED: Access grant \${grant.id} has been revoked (reason: \${grant.revocationReason || 'unknown'})\`,
      );
    }

    // 4. Check Expiry
    if (grant.status === 'expired' || grant.expiresAt.getTime() <= Date.now()) {
      throw new Error(\`GRANT_EXPIRED: Access grant \${grant.id} expired at \${grant.expiresAt.toISOString()}\`);
    }

    if (grant.status !== 'active') {
      throw new Error(\`GRANT_INACTIVE: Access grant is in state "\${grant.status}"\`);
    }

    // 5. Real-time Membership & Role Revalidation (of grantee — proven equal to actor above)
    const granteeMembership = await accessRepo.getGranteeMembership(
      client,
      context.institutionId,
      grant.granteePersonId,
    );

    if (!granteeMembership || !granteeMembership.isActive) {
      throw new Error(
        \`MEMBERSHIP_REVOKED_OR_INACTIVE: Grantee person \${grant.granteePersonId} has no active membership in institution \${context.institutionId}\`,
      );
    }

    // 6. Fetch Document and Version
    const doc = await docRepo.getDocumentById(client, context.institutionId, grant.documentId);
    if (!doc) {
      throw new Error(\`DOCUMENT_NOT_FOUND: Document \${grant.documentId} does not exist\`);
    }

    const version = await docRepo.getVersionById(client, context.institutionId, grant.versionId);
    if (!version) {
      throw new Error(\`VERSION_NOT_FOUND: Version \${grant.versionId} does not exist\`);
    }

    // 7. Verify Version belongs to Document
    if (version.documentId !== doc.id) {
      throw new Error(
        \`VERSION_DOCUMENT_MISMATCH: Version \${version.id} does not belong to document \${doc.id}\`,
      );
    }

    // 8. Lifecycle & Availability Checks (Document & Version)
    if (doc.status === 'archived') {
      throw new Error('DOCUMENT_ARCHIVED: Document is archived and cannot be accessed');
    }

    if (version.status === 'quarantined') {
      throw new Error('ACCESS_DENIED_QUARANTINED: Version is quarantined and cannot be accessed');
    }

    if (version.status !== 'available') {
      throw new Error(
        \`NOT_AVAILABLE_FOR_ACCESS: Version \${version.id} is in status "\${version.status}", content access requires "available"\`,
      );
    }

    // 9. Central H1 Authorization Authority enforcement with CURRENT role
    const accessAction = grant.action === 'open' ? 'open_content' : 'download_content';
    const authAuthority =
      params.authorizationAuthority ??
      new DefaultDocumentAuthorizationAuthority({
        rules: createDefaultDocumentAuthorizationRules(),
      });

    const authDecision = authAuthority.authorize({
      institutionId: context.institutionId,
      personId: grant.granteePersonId,
      role: granteeMembership.role,
      action: accessAction,
      documentId: doc.id,
      documentCategory: doc.category,
      documentStatus: doc.status,
      versionStatus: version.status,
    });

    if (!authDecision.allowed) {
      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: doc.id,
        versionId: version.id,
        actorPersonId: grant.granteePersonId,
        action: \`document.content_stream_denied.\${grant.action}\`,
        outcome: 'denied',
        correlationId: input.correlationId || null,
        details: {
          grantId: grant.id,
          reason: authDecision.reasonCode,
          currentRole: granteeMembership.role,
        },
      });

      throw new Error(
        \`AUTHORIZATION_DENIED: \${accessAction} is not permitted for current role \${granteeMembership.role} (\${authDecision.reasonCode})\`,
      );
    }

    // 10. Real-time Delegated Policy Re-evaluation with Current Role (trusted dependency)
    const evalResult = policyEngine.evaluateAccess({
      institutionId: context.institutionId,
      personId: grant.granteePersonId,
      role: granteeMembership.role,
      documentCategory: doc.category,
      action: accessAction,
      documentStatus: doc.status,
      versionStatus: version.status,
    });

    if (!evalResult.allowed) {
      throw new Error(
        \`POLICY_NO_LONGER_AUTHORIZED: Policy revalidation failed for role \${granteeMembership.role}: \${evalResult.reason}\`,
      );
    }

    // 11. Get Storage Object Reference
    const storageRef = await docRepo.getStorageReferenceForVersion(
      client,
      context.institutionId,
      version.id,
    );
    if (!storageRef) {
      throw new Error(\`STORAGE_REFERENCE_NOT_FOUND: Storage reference missing for version \${version.id}\`);
    }
    if (storageRef.contentAvailability !== 'available') {
      throw new Error(
        \`CONTENT_UNAVAILABLE: Conteúdo indisponível no armazenamento para esta versão (estado: \${storageRef.contentAvailability}).\`,
      );
    }

    // 12. Open Content Stream (trusted storage provider)
    let stream: NodeJS.ReadableStream;
    try {
      stream = await storageProvider.openReadStream({
        institutionId: context.institutionId,
        storageBucket: storageRef.storageBucket,
        storageKey: storageRef.storageKey,
      });
    } catch (storageErr: any) {
      const errMsg = storageErr instanceof Error ? storageErr.message : String(storageErr);
      const errCode = storageErr?.code || '';
      const isMissingObject =
        errCode === 'ENOENT' ||
        errCode === 'ERR_OBJECT_NOT_FOUND' ||
        errCode === 404 ||
        errMsg.includes('OBJECT_NOT_FOUND') ||
        errMsg.includes('not found') ||
        errMsg.includes('ENOENT') ||
        errMsg.includes('No such object');

      if (isMissingObject) {
        // Storage object physically missing or confirmed unreadable:
        // Update projection to 'unavailable' and emit factual audit event
        await docRepo.updateStorageContentAvailability(
          client,
          context.institutionId,
          version.id,
          'unavailable',
          'Physical storage object confirmed missing during access request',
        );
        await auditRepo.recordAuditEvent(client, {
          institutionId: context.institutionId,
          documentId: doc.id,
          versionId: version.id,
          actorPersonId: grant.granteePersonId,
          action: 'document.storage_object_missing',
          outcome: 'failed',
          correlationId: input.correlationId || null,
          details: {
            grantId: grant.id,
            action: grant.action,
            versionId: version.id,
            reason: 'Storage provider confirmed missing object',
          },
        });
        await client.query('COMMIT');
        throw new Error('CONTENT_UNAVAILABLE: Conteúdo indisponível no armazenamento para esta versão.');
      } else {
        // Transient provider error: Rollback and do NOT project as permanently unavailable!
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(
          \`STORAGE_PROVIDER_TRANSIENT_ERROR: Falha temporária de comunicação com o armazenamento (\${errMsg})\`,
        );
      }
    }

    // 13. Record Grant Usage ONLY after stream open succeeds! (Defect resolution: usage ordering)
    await accessRepo.recordGrantUsage(client, context.institutionId, grant.id);

    // 14. Record factual content stream opened audit event
    await auditRepo.recordAuditEvent(client, {
      institutionId: context.institutionId,
      documentId: doc.id,
      versionId: version.id,
      actorPersonId: grant.granteePersonId,
      action: \`document.content_stream_opened.\${grant.action}\`,
      outcome: 'success',
      correlationId: input.correlationId || null,
      details: {
        grantId: grant.id,
        action: grant.action,
        byteSize: version.byteSize,
        mimeType: version.mimeType,
      },
    });

    await client.query('COMMIT');

    // Resolve display filename from input or completed upload session
    let resolvedFilename = input.displayFilename;
    if (!resolvedFilename) {
      const uploadSessRes = await client.query<{ declared_filename: string }>(
        \`SELECT declared_filename FROM document_upload_sessions
         WHERE institution_id = $1 AND completed_version_id = $2
         LIMIT 1\`,
        [context.institutionId, version.id],
      );
      if (uploadSessRes.rows.length > 0 && uploadSessRes.rows[0].declared_filename) {
        resolvedFilename = uploadSessRes.rows[0].declared_filename;
      }
    }

    const displayFilename = sanitizeDisplayFilename(
      resolvedFilename || \`document_\${doc.id}.bin\`,
    );

    const dispositionType = grant.action === 'download' ? 'attachment' : 'inline';
    const contentDisposition = \`\${dispositionType}; filename="\${displayFilename}"\`;

    return {
      stream,
      byteSize: version.byteSize,
      mimeType: version.mimeType,
      sha256Hash: version.sha256Hash,
      displayFilename,
      contentDisposition,
      grantId: grant.id,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}`;

const stagedCmdContent =
  baseCmdContent.substring(0, cmdStart) +
  replacementExchangeFunc +
  '\n\n' +
  baseCmdContent.substring(cmdEnd);

const cmdSha = execSync('git hash-object -w --stdin', {
  cwd,
  input: stagedCmdContent,
  encoding: 'utf-8',
}).trim();
console.log(`document-access-command.ts blob created: ${cmdSha}`);

execSync(`git update-index --cacheinfo 100644 ${cmdSha} src/modules/documents/document-access-command.ts`, { cwd });


// --- 2. Prepare staged document.controller.ts ---
const baseCtrlContent = execSync('git show HEAD:src/modules/documents/document.controller.ts', {
  cwd,
  encoding: 'utf-8',
}).replace(/\r\n/g, '\n');

// 1. Add msg.includes('DOCUMENT_ARCHIVED') to 403 Forbidden check
const target403 = `      msg.includes('GRANT_GRANTEE_MISMATCH') ||
      msg.includes('MEMBERSHIP_REVOKED_OR_INACTIVE') ||
      msg.includes('POLICY_NO_LONGER_AUTHORIZED') ||
      msg.includes('ACCESS_DENIED_QUARANTINED')
    ) {
      return reject(res, 403, msg, 'AUTHORIZATION_DENIED');
    }`;

const replacement403 = `      msg.includes('GRANT_GRANTEE_MISMATCH') ||
      msg.includes('MEMBERSHIP_REVOKED_OR_INACTIVE') ||
      msg.includes('POLICY_NO_LONGER_AUTHORIZED') ||
      msg.includes('ACCESS_DENIED_QUARANTINED') ||
      msg.includes('DOCUMENT_ARCHIVED')
    ) {
      return reject(res, 403, msg, 'AUTHORIZATION_DENIED');
    }`;

// 2. Add authorizationAuthority: authAuthority to exchange route
const targetExchangeCall = `    try {
      const streamResult = await exchangeGrantForContentStreamCommand({
        pool: docPool,
        context,
        policyEngine,
        storageProvider,
        input: {
          rawAccessToken,
          displayFilename,
          correlationId: req.header('x-correlation-id') || undefined,
        },
      });`;

const replacementExchangeCall = `    try {
      const streamResult = await exchangeGrantForContentStreamCommand({
        pool: docPool,
        context,
        policyEngine,
        storageProvider,
        authorizationAuthority: authAuthority,
        input: {
          rawAccessToken,
          displayFilename,
          correlationId: req.header('x-correlation-id') || undefined,
        },
      });`;

let stagedCtrlContent = baseCtrlContent;
if (!stagedCtrlContent.includes(target403)) throw new Error('target403 not found in HEAD');
stagedCtrlContent = stagedCtrlContent.replace(target403, replacement403);

if (!stagedCtrlContent.includes(targetExchangeCall)) throw new Error('targetExchangeCall not found in HEAD');
stagedCtrlContent = stagedCtrlContent.replace(targetExchangeCall, replacementExchangeCall);

const ctrlSha = execSync('git hash-object -w --stdin', {
  cwd,
  input: stagedCtrlContent,
  encoding: 'utf-8',
}).trim();
console.log(`document.controller.ts blob created: ${ctrlSha}`);

execSync(`git update-index --cacheinfo 100644 ${ctrlSha} src/modules/documents/document.controller.ts`, { cwd });


// --- 3. Stage test files ---
execSync('git add tests/documents-content-exchange-authorization.test.ts tests/documents-access-postgres.test.ts', { cwd });

console.log('All H1-04B files staged cleanly!');
