import type { Application, Response, RequestHandler } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { activatePendingInstitutionAccess, changeMembershipRole, grantInstitutionAccess, revokeInstitutionAccess } from './iam-command-service.ts';
import type { IamCommandPool, IamCommandResult } from './iam-command-types.ts';
import { parseChangeRoleBody, parseGrantBody, parseMembershipId, parseRequestMetadata, parseRevokeBody, publicError, publicResult } from './iam-http-adapter.ts';
import { registerIamReadRoutes } from './iam-read.controller.ts';

type IamCommands = {
  grant: (pool: IamCommandPool, input: Parameters<typeof grantInstitutionAccess>[1]) => Promise<IamCommandResult>;
  changeRole: (pool: IamCommandPool, input: Parameters<typeof changeMembershipRole>[1]) => Promise<IamCommandResult>;
  revoke: (pool: IamCommandPool, input: Parameters<typeof revokeInstitutionAccess>[1]) => Promise<IamCommandResult>;
  activatePending: (pool: IamCommandPool, input: Parameters<typeof activatePendingInstitutionAccess>[1]) => Promise<IamCommandResult>;
};
export type IamHttpDependencies = { pool: IamCommandPool; requireAuth: RequestHandler; commands: IamCommands };
const defaults: IamHttpDependencies = { pool, requireAuth, commands: { grant: grantInstitutionAccess, changeRole: changeMembershipRole, revoke: revokeInstitutionAccess, activatePending: activatePendingInstitutionAccess } };

function context(req: AuthRequest, res: Response) {
  if (req.institutionalContext) return req.institutionalContext;
  res.status(401).json({ error: 'Autenticação institucional necessária.' });
  return null;
}
function reject(res: Response, error: unknown) {
  const safe = publicError(error);
  return res.status(safe.status).json(safe.code ? { error: safe.error, code: safe.code } : { error: safe.error });
}

export function registerIamRoutes(app: Application, dependencies: IamHttpDependencies = defaults): void {
  // Test doubles that exercise only command registration may omit `get`.
  // A real Express Application always supplies it, so production registration
  // remains unconditional for the actual server.
  if (typeof app.get === 'function') registerIamReadRoutes(app);
  app.post('/api/iam/memberships/grants', dependencies.requireAuth, async (req: AuthRequest, res: Response) => {
    const institutionalContext = context(req, res); if (!institutionalContext) return;
    try {
      const input = parseGrantBody(req.body); const metadata = parseRequestMetadata(req.headers);
      const result = input.mode === 'pending'
        ? await dependencies.commands.activatePending(dependencies.pool, { context: institutionalContext, pendingMembershipId: input.pendingMembershipId, role: input.role, expectedVersion: input.expectedVersion, idempotencyKey: input.idempotencyKey, ...metadata })
        : await dependencies.commands.grant(dependencies.pool, { context: institutionalContext, ...input, ...metadata });
      return res.status(result.replayed || result.resultCode === 'ALREADY_ACTIVE' ? 200 : 201).json(publicResult(result));
    } catch (error) { return reject(res, error); }
  });
  app.patch('/api/iam/memberships/:membershipId/role', dependencies.requireAuth, async (req: AuthRequest, res: Response) => {
    const institutionalContext = context(req, res); if (!institutionalContext) return;
    try {
      const input = parseChangeRoleBody(req.body); const metadata = parseRequestMetadata(req.headers);
      const result = await dependencies.commands.changeRole(dependencies.pool, { context: institutionalContext, membershipId: parseMembershipId(req.params.membershipId), ...input, ...metadata });
      return res.json(publicResult(result));
    } catch (error) { return reject(res, error); }
  });
  app.post('/api/iam/memberships/:membershipId/revoke', dependencies.requireAuth, async (req: AuthRequest, res: Response) => {
    const institutionalContext = context(req, res); if (!institutionalContext) return;
    try {
      const input = parseRevokeBody(req.body); const metadata = parseRequestMetadata(req.headers);
      const result = await dependencies.commands.revoke(dependencies.pool, { context: institutionalContext, membershipId: parseMembershipId(req.params.membershipId), ...input, ...metadata });
      return res.json(publicResult(result));
    } catch (error) { return reject(res, error); }
  });
}
