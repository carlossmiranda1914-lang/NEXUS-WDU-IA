import type { Application, RequestHandler, Response } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { activateEnrollment, EnrollmentActivationError } from './enrollment-activation-api.ts';

function reject(res: Response, status: number, code: string, message: string) { return res.status(status).json({ code, message }); }

export function registerEnrollmentActivationRoutes(app: Application, dependencies: { pool?: typeof pool; requireAuth?: RequestHandler } = {}) {
  const activePool = dependencies.pool ?? pool;
  const auth = dependencies.requireAuth ?? requireAuth;
  app.post('/api/enrollments/:id/activate', auth, async (req: AuthRequest, res: Response) => {
    if (!req.institutionalContext) return reject(res, 401, 'UNAUTHORIZED', 'Autenticação institucional necessária.');
    try {
      const result = await activateEnrollment(activePool, req.institutionalContext, req.params.id, {
        expectedLifecycleVersion: req.body?.expectedLifecycleVersion,
        expectedRegistrationVersion: req.body?.expectedRegistrationVersion,
        idempotencyKey: req.header('Idempotency-Key'),
        correlationId: typeof req.headers['x-correlation-id'] === 'string' ? req.headers['x-correlation-id'] : null,
      });
      return res.status(result.replayed ? 200 : 201).json({ activation: result });
    } catch (error) {
      if (error instanceof EnrollmentActivationError) {
        const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : ['STALE_VERSION', 'INVALID_STATE', 'ACTIVATION_NOT_READY', 'IDEMPOTENCY_CONFLICT', 'ALREADY_ACTIVE'].includes(error.code) ? 409 : 400;
        return reject(res, status, error.code, error.message);
      }
      console.error('[ENROLLMENT-ACTIVATION] unhandled error', error);
      return reject(res, 500, 'ACTIVATION_FAILED', 'Não foi possível concluir a ativação da matrícula.');
    }
  });
}
