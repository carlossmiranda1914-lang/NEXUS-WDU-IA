import type { Express, RequestHandler, Response } from 'express';
import { eq, inArray } from 'drizzle-orm';
import { operationalLogs, students, teachers } from '../../db/schema.ts';
import type { AuthRequest } from '../../middleware/auth.ts';

export type LegacyStudentRouteDependencies = {
  db: any; pool: any; requireAuth: RequestHandler; authorizeRole: (allowedRoles: string[]) => RequestHandler;
  resolveAuthorizedLegacyStudentIds: (req: AuthRequest) => Promise<string[]>;
  scopeLegacyRecordsToInstitution: <T extends { id: string | number }>(req: AuthRequest, resourceType: string, records: T[]) => Promise<T[]>;
  resolveInstitutionOwnedResourceIds: (pool: any, context: NonNullable<AuthRequest['institutionalContext']>, resourceType: string) => Promise<string[]>;
  isInstitutionOwned: (resourceId: string, ownedResourceIds: string[]) => boolean;
  broadcastToAll: (type: string, payload: any) => void;
};

export function registerLegacyStudentRoutes(app: Express, dependencies: LegacyStudentRouteDependencies): void {
  const { db, pool, requireAuth, authorizeRole, resolveAuthorizedLegacyStudentIds, scopeLegacyRecordsToInstitution, resolveInstitutionOwnedResourceIds, isInstitutionOwned, broadcastToAll } = dependencies;
  app.get('/api/students', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const role = req.user?.dbRole; let records;
      const base = { id: students.id, name: students.name, class: students.class, attendanceRate: students.attendanceRate, status: students.status, outstandingFees: students.outstandingFees, guardiansName: students.guardiansName, guardiansContact: students.guardiansContact, documents: students.documents, createdAt: students.createdAt };
      const full = { ...base, averageGrade: students.averageGrade, behaviorDegree: students.behaviorDegree, behaviorHistory: students.behaviorHistory, grades: students.grades };
      if (role === 'student' || role === 'parent') { const ids = await resolveAuthorizedLegacyStudentIds(req); records = ids.length ? await db.select(full).from(students).where(inArray(students.id, ids)).orderBy(students.id) : []; }
      else if (role === 'teacher') { const profile = await db.select({ classes: teachers.classes }).from(teachers).where(eq(teachers.email, req.user.email)).limit(1); const classes = profile.length && Array.isArray(profile[0].classes) ? profile[0].classes as string[] : []; records = classes.length ? await db.select(full).from(students).where(inArray(students.class, classes)).orderBy(students.id) : []; }
      else if (role === 'financial') { const rows = await db.select(base).from(students).orderBy(students.id); records = rows.map((student: any) => ({ ...student, averageGrade: 0, grades: [], behaviorHistory: [], behaviorDegree: 'Excelente' })); }
      else records = await db.select(full).from(students).orderBy(students.id);
      res.json(await scopeLegacyRecordsToInstitution(req, 'student', records));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/students', requireAuth, authorizeRole(['admin', 'secretariat']), async (req: AuthRequest, res: Response) => {
    try {
      const { id, name, class: sClass, guardiansName, guardiansContact, outstandingFees, documents, behaviorHistory, grades } = req.body;
      if (!id) return res.status(410).json({ error: 'A criação de alunos é feita exclusivamente pelo fluxo de matrícula.' });
      const existing = await db.select().from(students).where(eq(students.id, id)).limit(1);
      if (!existing.length) return res.status(404).json({ error: 'Estudante não encontrado.' });
      const ownedIds = await resolveInstitutionOwnedResourceIds(pool, req.institutionalContext!, 'student');
      if (!isInstitutionOwned(id, ownedIds)) return res.status(404).json({ error: 'Estudante não encontrado.' });
      await db.update(students).set({ name: name || existing[0].name, class: sClass || existing[0].class, outstandingFees: outstandingFees !== undefined ? outstandingFees : existing[0].outstandingFees, guardiansName: guardiansName || existing[0].guardiansName, guardiansContact: guardiansContact || existing[0].guardiansContact, documents: documents || existing[0].documents, behaviorHistory: behaviorHistory || existing[0].behaviorHistory, grades: grades || existing[0].grades }).where(eq(students.id, id));
      await db.insert(operationalLogs).values({ userId: req.user.uid, userName: req.user.dbName, userRole: req.user.dbRole, action: 'STUDENT_UPDATE', details: `Perfil de ${id} (${name || existing[0].name}) foi atualizado.` });
      broadcastToAll('UPDATE_STUDENT', { id, fields: req.body }); broadcastToAll('NOTIFY', { title: 'Cadastro de Aluno Atualizado', message: `O perfil de \"${name || existing[0].name}\" (${id}) foi alterado pelo utilizador ${req.user.dbName}.`, alertType: 'info', category: 'student_updated' }); broadcastToAll('REFRESH_DATA', {});
      return res.json({ id, name: name || existing[0].name, class: sClass || existing[0].class, status: existing[0].status });
    } catch (err: any) { console.error(err); res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/students/:id', requireAuth, authorizeRole(['admin', 'secretariat', 'director']), async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params; const ownedIds = await resolveInstitutionOwnedResourceIds(pool, req.institutionalContext!, 'student');
      if (!isInstitutionOwned(id, ownedIds)) return res.status(404).json({ error: 'Estudante não encontrado para eliminação.' });
      const existing = await db.select().from(students).where(eq(students.id, id)).limit(1);
      if (!existing.length) return res.status(404).json({ error: 'Estudante não encontrado para eliminação.' });
      await db.delete(students).where(eq(students.id, id)); await db.insert(operationalLogs).values({ userId: req.user.uid, userName: req.user.dbName, userRole: req.user.dbRole, action: 'STUDENT_DELETE', details: `Estudante ${id} (${existing[0].name}) foi removido do sistema.` });
      broadcastToAll('NOTIFY', { title: 'Estudante Removido', message: `O perfil do estudante \"${existing[0].name}\" (${id}) foi removido pelo utilizador ${req.user.dbName}.`, alertType: 'warning', category: 'student_deleted' }); broadcastToAll('REFRESH_DATA', {});
      return res.json({ success: true, message: 'Estudante eliminado com sucesso.' });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/migration/execute', requireAuth, authorizeRole(['admin']), (_req: AuthRequest, res: Response) => res.status(410).json({ error: 'A criação de alunos é feita exclusivamente pelo fluxo de matrícula.' }));
}
