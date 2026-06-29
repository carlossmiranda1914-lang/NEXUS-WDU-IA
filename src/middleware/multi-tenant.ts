import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.ts';

export interface TenantRequest extends AuthRequest {
  tenantId?: string;
  schoolId?: string;
  organizationId?: string;
}

export const multiTenantMiddleware = (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  // 1. Extract tenant details from custom enterprise headers
  let tenantId = req.headers['x-tenant-id'] as string;
  let schoolId = req.headers['x-school-id'] as string;
  let organizationId = req.headers['x-organization-id'] as string;

  // 2. Extract from query parameters as fallback (e.g. for simple exports/downloads)
  if (!tenantId && req.query.tenantId) {
    tenantId = String(req.query.tenantId);
  }
  if (!schoolId && req.query.schoolId) {
    schoolId = String(req.query.schoolId);
  }
  if (!organizationId && req.query.organizationId) {
    organizationId = String(req.query.organizationId);
  }

  // 3. Fallback extraction from authenticated user identity domain claims
  const user = req.user;
  if (user) {
    const email = user.email || '';
    if (!tenantId) {
      if (email.endsWith('@nexus.edu') || email.includes('carlossmiranda1914')) {
        tenantId = 'tenant-nexus-group';
      } else if (email.endsWith('@director.pt') || email.endsWith('@escola.pt')) {
        tenantId = 'tenant-escola-portugal';
      } else {
        // Dynamic deterministic hash-tenant ID based on email domain to scale horizontally
        const domain = email.split('@')[1];
        if (domain && domain !== 'gmail.com' && domain !== 'nexus.edu') {
          tenantId = `tenant-${domain.replace(/\./g, '-')}`;
        } else {
          tenantId = 'default-tenant';
        }
      }
    }

    if (!schoolId) {
      schoolId = user.department ? `school-${user.department.toLowerCase().replace(/\s+/g, '-')}` : 'default-school';
    }
    if (!organizationId) {
      organizationId = 'default-org';
    }
  }

  // 4. Ultimate secure default values
  req.tenantId = tenantId || 'default-tenant';
  req.schoolId = schoolId || 'default-school';
  req.organizationId = organizationId || 'default-org';

  // 5. STRICT SECURITY ENFORCEMENT & DATA ISOLATION GUARD
  if (user) {
    const userRole = user.dbRole || '';
    
    // Non-admins cannot query a tenant different from their determined identity
    if (userRole !== 'admin' && userRole !== 'director') {
      const expectedTenant = (user.email && (user.email.endsWith('@nexus.edu') || user.email.includes('carlossmiranda1914'))) 
        ? 'tenant-nexus-group' 
        : 'default-tenant';

      if (req.tenantId !== expectedTenant && req.tenantId !== 'default-tenant') {
        console.warn(`[SECURITY ALERT] User ${user.email} (Role: ${userRole}) attempted unauthorized tenant cross-access: Target: ${req.tenantId}, expected: ${expectedTenant}`);
        return res.status(403).json({
          error: `Isolamento Ativo: O seu perfil '${userRole}' não possui autorização para cruzar fronteiras organizacionais para o Tenant '${req.tenantId}'.`
        });
      }
    }
  }

  next();
};
