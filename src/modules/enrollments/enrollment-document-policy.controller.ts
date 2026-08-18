import type { Application, Response } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { EnrollmentDocumentPolicyPublicationError, publishEnrollmentDocumentPolicy } from './enrollment-document-policy-publication.ts';
import { EnrollmentDocumentPolicyAdminError, addRequirement, createDraft, getPolicy, listPolicies, removeRequirement, reorderRequirements, updateRequirement } from './enrollment-document-policy-admin.ts';

function reject(res: Response, status: number, error: string) { return res.status(status).json({ error }); }

export function registerEnrollmentDocumentPolicyRoutes(app: Application) {
  const context = (req: AuthRequest, res: Response) => { if (!req.institutionalContext) { reject(res,401,'Autenticação institucional necessária.'); return null; } return req.institutionalContext; };
  const adminError = (res: Response,error: unknown) => { if (error instanceof EnrollmentDocumentPolicyAdminError) return reject(res,error.code==='NOT_FOUND'?404:error.code==='FORBIDDEN'?403:error.code==='CONFLICT'||error.code==='IMMUTABLE'?409:400,error.message); console.error('[ENROLLMENT-DOCUMENT-POLICY] admin failed',error); return reject(res,500,'Não foi possível concluir a gestão da política documental.'); };
  app.get('/api/enrollment-document-policies',requireAuth,async(req:AuthRequest,res:Response)=>{const c=context(req,res);if(!c)return;try{return res.json(await listPolicies(pool,c,req.query.offerId));}catch(e){return adminError(res,e);}});
  app.get('/api/enrollment-document-policies/:id',requireAuth,async(req:AuthRequest,res:Response)=>{const c=context(req,res);if(!c)return;try{return res.json(await getPolicy(pool,c,req.params.id));}catch(e){return adminError(res,e);}});
  app.post('/api/enrollment-document-policies/drafts',requireAuth,async(req:AuthRequest,res:Response)=>{const c=context(req,res);if(!c)return;try{const result=await createDraft(pool,c,req.body?.offerId);return res.status(result.replayed?200:201).json(result);}catch(e){return adminError(res,e);}});
  app.post('/api/enrollment-document-policies/:id/requirements',requireAuth,async(req:AuthRequest,res:Response)=>{const c=context(req,res);if(!c)return;try{return res.status(201).json({requirement:await addRequirement(pool,c,req.params.id,req.body)});}catch(e){return adminError(res,e);}});
  app.patch('/api/enrollment-document-policies/:id/requirements/:requirementId',requireAuth,async(req:AuthRequest,res:Response)=>{const c=context(req,res);if(!c)return;try{return res.json({requirement:await updateRequirement(pool,c,req.params.id,req.params.requirementId,req.body)});}catch(e){return adminError(res,e);}});
  app.put('/api/enrollment-document-policies/:id/requirements/order',requireAuth,async(req:AuthRequest,res:Response)=>{const c=context(req,res);if(!c)return;try{await reorderRequirements(pool,c,req.params.id,req.body?.requirementIds);return res.status(204).end();}catch(e){return adminError(res,e);}});
  app.delete('/api/enrollment-document-policies/:id/requirements/:requirementId',requireAuth,async(req:AuthRequest,res:Response)=>{const c=context(req,res);if(!c)return;try{await removeRequirement(pool,c,req.params.id,req.params.requirementId);return res.status(204).end();}catch(e){return adminError(res,e);}});
  app.post('/api/enrollment-document-policies/:id/publish', requireAuth, async (req: AuthRequest, res: Response) => {
    if (!req.institutionalContext) return reject(res, 401, 'Autenticação institucional necessária.');
    try {
      const result = await publishEnrollmentDocumentPolicy(pool, req.institutionalContext, req.params.id);
      return res.json(result);
    } catch (error) {
      if (error instanceof EnrollmentDocumentPolicyPublicationError) {
        if (error.code === 'NOT_FOUND') return reject(res, 404, 'Política documental não encontrada.');
        if (error.code === 'FORBIDDEN') return reject(res, 403, error.message);
        return reject(res, error.code === 'CONFLICT' ? 409 : 400, error.message);
      }
      console.error('[ENROLLMENT-DOCUMENT-POLICY] publication failed', error);
      return reject(res, 500, 'Não foi possível publicar a política documental.');
    }
  });
}
