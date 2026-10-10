import { execSync } from 'node:child_process';

const cwd = 'D:/Nexus/repo/NEXUS-WDU-IA';

// --- 1. Prepare staged document-command.ts ---
const baseCmdContent = execSync('git show HEAD:src/modules/documents/document-command.ts', {
  cwd,
  encoding: 'utf-8',
}).replace(/\r\n/g, '\n');

// 1.1 Imports in document-command.ts
const targetCmdImports = `import { createCanonicalDocumentsFingerprint } from './document-model.ts';`;
const replacementCmdImports = `import {
  createCanonicalDocumentsFingerprint,
  isCanonicalCategory,
  normalizeDocumentCategory,
} from './document-model.ts';
import type { DocumentAuthorizationAuthority } from './document-authorization-policy.ts';
import {
  DefaultDocumentAuthorizationAuthority,
  createDefaultDocumentAuthorizationRules,
} from './document-authorization-policy.ts';`;

if (!baseCmdContent.includes(targetCmdImports)) {
  throw new Error('targetCmdImports not found in HEAD of document-command.ts');
}

// 1.2 createDocumentCommand in document-command.ts
const cmdStart = baseCmdContent.indexOf('export async function createDocumentCommand(input: {');
if (cmdStart === -1) {
  throw new Error('createDocumentCommand not found in HEAD of document-command.ts');
}

const replacementCreateDocFunc = `export async function createDocumentCommand(input: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: CreateDocumentCommandInput;
  authorizationAuthority?: DocumentAuthorizationAuthority;
}): Promise<{ replayed: boolean; result: DocumentRecord }> {
  const { pool, context, idempotencyKey, input: creationInput } = input;

  const rawCategory = creationInput.category?.trim();
  if (!rawCategory || !isCanonicalCategory(rawCategory)) {
    throw new Error(
      \`INVALID_CATEGORY: Document category "\${creationInput.category}" is not governed in canonical taxonomy.\`,
    );
  }
  const canonicalCategory = normalizeDocumentCategory(rawCategory);

  const authAuthority =
    input.authorizationAuthority ??
    new DefaultDocumentAuthorizationAuthority({
      rules: createDefaultDocumentAuthorizationRules(),
    });

  const authDecision = authAuthority.authorize({
    institutionId: context.institutionId,
    personId: context.personId,
    role: context.role,
    action: 'create_document',
    documentCategory: canonicalCategory,
  });

  if (!authDecision.allowed) {
    throw new Error(
      \`AUTHORIZATION_DENIED: Action create_document is not permitted for role \${context.role} (\${authDecision.reasonCode})\`,
    );
  }

  const canonicalFingerprint = createDocumentFingerprint(
    context.institutionId,
    {
      ...creationInput,
      category: canonicalCategory,
    },
    context.personId,
  );

  const repo = new PostgresDocumentRepository();
  const auditRepo = new PostgresDocumentAuditRepository();

  return executeIdempotentDocumentsCommand({
    pool,
    context,
    identity: {
      institutionId: context.institutionId,
      commandScope: 'documents.create',
      idempotencyKey,
      canonicalFingerprint,
    },
    execute: async (client) => {
      const doc = await repo.createDocument(client, {
        institutionId: context.institutionId,
        category: canonicalCategory,
        classification: creationInput.classification ?? null,
        createdByPersonId: context.personId,
      });

      await auditRepo.recordAuditEvent(client, {
        institutionId: context.institutionId,
        documentId: doc.id,
        actorPersonId: context.personId,
        action: 'document.created',
        outcome: 'success',
        correlationId: creationInput.provenance?.correlationId ?? null,
        details: {
          category: doc.category,
          classification: doc.classification,
        },
      });

      const outboxRepo = new PostgresDocumentOutboxRepository();
      await outboxRepo.insertEventIntent(client, {
        institutionId: context.institutionId,
        eventType: 'document.created',
        aggregateType: 'document',
        aggregateId: doc.id,
        actorPersonId: context.personId,
        correlationId: creationInput.provenance?.correlationId ?? null,
        payload: {
          category: doc.category,
          classification: doc.classification,
        },
      });

      return {
        resultRef: doc.id,
        result: doc,
      };
    },
    loadResult: async (client, resultRef) => {
      const doc = await repo.getDocumentById(client, context.institutionId, resultRef);
      if (!doc) throw new Error('Persisted document missing on replay');
      return doc;
    },
  });
}
`;

