import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { pool } from '../db/index.ts';
import { InstitutionalContext, resolveInstitutionalContext, type InstitutionalContextResolution, type QueryExecutor } from '../auth/institutional-context.ts';

export interface AuthRequest extends Request {
  user?: any;
  institutionalContext?: InstitutionalContext;
}

export interface RequireAuthDependencies {
  verifyIdToken: (token: string) => Promise<{ uid?: string; [key: string]: unknown }>;
  pool: QueryExecutor;
  resolveInstitutionalContext: (executor: QueryExecutor, firebaseUid: string, requestedInstitutionId?: string) => Promise<InstitutionalContextResolution>;
}

export function createRequireAuth(dependencies: RequireAuthDependencies) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user && req.institutionalContext) return next();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    try {
      const decodedToken = await dependencies.verifyIdToken(authHeader.split('Bearer ')[1]);
      if (!decodedToken?.uid) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
      }

      const requestedInstitutionId = typeof req.headers['x-institution-id'] === 'string'
        ? req.headers['x-institution-id']
        : undefined;
      const resolution = dependencies.pool === pool && dependencies.resolveInstitutionalContext === resolveInstitutionalContext
        ? await resolveInstitutionalContext(pool, decodedToken.uid, requestedInstitutionId)
        : await dependencies.resolveInstitutionalContext(dependencies.pool, decodedToken.uid, requestedInstitutionId);

    if (resolution.kind === 'missing_membership') {
      return res.status(403).json({ error: 'Acesso pendente: esta conta não possui uma associação institucional ativa.' });
    }
    if (resolution.kind === 'institution_selection_required') {
      return res.status(409).json({ error: 'Seleção de instituição necessária.', institutions: resolution.institutions });
    }
    if (resolution.kind === 'institution_not_authorized') {
      return res.status(403).json({ error: 'Acesso recusado para a instituição solicitada.' });
    }

      const context = resolution.context;
      req.institutionalContext = context;
      req.user = {
        ...decodedToken,
        dbId: context.personId,
        // Temporary compatibility mapping while the legacy endpoints are migrated.
        dbRole: context.role === 'institution_admin' ? 'admin' : context.role,
        dbName: context.personName,
        dbStatus: 'active',
      };
      next();
    } catch (error: any) {
      console.warn('[AUTH-MIDDLEWARE] Authentication error:', error.message || error);
      return res.status(401).json({ error: 'Unauthorized: token could not be verified' });
    }
  };
}

export const requireAuth = createRequireAuth({
  verifyIdToken: (token) => adminAuth.verifyIdToken(token),
  pool,
  resolveInstitutionalContext,
});
