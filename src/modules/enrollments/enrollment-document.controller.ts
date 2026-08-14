import type { Application, Response } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import {
  addEnrollmentDocument,
  EnrollmentDocumentApiError,
  listEnrollmentDocuments,
  transitionEnrollmentDocument,
} from './enrollment-document-api.ts';

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
  if (error instanceof EnrollmentDocumentApiError) {
    if (error.code === 'NOT_FOUND') return reject(res, 404, error.message);
    if (error.code === 'FORBIDDEN') return reject(res, 403, error.message);
    if (error.code === 'INVALID_TRANSITION') return reject(res, 409, error.message);
    return reject(res, 400, error.message);
  }
  console.error('[ENROLLMENT-DOCUMENTS] unhandled error', error);
  return reject(res, 500, 'Não foi possível concluir a operação documental.');
}

export function registerEnrollmentDocumentRoutes(app: Application) {
  app.get('/api/enrollments/:id/documents', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = institutionalContext(req, res); if (!context) return;
    try {
      const documents = await listEnrollmentDocuments(pool, context, req.params.id);
      return res.json({ documents });
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
}
