import type { Application, RequestHandler, Response } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import {
  addEnrollmentDocument,
  EnrollmentDocumentApiError,
  listEnrollmentDocuments,
  transitionEnrollmentDocument,
} from './enrollment-document-api.ts';
import { configureEnrollmentDocumentRequirements, EnrollmentDocumentRequirementsError } from './enrollment-document-requirements-api.ts';

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
  if (error instanceof EnrollmentDocumentRequirementsError) {
    if (error.code === 'NOT_FOUND') return reject(res, 404, error.message);
    if (error.code === 'FORBIDDEN') return reject(res, 403, error.message);
    if (error.code === 'SNAPSHOT_ALREADY_CAPTURED') return reject(res, 409, error.message);
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

export function registerEnrollmentDocumentRoutes(app: Application, dependencies: { pool?: typeof pool; requireAuth?: RequestHandler } = {}) {
  const documentPool = dependencies.pool ?? pool;
  const documentRequireAuth = dependencies.requireAuth ?? requireAuth;
  app.get('/api/enrollments/:id/documents', documentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = institutionalContext(req, res); if (!context) return;
    try {
      const result = await listEnrollmentDocuments(documentPool, context, req.params.id);
      return res.json(result);
    } catch (error) {
      return rejectDocumentError(res, error);
    }
  });

  app.post('/api/enrollments/:id/documents', documentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = institutionalContext(req, res); if (!context) return;
    try {
      const result = await addEnrollmentDocument(documentPool, context, {
        enrollmentId: req.params.id,
        documentType: req.body?.documentType,
      });
      return res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      return rejectDocumentError(res, error);
    }
  });

  app.post('/api/enrollments/:id/documents/:documentId/transitions', documentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = institutionalContext(req, res); if (!context) return;
    try {
      const document = await transitionEnrollmentDocument(documentPool, context, {
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

  app.post('/api/enrollments/:id/document-requirements', documentRequireAuth, async (req: AuthRequest, res: Response) => {
    const context = institutionalContext(req, res); if (!context) return;
    try {
      const result = await configureEnrollmentDocumentRequirements(documentPool as any, context, {
        enrollmentId: req.params.id,
        requirements: req.body?.requirements,
      });
      return res.status(result.replayed ? 200 : 201).json({ configuration: result });
    } catch (error) {
      return rejectDocumentError(res, error);
    }
  });
}