let stagedCmdContent = baseCmdContent.replace(targetCmdImports, replacementCmdImports);
stagedCmdContent = stagedCmdContent.substring(0, stagedCmdContent.indexOf('export async function createDocumentCommand(input: {')) + replacementCreateDocFunc;

const cmdSha = execSync('git hash-object -w --stdin', {
  cwd,
  input: stagedCmdContent,
  encoding: 'utf-8',
}).trim();
console.log(`document-command.ts blob created: ${cmdSha}`);
execSync(`git update-index --cacheinfo 100644 ${cmdSha} src/modules/documents/document-command.ts`, { cwd });


// --- 2. Prepare staged document-upload-command.ts ---
const baseUploadContent = execSync('git show HEAD:src/modules/documents/document-upload-command.ts', {
  cwd,
  encoding: 'utf-8',
}).replace(/\r\n/g, '\n');

// 2.1 Imports in document-upload-command.ts
const targetUploadImports = `import type { ObjectStorageProvider } from './object-storage-provider.ts';
import { executeIdempotentDocumentsCommand } from './document-command.ts';`;
const replacementUploadImports = `import type { ObjectStorageProvider } from './object-storage-provider.ts';
import { executeIdempotentDocumentsCommand } from './document-command.ts';
import type { DocumentAuthorizationAuthority } from './document-authorization-policy.ts';
import {
  DefaultDocumentAuthorizationAuthority,
  createDefaultDocumentAuthorizationRules,
} from './document-authorization-policy.ts';`;

if (!baseUploadContent.includes(targetUploadImports)) {
  throw new Error('targetUploadImports not found in HEAD of document-upload-command.ts');
}

// 2.2 createUploadSessionCommand in document-upload-command.ts
const targetUploadCmdSignature = `export async function createUploadSessionCommand(input: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: CreateUploadSessionCommandInput;
}): Promise<{ replayed: boolean; result: CreateUploadSessionResult }> {`;

const replacementUploadCmdSignature = `export async function createUploadSessionCommand(input: {
  pool: Pool;
  context: InstitutionalContext;
  idempotencyKey: string;
  input: CreateUploadSessionCommandInput;
  authorizationAuthority?: DocumentAuthorizationAuthority;
}): Promise<{ replayed: boolean; result: CreateUploadSessionResult }> {`;

const targetDocCheck = `      // Confirm document exists in institution
      const doc = await docRepo.getDocumentById(client, context.institutionId, cmdInput.documentId);
      if (!doc) {
        throw new Error(
          \`Document \${cmdInput.documentId} not found in institution \${context.institutionId}\`,
        );
      }`;

const replacementDocCheck = `      // Confirm document exists in institution
      const doc = await docRepo.getDocumentById(client, context.institutionId, cmdInput.documentId);
      if (!doc) {
        throw new Error(
          \`Document \${cmdInput.documentId} not found in institution \${context.institutionId}\`,
        );
      }

      // Central H1 Authorization Authority enforcement at command boundary
      const authAuthority =
        input.authorizationAuthority ??
        new DefaultDocumentAuthorizationAuthority({
          rules: createDefaultDocumentAuthorizationRules(),
        });

      const authDecision = authAuthority.authorize({
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        action: 'upload_version',
        documentId: doc.id,
        documentCategory: doc.category,
        documentStatus: doc.status,
      });

      if (!authDecision.allowed) {
        throw new Error(
          \`AUTHORIZATION_DENIED: Action upload_version is not permitted for role \${context.role} (\${authDecision.reasonCode})\`,
        );
      }`;

if (!baseUploadContent.includes(targetUploadCmdSignature)) {
  throw new Error('targetUploadCmdSignature not found in HEAD of document-upload-command.ts');
}
if (!baseUploadContent.includes(targetDocCheck)) {
  throw new Error('targetDocCheck not found in HEAD of document-upload-command.ts');
}

let stagedUploadContent = baseUploadContent
  .replace(targetUploadImports, replacementUploadImports)
  .replace(targetUploadCmdSignature, replacementUploadCmdSignature)
  .replace(targetDocCheck, replacementDocCheck);

const uploadSha = execSync('git hash-object -w --stdin', {
  cwd,
  input: stagedUploadContent,
  encoding: 'utf-8',
}).trim();
console.log(`document-upload-command.ts blob created: ${uploadSha}`);
execSync(`git update-index --cacheinfo 100644 ${uploadSha} src/modules/documents/document-upload-command.ts`, { cwd });


