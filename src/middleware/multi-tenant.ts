import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.ts';

export interface TenantRequest extends AuthRequest {
  tenantId?: string;
  schoolId?: string;
  organizationId?: string;
}

export const multiTenantMiddleware = (req: TenantRequest, res: Response, next: NextFunction) => {
  const context = req.institutionalContext;
  if (!context) {
    return res.status(403).json({ error: 'Contexto institucional obrigatório.' });
  }

  const requestedInstitutionId = (req.headers['x-institution-id'] as string | undefined)
    || (req.headers['x-tenant-id'] as string | undefined)
    || (req.headers['x-school-id'] as string | undefined)
    || (req.query.institutionId ? String(req.query.institutionId) : undefined)
    || (req.query.tenantId ? String(req.query.tenantId) : undefined)
    || (req.query.schoolId ? String(req.query.schoolId) : undefined);

  if (requestedInstitutionId && requestedInstitutionId !== context.institutionId) {
    return res.status(403).json({ error: 'A instituição solicitada não corresponde à associação ativa.' });
  }

  // The client never determines the school by email, domain, or an arbitrary header.
  req.tenantId = context.institutionId;
  req.schoolId = context.institutionId;
  req.organizationId = context.institutionId;
  next();
};
