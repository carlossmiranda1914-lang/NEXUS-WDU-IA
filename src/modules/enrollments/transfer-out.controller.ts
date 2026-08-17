import type { Application, Response } from 'express';
import { pool } from '../../db/index.ts'; import { requireAuth, type AuthRequest } from '../../middleware/auth.ts';
import { createTransferOut, listTransferOuts, TransferOutError, transitionTransferOut } from './transfer-out-api.ts';
const reject = (res: Response, status: number, error: string) => res.status(status).json({ error });
function failure(res: Response, error: unknown) { if (error instanceof TransferOutError) return reject(res, error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : error.code === 'CONFLICT' ? 409 : 400, error.message); console.error('[TRANSFER-OUT]', error); return reject(res, 500, 'Não foi possível concluir a transferência.'); }
export function registerTransferOutRoutes(app: Application) {
  app.get('/api/enrollments/:id/transfer-outs', requireAuth, async (req: AuthRequest,res: Response) => { if (!req.institutionalContext) return reject(res,401,'Autenticação institucional necessária.'); try { return res.json(await listTransferOuts(pool,req.institutionalContext,req.params.id)); } catch (error) { return failure(res,error); } });
  app.post('/api/enrollments/:id/transfer-out', requireAuth, async (req: AuthRequest,res: Response) => { if (!req.institutionalContext) return reject(res,401,'Autenticação institucional necessária.'); try { return res.status(201).json(await createTransferOut(pool,req.institutionalContext,{ enrollmentId:req.params.id,destinationName:req.body?.destinationName,reason:req.body?.reason })); } catch (error) { return failure(res,error); } });
  app.post('/api/transfer-outs/:id/transitions', requireAuth, async (req: AuthRequest,res: Response) => { if (!req.institutionalContext) return reject(res,401,'Autenticação institucional necessária.'); try { return res.json(await transitionTransferOut(pool,req.institutionalContext,req.params.id,req.body ?? {})); } catch (error) { return failure(res,error); } });
}