// --- 3. Prepare staged document.controller.ts ---
const baseCtrlContent = execSync('git show HEAD:src/modules/documents/document.controller.ts', {
  cwd,
  encoding: 'utf-8',
}).replace(/\r\n/g, '\n');

// 3.1 Import DocumentRecord
const targetCtrlImports = `import {
  CANONICAL_DOCUMENT_CATEGORIES,
  CANONICAL_DOCUMENT_CLASSIFICATIONS,
  CANONICAL_SUPPORTED_MIME_TYPES,
  isCanonicalCategory,
  normalizeDocumentCategory,
} from './document-model.ts';`;

const replacementCtrlImports = `import {
  type DocumentRecord,
  CANONICAL_DOCUMENT_CATEGORIES,
  CANONICAL_DOCUMENT_CLASSIFICATIONS,
  CANONICAL_SUPPORTED_MIME_TYPES,
  isCanonicalCategory,
  normalizeDocumentCategory,
} from './document-model.ts';`;

if (!baseCtrlContent.includes(targetCtrlImports)) {
  throw new Error('targetCtrlImports not found in HEAD of document.controller.ts');
}

// 3.2 Add INVALID_CATEGORY to 400 Bad Request
const targetBadReq = `    // 400 Bad Request
    if (
      msg.includes('Invalid document category') ||
      msg.includes('Invalid mime type') ||`;

const replacementBadReq = `    // 400 Bad Request
    if (
      msg.includes('Invalid document category') ||
      msg.includes('INVALID_CATEGORY') ||
      msg.includes('Invalid mime type') ||`;

if (!baseCtrlContent.includes(targetBadReq)) {
  throw new Error('targetBadReq not found in HEAD of document.controller.ts');
}

