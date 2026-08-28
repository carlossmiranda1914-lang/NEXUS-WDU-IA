import type { Application, RequestHandler, Response } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { IamReadError, listInstitutionMemberships, parseMembershipListQuery, type IamReadPool, type MembershipListResult } from './iam-read-service.ts';

export type IamReadDependencies = { pool: IamReadPool; requireAuth: RequestHandler; list: (pool: IamReadPool, context: NonNullable<AuthRequest['institutionalContext']>, input: ReturnType<typeof parseMembershipListQuery>) => Promise<MembershipListResult> };
const defaults: IamReadDependencies = { pool, requireAuth, list: listInstitutionMemberships };
function reject(res: Response, status: number, error: string) { return res.status(status).json({ error }); }

export function registerIamReadRoutes(app: Application, dependencies: IamReadDependencies = defaults): void {
  app.get('/api/iam/memberships', dependencies.requireAuth, async (req: AuthRequest, res: Response) => {
    const context = req.institutionalContext;
    if (!context) return reject(res, 401, 'Autenticação institucional necessária.');
    try { return res.json(await dependencies.list(dependencies.pool, context, parseMembershipListQuery(req.query))); }
    catch (error) {
      if (error instanceof IamReadError && error.code === 'UNAUTHORIZED') return reject(res, 403, 'Operação institucional não autorizada.');
      if (error instanceof IamReadError) return reject(res, 400, 'Consulta de membros inválida.');
      return reject(res, 500, 'Não foi possível obter os membros institucionais.');
    }
  });
}
