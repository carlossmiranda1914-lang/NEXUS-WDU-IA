import type { Application, Response } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { assignEnrollmentProcess, EnrollmentProcessApiError, loadEnrollmentProcess } from './enrollment-process-api.ts';

function reject(res: Response, status: number, error: string) { return res.status(status).json({ error }); }

function rejectProcessError(res: Response, error: unknown) {
  if (error instanceof EnrollmentProcessApiError) {
    if (error.code === 'NOT_FOUND') return reject(res, 404, error.message);
    if (error.code === 'FORBIDDEN') return reject(res, 403, error.message);
    if (error.code === 'STALE_VERSION') return reject(res, 409, error.message);
    return reject(res, 400, error.message);
  }
  console.error('[ENROLLMENT-PROCESS] unhandled error', error);
  return reject(res, 500, 'Não foi possível carregar o processo de matrícula.');
}

export function registerEnrollmentProcessRoutes(app: Application) {
  app.get('/api/enrollments/:id/process', requireAuth, async (req: AuthRequest, res: Response) => {
    if (!req.institutionalContext) return reject(res, 401, 'Autenticação institucional necessária.');
    try {
      const process = await loadEnrollmentProcess(pool, req.institutionalContext, req.params.id);
      return res.json({ process });
    } catch (error) {
      return rejectProcessError(res, error);
    }
  });

  app.patch('/api/enrollments/:id/process/assignment', requireAuth, async (req: AuthRequest, res: Response) => {
    if (!req.institutionalContext) return reject(res, 401, 'Autenticação institucional necessária.');
    try {
      const assignment = await assignEnrollmentProcess(pool, req.institutionalContext, req.params.id, {
        assignedToPersonId: req.body?.assignedToPersonId ?? null,
        expectedVersion: req.body?.expectedVersion,
      });
      return res.json({ assignment });
    } catch (error) {
      return rejectProcessError(res, error);
    }
  });
}