// 3.3 Replace upload-sessions routes and add POST /api/documents
const targetRoutesBlock = `  // 4. POST /api/documents/upload-sessions — Create new document or session
  app.post('/api/documents/upload-sessions', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    if (!uploadPolicyConfig) {
      return rejectDomainError(res, new Error('UPLOAD_POLICY_MISSING'));
    }
    if (!storageProvider || !storageBucket) {
      return rejectDomainError(res, new Error('STORAGE_CONFIGURATION_MISSING'));
    }

    const {
      documentId: rawDocId,
      category,
      classification,
      declaredFilename,
      declaredMimeType,
      declaredByteSize,
      targetVersionNumber,
    } = req.body || {};

    if (!declaredFilename || typeof declaredFilename !== 'string') {
      return reject(res, 400, 'declaredFilename é obrigatório.');
    }
    if (!declaredMimeType || typeof declaredMimeType !== 'string') {
      return reject(res, 400, 'declaredMimeType é obrigatório.');
    }
    if (typeof declaredByteSize !== 'number' || declaredByteSize <= 0) {
      return reject(res, 400, 'declaredByteSize deve ser um número maior que zero.');
    }

    try {
      let documentId = rawDocId;
      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;

      if (!documentId) {
        if (category && typeof category === 'string' && !isCanonicalCategory(category.trim())) {
          return reject(
            res,
            400,
            \`Invalid document category: "\${category}". Category is not governed in canonical taxonomy.\`,
            'INVALID_CATEGORY',
          );
        }

        // Canonical I1/I7 document creation command: domain fact, audit, outbox event intent, idempotency
        const docCreationRes = await createDocumentCommand({
          pool: docPool,
          context,
          idempotencyKey: \`doc-\${idempotencyKey}\`,
          input: {
            category: category && typeof category === 'string' ? normalizeDocumentCategory(category) : 'general',
            classification:
              classification && typeof classification === 'string' ? classification.trim() : null,
            provenance: {
              sourceDomain: 'portal.documents',
              method: 'upload_session_create_doc',
              correlationId: req.header('x-correlation-id') || null,
            },
          },
        });
        documentId = docCreationRes.result.id;
      } else if (!validUuid(documentId)) {
        return reject(res, 400, 'documentId inválido.');
      }

      const sessionResult = await createUploadSessionCommand({
        pool: docPool,
        context,
        idempotencyKey,
        input: {
          documentId,
          targetVersionNumber: targetVersionNumber ? Number(targetVersionNumber) : null,
          declaredFilename,
          declaredMimeType,
          declaredByteSize,
          policyConfig: uploadPolicyConfig,
          storageProvider: storageProvider.providerName,
          storageBucket,
          provenance: {
            sourceDomain: 'portal.documents',
            method: 'upload_session',
            correlationId: req.header('x-correlation-id') || null,
          },
        },
      });

      const safeSession = sanitizeUploadSession(sessionResult.result.session);
      const responseData = {
        documentId,
        sessionId: safeSession.id,
        session: safeSession,
        rawToken: sessionResult.result.rawToken,
        effectiveLimit: sessionResult.result.effectiveLimit,
        replayed: sessionResult.replayed,
      };

      assertNoInternalSecretsInDto(safeSession);
      return res.status(201).json(responseData);
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 5. POST /api/documents/:id/versions/upload-sessions — Create version upload session
  app.post('/api/documents/:id/versions/upload-sessions', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    if (!uploadPolicyConfig) {
      return rejectDomainError(res, new Error('UPLOAD_POLICY_MISSING'));
    }
    if (!storageProvider || !storageBucket) {
      return rejectDomainError(res, new Error('STORAGE_CONFIGURATION_MISSING'));
    }

    const documentId = req.params.id;
    if (!validUuid(documentId)) {
      return reject(res, 400, 'Identificador de documento inválido.');
    }

    const {
      declaredFilename,
      declaredMimeType,
      declaredByteSize,
      targetVersionNumber,
    } = req.body || {};

    if (!declaredFilename || typeof declaredFilename !== 'string') {
      return reject(res, 400, 'declaredFilename é obrigatório.');
    }
    if (!declaredMimeType || typeof declaredMimeType !== 'string') {
      return reject(res, 400, 'declaredMimeType é obrigatório.');
    }
    if (typeof declaredByteSize !== 'number' || declaredByteSize <= 0) {
      return reject(res, 400, 'declaredByteSize deve ser um número maior que zero.');
    }

    try {
      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;
      const sessionResult = await createUploadSessionCommand({
        pool: docPool,
        context,
        idempotencyKey,
        input: {
          documentId,
          targetVersionNumber: targetVersionNumber ? Number(targetVersionNumber) : null,
          declaredFilename,
          declaredMimeType,
          declaredByteSize,
          policyConfig: uploadPolicyConfig,
          storageProvider: storageProvider.providerName,
          storageBucket,
          provenance: {
            sourceDomain: 'portal.documents',
            method: 'version_upload_session',
            correlationId: req.header('x-correlation-id') || null,
          },
        },
      });

      const safeSession = sanitizeUploadSession(sessionResult.result.session);
      const responseData = {
        documentId,
        sessionId: safeSession.id,
        session: safeSession,
        rawToken: sessionResult.result.rawToken,
        effectiveLimit: sessionResult.result.effectiveLimit,
        replayed: sessionResult.replayed,
      };

      assertNoInternalSecretsInDto(safeSession);
      return res.status(201).json(responseData);
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });`;

