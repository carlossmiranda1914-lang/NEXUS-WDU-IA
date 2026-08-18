import type { Application, Response } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import {
  addEnrollmentDocument,
  EnrollmentDocumentApiError,
  listEnrollmentDocuments,
  transitionEnrollmentDocument,
} from './enrollment-document-api.ts';
import { createFilesystemEnrollmentDocumentStorage } from './enrollment-document-filesystem-storage.ts';
import { EnrollmentDocumentFileApiError, getEnrollmentDocumentFile, uploadEnrollmentDocumentFile } from './enrollment-document-file-api.ts';

function reject(res: Response, status: number, error: string) {
  return res.status(status).json({ error });
}

function institutionalContext(req: AuthRequest, res: Response) {
  if (!req.institutionalContext) {
    reject(res, 401, 'Autenticação institucional necessária.');
    return null;
  }
  return req.institutionalContext;
}

function rejectDocumentError(res: Response, error: unknown) {
  if (error instanceof EnrollmentDocumentFileApiError) {
    if (error.code === 'NOT_FOUND') return reject(res, 404, 'Ficheiro não encontrado.');
    if (error.code === 'FORBIDDEN') return reject(res, 403, error.message);
    if (error.code === 'CONFLICT') return reject(res, 409, error.message);
    if (error.code === 'PERSISTENCE_FAILURE') return reject(res, 500, 'Não foi possível concluir a operação documental.');
    return reject(res, 400, error.message);
  }
  if (error instanceof EnrollmentDocumentApiError) {
    if (error.code === 'NOT_FOUND') return reject(res, 404, error.message);
    if (error.code === 'FORBIDDEN') return reject(res, 403, error.message);
    if (error.code === 'INVALID_TRANSITION') return reject(res, 409, error.message);
    return reject(res, 400, error.message);
  }
  console.error('[ENROLLMENT-DOCUMENTS] unhandled error', error);
  return reject(res, 500, 'Não foi possível concluir a operação documental.');
}

async function readBinaryBody(req: AuthRequest): Promise<Buffer> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { const value = Buffer.from(chunk); size += value.length; if (size > 6 * 1024 * 1024) throw new EnrollmentDocumentFileApiError('INVALID_INPUT', 'O ficheiro excede o limite de 6 MB.'); chunks.push(value); }
  return Buffer.concat(chunks);
}

function safeDispositionFilename(value: string) { return value.replace(/[\\/\r\n"]/g, '_').slice(0, 255) || 'documento'; }

function decodeFileName(value: string | undefined) {
  if (!value || value.length > 1024) return '';
  try { return safeDispositionFilename(decodeURIComponent(value)); } catch { return ''; }
}

export function registerEnrollmentDocumentRoutes(app: Application) {
  app.get('/api/enrollments/:id/documents', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = institutionalContext(req, res); if (!context) return;
    try {
      const result = await listEnrollmentDocuments(pool, context, req.params.id);
      return res.json(result);
    } catch (error) {
      return rejectDocumentError(res, error);
    }
  });

  app.post('/api/enrollments/:id/documents', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = institutionalContext(req, res); if (!context) return;
    try {
      const result = await addEnrollmentDocument(pool, context, {
        enrollmentId: req.params.id,
        documentType: req.body?.documentType,
      });
      return res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      return rejectDocumentError(res, error);
    }
  });

  app.post('/api/enrollments/:id/documents/:documentId/transitions', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = institutionalContext(req, res); if (!context) return;
    try {
      const document = await transitionEnrollmentDocument(pool, context, {
        enrollmentId: req.params.id,
        documentId: req.params.documentId,
        toStatus: req.body?.toStatus,
        evidenceReference: req.body?.evidenceReference,
      });
      return res.json({ document });
    } catch (error) {
      return rejectDocumentError(res, error);
    }
  });

  app.post('/api/enrollments/:id/documents/:documentId/file', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = institutionalContext(req, res); if (!context) return;
    try {
      const filename = decodeFileName(req.header('x-file-name'));
      const result = await uploadEnrollmentDocumentFile(pool, createFilesystemEnrollmentDocumentStorage(), context, {
        enrollmentId: req.params.id, documentId: req.params.documentId, filename, contentType: req.header('content-type'), idempotencyKey: req.header('idempotency-key'), body: await readBinaryBody(req),
      });
      return res.status(result.replayed ? 200 : 201).json({ file: result.file, replayed: result.replayed });
    } catch (error) { return rejectDocumentError(res, error); }
  });

  app.get('/api/enrollments/:id/documents/:documentId/file', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = institutionalContext(req, res); if (!context) return;
    try {
      const result = await getEnrollmentDocumentFile(pool, createFilesystemEnrollmentDocumentStorage(), context, req.params.id, req.params.documentId);
      res.setHeader('Content-Type', result.file.contentType);
      res.setHeader('Content-Length', String(result.file.byteSize));
      res.setHeader('Content-Disposition', `attachment; filename="${safeDispositionFilename(result.file.filename)}"`);
      for await (const chunk of result.content) res.write(chunk);
      return res.end();
    } catch (error) { return rejectDocumentError(res, error); }
  });
}
