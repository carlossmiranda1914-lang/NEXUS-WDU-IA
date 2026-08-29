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

const uatTraceEnabled = () => process.env.NODE_ENV !== 'production' && process.env.NEXUS_UAT_AUTH_TRACE === 'true';
const emitUatTrace = (stage: string, details: Record<string, string | number | boolean> = {}) => {
  if (uatTraceEnabled()) console.info('[UAT-AUTH-TRACE]', JSON.stringify({ stage, ...details }));
};

type UatInstitutionalTrace = Record<'uid_match' | 'identity' | 'person' | 'membership' | 'institution' | 'context', string>;

const traceHeader = (trace: UatInstitutionalTrace) => Object.entries(trace).map(([key, value]) => `${key}=${value}`).join(';');

async function traceInstitutionalChain(executor: QueryExecutor, firebaseUid: string): Promise<UatInstitutionalTrace | undefined> {
  if (!uatTraceEnabled()) return undefined;
  const trace: UatInstitutionalTrace = {
    uid_match: process.env.NEXUS_UAT_FIREBASE_UID ? (firebaseUid === process.env.NEXUS_UAT_FIREBASE_UID ? 'YES' : 'NO') : 'CONFIG_UNSET',
    identity: 'NOT_CHECKED', person: 'NOT_CHECKED', membership: 'NOT_CHECKED', institution: 'NOT_CHECKED', context: 'NOT_CHECKED',
  };
  try {
    const identities = await executor.query('SELECT person_id FROM identities WHERE provider = $1 AND provider_subject = $2', ['firebase', firebaseUid]) as { rows: Array<{ person_id: string }> };
    const identityCount = identities.rows.length;
    trace.identity = identityCount === 1 ? 'PASS' : identityCount === 0 ? 'NOT_FOUND' : 'MULTIPLE';
    emitUatTrace('IDENTITY_LOOKUP_RESULT', { result: trace.identity });
    if (identityCount !== 1) return trace;
    const personId = identities.rows[0].person_id;
    const people = await executor.query('SELECT 1 FROM people WHERE id = $1', [personId]);
    trace.person = people.rows.length === 1 ? 'PASS' : 'NOT_FOUND';
    emitUatTrace('PERSON_LOOKUP_RESULT', { result: trace.person });
    if (people.rows.length !== 1) return trace;
    const memberships = await executor.query(`SELECT m.status AS membership_status, n.status AS institution_status FROM memberships m JOIN institutions n ON n.id = m.institution_id WHERE m.person_id = $1`, [personId]) as { rows: Array<{ membership_status: string; institution_status: string }> };
    const activeMemberships = memberships.rows.filter((row) => row.membership_status === 'active');
    trace.membership = activeMemberships.length === 0 ? (memberships.rows.length === 0 ? 'NOT_FOUND' : 'INACTIVE') : activeMemberships.length === 1 ? 'PASS' : 'MULTIPLE';
    emitUatTrace('MEMBERSHIP_LOOKUP_RESULT', { result: trace.membership });
    const activeInstitutions = activeMemberships.filter((row) => row.institution_status === 'active');
    trace.institution = activeInstitutions.length === 0 ? (activeMemberships.length === 0 ? 'NOT_FOUND' : 'INACTIVE') : activeInstitutions.length === 1 ? 'PASS' : 'MULTIPLE';
    emitUatTrace('INSTITUTION_LOOKUP_RESULT', { result: trace.institution });
    return trace;
  } catch {
    trace.identity = 'ERROR';
    emitUatTrace('IDENTITY_LOOKUP_RESULT', { result: trace.identity });
    return trace;
  }
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

      emitUatTrace('FIREBASE_UID_PRESENT', { value: true });
      emitUatTrace('UID_MATCH_CONFIGURED', { value: process.env.NEXUS_UAT_FIREBASE_UID ? decodedToken.uid === process.env.NEXUS_UAT_FIREBASE_UID : 'CONFIG_UNSET' });
      emitUatTrace('REQUIRE_AUTH_RESULT', { result: 'PASS' });
      const uatTrace = await traceInstitutionalChain(dependencies.pool, decodedToken.uid);
      if (uatTrace) res.setHeader('X-Nexus-Uat-Auth-Trace', traceHeader(uatTrace));

      const requestedInstitutionId = typeof req.headers['x-institution-id'] === 'string'
        ? req.headers['x-institution-id']
        : undefined;
      const resolution = dependencies.pool === pool && dependencies.resolveInstitutionalContext === resolveInstitutionalContext
        ? await resolveInstitutionalContext(pool, decodedToken.uid, requestedInstitutionId)
        : await dependencies.resolveInstitutionalContext(dependencies.pool, decodedToken.uid, requestedInstitutionId);

    if (uatTrace) {
      uatTrace.context = resolution.kind === 'resolved' ? 'PASS' : resolution.kind.toUpperCase();
      res.setHeader('X-Nexus-Uat-Auth-Trace', traceHeader(uatTrace));
    }
    emitUatTrace('INSTITUTIONAL_CONTEXT_RESULT', { result: resolution.kind === 'resolved' ? 'PASS' : resolution.kind.toUpperCase() });
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