const replacementRoutesBlock = `  // 3.1. POST /api/documents — Direct document creation
  app.post('/api/documents', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    const { category, classification } = req.body || {};
    const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
    if (idempotencyKey === null) return res;

    if (!category || typeof category !== 'string' || !isCanonicalCategory(category.trim())) {
      return reject(
        res,
        400,
        \`Invalid document category: "\${category}". Category is not governed in canonical taxonomy.\`,
        'INVALID_CATEGORY',
      );
    }

    const canonicalCategory = normalizeDocumentCategory(category.trim());

    // Controller authorization enforcement: CREATE_DOCUMENT
    const createAuth = authAuthority.authorize({
      institutionId: context.institutionId,
      personId: context.personId,
      role: context.role,
      action: 'create_document',
      documentCategory: canonicalCategory,
    });

    if (!createAuth.allowed) {
      return reject(res, 403, 'Acesso não autorizado para criação de documento.', 'AUTHORIZATION_DENIED');
    }

    try {
      const docRes = await createDocumentCommand({
        pool: docPool,
        context,
        idempotencyKey,
        authorizationAuthority: authAuthority,
        input: {
          category: canonicalCategory,
          classification:
            classification && typeof classification === 'string' ? classification.trim() : null,
          provenance: {
            sourceDomain: 'portal.documents',
            method: 'direct_create_doc',
            correlationId: req.header('x-correlation-id') || null,
          },
        },
      });

      return res.status(201).json({
        document: docRes.result,
        replayed: docRes.replayed,
      });
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 4. POST /api/documents/upload-sessions — Create new document or session
  app.post('/api/documents/upload-sessions', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    if (!uploadPolicyConfig) {
      return rejectDomainError(res, new Error('UPLOAD_POLICY_MISSING'));
    }
    if (!storageProvider || !storageBucket) {
      return rejectDomainError(res, new Error('STORAGE_CONFIGURATION_MISSING'));
    }

    const {
      documentId: rawDocId,
      category,
      classification,
      declaredFilename,
      declaredMimeType,
      declaredByteSize,
      targetVersionNumber,
    } = req.body || {};

    if (!declaredFilename || typeof declaredFilename !== 'string') {
      return reject(res, 400, 'declaredFilename é obrigatório.');
    }
    if (!declaredMimeType || typeof declaredMimeType !== 'string') {
      return reject(res, 400, 'declaredMimeType é obrigatório.');
    }
    if (typeof declaredByteSize !== 'number' || declaredByteSize <= 0) {
      return reject(res, 400, 'declaredByteSize deve ser um número maior que zero.');
    }

    try {
      let documentId = rawDocId;
      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;

      let resolvedDoc: DocumentRecord | null = null;

      if (!documentId) {
        const rawCategory = category && typeof category === 'string' ? category.trim() : 'general';
        if (!isCanonicalCategory(rawCategory)) {
          return reject(
            res,
            400,
            \`Invalid document category: "\${category}". Category is not governed in canonical taxonomy.\`,
            'INVALID_CATEGORY',
          );
        }
        const canonicalCategory = normalizeDocumentCategory(rawCategory);

        // Controller authorization enforcement: CREATE_DOCUMENT
        const createAuth = authAuthority.authorize({
          institutionId: context.institutionId,
          personId: context.personId,
          role: context.role,
          action: 'create_document',
          documentCategory: canonicalCategory,
        });

        if (!createAuth.allowed) {
          return reject(res, 403, 'Acesso não autorizado para criação de documento.', 'AUTHORIZATION_DENIED');
        }

        // Canonical I1/I7 document creation command: domain fact, audit, outbox event intent, idempotency
        const docCreationRes = await createDocumentCommand({
          pool: docPool,
          context,
          idempotencyKey: \`doc-\${idempotencyKey}\`,
          authorizationAuthority: authAuthority,
          input: {
            category: canonicalCategory,
            classification:
              classification && typeof classification === 'string' ? classification.trim() : null,
            provenance: {
              sourceDomain: 'portal.documents',
              method: 'upload_session_create_doc',
              correlationId: req.header('x-correlation-id') || null,
            },
          },
        });
        documentId = docCreationRes.result.id;
        resolvedDoc = docCreationRes.result;
      } else {
        if (!validUuid(documentId)) {
          return reject(res, 400, 'documentId inválido.');
        }
        const docRepo = new PostgresDocumentRepository();
        const existingDoc = await docRepo.getDocumentById(docPool, context.institutionId, documentId);
        if (!existingDoc) {
          return reject(res, 404, 'Documento não encontrado no tenant.', 'NOT_FOUND');
        }
        resolvedDoc = existingDoc;
      }

      // Controller authorization enforcement: UPLOAD_VERSION
      const uploadAuth = authAuthority.authorize({
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        action: 'upload_version',
        documentId: resolvedDoc.id,
        documentCategory: resolvedDoc.category,
        documentStatus: resolvedDoc.status,
      });

      if (!uploadAuth.allowed) {
        return reject(res, 403, 'Acesso não autorizado para upload de versão.', 'AUTHORIZATION_DENIED');
      }

      const sessionResult = await createUploadSessionCommand({
        pool: docPool,
        context,
        idempotencyKey,
        authorizationAuthority: authAuthority,
        input: {
          documentId,
          targetVersionNumber: targetVersionNumber ? Number(targetVersionNumber) : null,
          declaredFilename,
          declaredMimeType,
          declaredByteSize,
          policyConfig: uploadPolicyConfig,
          storageProvider: storageProvider.providerName,
          storageBucket,
          provenance: {
            sourceDomain: 'portal.documents',
            method: 'upload_session',
            correlationId: req.header('x-correlation-id') || null,
          },
        },
      });

      const safeSession = sanitizeUploadSession(sessionResult.result.session);
      const responseData = {
        documentId,
        sessionId: safeSession.id,
        session: safeSession,
        rawToken: sessionResult.result.rawToken,
        effectiveLimit: sessionResult.result.effectiveLimit,
        replayed: sessionResult.replayed,
      };

      assertNoInternalSecretsInDto(safeSession);
      return res.status(201).json(responseData);
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });

  // 5. POST /api/documents/:id/versions/upload-sessions — Create version upload session
  app.post('/api/documents/:id/versions/upload-sessions', docAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');

    if (!uploadPolicyConfig) {
      return rejectDomainError(res, new Error('UPLOAD_POLICY_MISSING'));
    }
    if (!storageProvider || !storageBucket) {
      return rejectDomainError(res, new Error('STORAGE_CONFIGURATION_MISSING'));
    }

    const documentId = req.params.id;
    if (!validUuid(documentId)) {
      return reject(res, 400, 'Identificador de documento inválido.');
    }

    const docRepo = new PostgresDocumentRepository();
    const existingDoc = await docRepo.getDocumentById(docPool, context.institutionId, documentId);
    if (!existingDoc) {
      return reject(res, 404, 'Documento não encontrado no tenant.', 'NOT_FOUND');
    }

    // Controller authorization enforcement: UPLOAD_VERSION
    const uploadAuth = authAuthority.authorize({
      institutionId: context.institutionId,
      personId: context.personId,
      role: context.role,
      action: 'upload_version',
      documentId: existingDoc.id,
      documentCategory: existingDoc.category,
      documentStatus: existingDoc.status,
    });

    if (!uploadAuth.allowed) {
      return reject(res, 403, 'Acesso não autorizado para upload de versão.', 'AUTHORIZATION_DENIED');
    }

    const {
      declaredFilename,
      declaredMimeType,
      declaredByteSize,
      targetVersionNumber,
    } = req.body || {};

    if (!declaredFilename || typeof declaredFilename !== 'string') {
      return reject(res, 400, 'declaredFilename é obrigatório.');
    }
    if (!declaredMimeType || typeof declaredMimeType !== 'string') {
      return reject(res, 400, 'declaredMimeType é obrigatório.');
    }
    if (typeof declaredByteSize !== 'number' || declaredByteSize <= 0) {
      return reject(res, 400, 'declaredByteSize deve ser um número maior que zero.');
    }

    try {
      const idempotencyKey = requireIdempotencyKey(req, res, req.body?.idempotencyKey);
      if (idempotencyKey === null) return res;
      const sessionResult = await createUploadSessionCommand({
        pool: docPool,
        context,
        idempotencyKey,
        authorizationAuthority: authAuthority,
        input: {
          documentId,
          targetVersionNumber: targetVersionNumber ? Number(targetVersionNumber) : null,
          declaredFilename,
          declaredMimeType,
          declaredByteSize,
          policyConfig: uploadPolicyConfig,
          storageProvider: storageProvider.providerName,
          storageBucket,
          provenance: {
            sourceDomain: 'portal.documents',
            method: 'version_upload_session',
            correlationId: req.header('x-correlation-id') || null,
          },
        },
      });

      const safeSession = sanitizeUploadSession(sessionResult.result.session);
      const responseData = {
        documentId,
        sessionId: safeSession.id,
        session: safeSession,
        rawToken: sessionResult.result.rawToken,
        effectiveLimit: sessionResult.result.effectiveLimit,
        replayed: sessionResult.replayed,
      };

      assertNoInternalSecretsInDto(safeSession);
      return res.status(201).json(responseData);
    } catch (error) {
      return rejectDomainError(res, error);
    }
  });`;

if (!baseCtrlContent.includes(targetRoutesBlock)) {
  throw new Error('targetRoutesBlock not found in HEAD of document.controller.ts');
}

let stagedCtrlContent = baseCtrlContent
  .replace(targetCtrlImports, replacementCtrlImports)
  .replace(targetBadReq, replacementBadReq)
  .replace(targetRoutesBlock, replacementRoutesBlock);

const ctrlSha = execSync('git hash-object -w --stdin', {
  cwd,
  input: stagedCtrlContent,
  encoding: 'utf-8',
}).trim();
console.log(`document.controller.ts blob created: ${ctrlSha}`);
execSync(`git update-index --cacheinfo 100644 ${ctrlSha} src/modules/documents/document.controller.ts`, { cwd });


// --- 4. Stage test file ---
execSync('git add tests/documents-create-upload-authorization.test.ts', { cwd });

console.log('All H1-05A files staged cleanly!');
