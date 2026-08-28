import type { Application, RequestHandler, Response } from 'express';
import { pool } from '../../db/index.ts';
import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { canManageAcademicYear } from '../enrollments/academic-year-policy.ts';
import { AcademicStructureError, closeAcademicClass, createAcademicClass, createAcademicSubject, offerAcademicSubject } from './academic-structure-api.ts';

function reject(res: Response,status:number,body:object) { return res.status(status).json(body); }
function actor(req:AuthRequest,res:Response) { const context=req.institutionalContext; if(!context) { reject(res,401,{error:'Autenticação institucional necessária.'}); return null; } if(!canManageAcademicYear(context.role)) { reject(res,403,{error:'O seu papel não pode gerir estrutura académica.'}); return null; } return context; }
function error(res:Response,cause:unknown) { if(cause instanceof AcademicStructureError) { if(cause.code==='STALE_VERSION') return reject(res,409,{code:'STALE_VERSION',message:'A estrutura académica foi alterada entretanto. Atualize os dados antes de tentar novamente.'}); if(cause.code==='NOT_FOUND') return reject(res,404,{error:'Recurso académico não encontrado nesta instituição.'}); return reject(res,cause.code==='CONFLICT'?409:400,{error:cause.message}); } console.error('[ACADEMIC] structure',cause); return reject(res,500,{error:'Não foi possível concluir a operação académica.'}); }

export function registerAcademicStructureRoutes(app:Application,dependencies:{pool?:typeof pool;requireAuth?:RequestHandler}={}) {
 const academicPool=dependencies.pool??pool, academicRequireAuth=dependencies.requireAuth??requireAuth;
 app.post('/api/academic/classes',academicRequireAuth,async(req:AuthRequest,res:Response)=>{const context=actor(req,res);if(!context)return;try{return res.status(201).json({academicClass:await createAcademicClass(academicPool,context,req.body??{})});}catch(cause){return error(res,cause);}});
 app.post('/api/academic/subjects',academicRequireAuth,async(req:AuthRequest,res:Response)=>{const context=actor(req,res);if(!context)return;try{return res.status(201).json({academicSubject:await createAcademicSubject(academicPool,context,req.body??{})});}catch(cause){return error(res,cause);}});
 app.post('/api/academic/subject-offerings',academicRequireAuth,async(req:AuthRequest,res:Response)=>{const context=actor(req,res);if(!context)return;try{return res.status(201).json({subjectOffering:await offerAcademicSubject(academicPool,context,req.body??{})});}catch(cause){return error(res,cause);}});
 app.post('/api/academic/classes/:id/close',academicRequireAuth,async(req:AuthRequest,res:Response)=>{const context=actor(req,res);if(!context)return;try{return res.json({academicClass:await closeAcademicClass(academicPool,context,{id:req.params.id,expectedVersion:req.body?.expectedVersion})});}catch(cause){return error(res,cause);}});
}
