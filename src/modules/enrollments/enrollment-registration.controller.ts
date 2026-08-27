import type { Application, Response } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import {
  EnrollmentRegistrationApiError,
  loadEnrollmentRegistration,
  saveEnrollmentRegistration,
} from './enrollment-registration-api.ts';

function reject(res: Response, status: number, error: string) {
  return res.status(status).json({ error });
}

function contextForRegistration(req: AuthRequest, res: Response) {
  const context = req.institutionalContext;
  if (!context) {
    reject(res, 401, 'Autenticação institucional necessária.');
    return null;
  }
  return context;
}

function rejectRegistrationError(res: Response, error: unknown) {
  if (error instanceof EnrollmentRegistrationApiError) {
    if (error.code === 'STALE_VERSION') return res.status(409).json({
      code: 'STALE_VERSION',
      message: 'O registo foi alterado entretanto. Recarregue e reveja antes de submeter novamente.',
    });
    if (error.code === 'NOT_FOUND') return reject(res, 404, error.message);
    if (error.code === 'FORBIDDEN') return reject(res, 403, error.message);
    if (error.code === 'IMMUTABLE' || error.code === 'AMBIGUOUS_GUARDIAN') return reject(res, 409, error.message);
    return reject(res, 400, error.message);
  }
  console.error('[ENROLLMENT-REGISTRATION] unhandled error', error);
  return reject(res, 500, 'Não foi possível concluir o cadastro da matrícula.');
}

export function registerEnrollmentRegistrationRoutes(app: Application) {
  app.get('/api/enrollments/:id/registration', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = contextForRegistration(req, res); if (!context) return;
    try {
      const registration = await loadEnrollmentRegistration(pool, context, req.params.id);
      return res.json({ registration });
    } catch (error) {
      return rejectRegistrationError(res, error);
    }
  });

  app.put('/api/enrollments/:id/registration', requireAuth, async (req: AuthRequest, res: Response) => {
    const context = contextForRegistration(req, res); if (!context) return;
    try {
      const registration = await saveEnrollmentRegistration(pool, context, req.params.id, req.body);
      return res.json({ registration });
    } catch (error) {
      return rejectRegistrationError(res, error);
    }
  });
}
