import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: any; // DecodedIdToken with db user info attached
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[AUTH-MIDDLEWARE] Blocked request: Missing or malformed Authorization header:', req.path);
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  console.log(`[AUTH-MIDDLEWARE] Processing auth token for path: ${req.method} ${req.path}`);
  
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken || !decodedToken.uid) {
      console.error('[AUTH-MIDDLEWARE] Critical: Token could not be verified or has no UID.');
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }

    const email = decodedToken.email;
    if (!email) {
      console.error('[AUTH-MIDDLEWARE] Critical: Token does not contain an email address.');
      return res.status(401).json({ error: 'Unauthorized: Token must contain email' });
    }
    const name = decodedToken.name || email.split('@')[0] || 'Utilizador Nexus';
    
    console.log('[AUTH-MIDDLEWARE] A sincronizar perfil de utilizador com a base de dados.');
    
    const dbUser = await getOrCreateUser(decodedToken.uid, email, name);
    console.log('[AUTH] Token verificado para path:', req.path);
    
    if (!dbUser) {
      console.error('[AUTH-MIDDLEWARE] Failed to persist/fetch user profile in PostgreSQL.');
      return res.status(401).json({ error: 'Unauthorized: Failed to resolve database user profile' });
    }

    // Safety verification for suspended and pending user accounts (except profile page itself and access request endpoints)
    if (dbUser.status === 'suspended' && req.path !== '/api/profile') {
      console.warn(`[AUTH-MIDDLEWARE] Access blocked: Account is suspended for user=${dbUser.email}`);
      return res.status(403).json({ error: 'Conta Suspensa: O acesso aos recursos foi temporariamente bloqueado pela direção.' });
    }

    if (dbUser.status === 'unverified_email' && req.path !== '/api/profile') {
      console.warn(`[AUTH-MIDDLEWARE] Access blocked: Email is unverified for user=${dbUser.email}`);
      return res.status(403).json({ error: 'E-mail Não Confirmado: Por favor, confirme o seu endereço de email usando o código enviado para aceder ao sistema.' });
    }

    if (dbUser.status === 'pending' && req.path !== '/api/profile' && req.path !== '/api/profile/request-access') {
      console.warn(`[AUTH-MIDDLEWARE] Access blocked: Account is pending for user=${dbUser.email}`);
      return res.status(403).json({ error: 'Acesso Pendente: A sua conta está sob validação do administrador. Por favor, aguarde.' });
    }

    // Attach both firebase payload and database user profile
    req.user = {
      ...decodedToken,
      dbId: dbUser.id,
      dbRole: dbUser.role,
      dbName: dbUser.name,
      dbStatus: dbUser.status
    };
    
    console.log(`[AUTH-MIDDLEWARE] Authorization successful for role=${req.user.dbRole}`);
    next();
  } catch (error: any) {
    console.warn('[AUTH-MIDDLEWARE] Authentication error:', error.message || error);
    return res.status(401).json({ error: `Unauthorized: ${error.message || String(error)}` });
  }
};
