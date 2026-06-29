import { Application, Response, Request } from 'express';
import { SchoolTaskService } from './school-task.service.ts';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { multiTenantMiddleware, TenantRequest } from '../../middleware/multi-tenant.ts';
import { db } from '../../db/index.ts';
import { operationalLogs } from '../../db/schema.ts';
import crypto from 'crypto';

// Reusable configurations
const BACKUP_SECRET = process.env.BACKUP_SECRET_KEY || 'school-tasks-nexus-backup-secret-key-2026';
const TASK_ROLES = ['admin', 'director', 'secretariat', 'financial', 'teacher', 'operator', 'system', 'ai_system'];

// Utility mapping helpers
function isTaskRole(role: string): boolean {
  return TASK_ROLES.includes(role);
}

function hasPermission(role: string, action: string): boolean {
  if (role === 'admin') return true;

  switch (action) {
    case 'view_metrics':
      return ['director', 'secretariat', 'financial', 'teacher', 'system', 'ai_system'].includes(role);
    case 'view_archived':
      return ['director', 'secretariat'].includes(role);
    case 'create_task':
      return ['director', 'secretariat', 'teacher', 'financial', 'system', 'ai_system'].includes(role);
    case 'edit_task':
      return ['director', 'secretariat', 'teacher', 'financial', 'system', 'ai_system'].includes(role);
    case 'update_status':
      return ['director', 'secretariat', 'teacher', 'financial', 'operator', 'system', 'ai_system'].includes(role);
    case 'delete_task':
      return ['director', 'secretariat'].includes(role);
    case 'restore_task':
      return ['director', 'secretariat'].includes(role);
    default:
      return false;
  }
}

// Rigorous input validation rules for School Tasks
function validateTaskInput(body: any, isUpdate: boolean = false) {
  const errors: string[] = [];

  if (!isUpdate) {
    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push('O campo "title" é obrigatório e deve ser uma string não vazia.');
    }
    if (!body.description || typeof body.description !== 'string' || body.description.trim().length === 0) {
      errors.push('O campo "description" é obrigatório e deve ser uma string não vazia.');
    }
  }

  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      errors.push('O campo "title" deve ser uma string.');
    } else if (body.title.length > 150) {
      errors.push('O campo "title" é excessivamente longo (máximo 150 caracteres).');
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('O campo "description" deve ser uma string.');
    } else if (body.description.length > 2000) {
      errors.push('O campo "description" é excessivamente longo (máximo 2000 caracteres).');
    }
  }

  if (body.observations !== undefined && body.observations !== null) {
    if (typeof body.observations !== 'string') {
      errors.push('O campo "observations" deve ser uma string.');
    } else if (body.observations.length > 2000) {
      errors.push('O campo "observations" é excessivamente longo (máximo 2000 caracteres).');
    }
  }

  const validStatuses = ['Pendente', 'Em Curso', 'Concluída', 'Aguardando Aprovação', 'Cancelada', 'Atrasada'];
  if (body.status !== undefined) {
    if (!validStatuses.includes(body.status)) {
      errors.push(`O valor do estado "${body.status}" é inválido. Valores aceites: ${validStatuses.join(', ')}.`);
    }
  }

  const validPriorities = ['Baixa', 'Normal', 'Alta', 'Urgente'];
  if (body.priority !== undefined) {
    if (!validPriorities.includes(body.priority)) {
      errors.push(`O valor da prioridade "${body.priority}" é inválido. Valores aceites: ${validPriorities.join(', ')}.`);
    }
  }

  const validDepartments = ['Secretaria', 'Financeiro', 'Pedagógico', 'Direção', 'TI', 'Recursos Humanos', 'Biblioteca', 'Comunicação', 'Outro', 'Outros'];
  if (body.department !== undefined) {
    if (!validDepartments.includes(body.department)) {
      errors.push(`O valor do departamento "${body.department}" é inválido. Valores aceites: ${validDepartments.join(', ')}.`);
    }
  }

  if (body.dependencies !== undefined && body.dependencies !== null) {
    if (!Array.isArray(body.dependencies)) {
      errors.push('O campo "dependencies" deve ser um array de identificadores de tarefas (strings).');
    } else {
      for (const dep of body.dependencies) {
        if (typeof dep !== 'string' || dep.length > 30) {
          errors.push('Cada dependência no array deve ser uma string identificadora de tarefa válida.');
          break;
        }
      }
    }
  }

  if (body.attachments !== undefined && body.attachments !== null) {
    if (!Array.isArray(body.attachments)) {
      errors.push('O campo "attachments" deve ser um array de ficheiros.');
    } else {
      for (const attachment of body.attachments) {
        if (typeof attachment !== 'object' || attachment === null) {
          errors.push('Cada anexo deve ser um objecto válido.');
          break;
        }
        if (typeof attachment.name !== 'string' || attachment.name.length > 150) {
          errors.push('O nome do anexo deve ser uma string válida de até 150 caracteres.');
          break;
        }
        if (typeof attachment.url !== 'string' || attachment.url.length > 1000) {
          errors.push('A URL do anexo deve ser uma string válida de até 1000 caracteres.');
          break;
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Cryptographic Backup signature validation
function generateBackupSignature(tasks: any[]): string {
  const dataStr = JSON.stringify(tasks);
  return crypto.createHmac('sha256', BACKUP_SECRET).update(dataStr).digest('hex');
}

function verifyBackupSignature(tasks: any[], signature: string): boolean {
  const computed = generateBackupSignature(tasks);
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'));
  } catch (e) {
    return false;
  }
}

// Simple in-memory rate limiting store
const rateLimitsStore = new Map<string, { count: number; resetTime: number }>();

const rateLimiter = (category: 'leitura' | 'escrita' | 'analytics' | 'health', limit: number, windowMs: number = 60000) => {
  return (req: Request, res: Response, next: any) => {
    const authReq = req as TenantRequest;
    const userId = authReq.user?.uid || authReq.ip || 'anonymous';
    const key = `${userId}:${category}`;
    const now = Date.now();

    const record = rateLimitsStore.get(key);
    if (!record || now > record.resetTime) {
      rateLimitsStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    record.count++;
    if (record.count > limit) {
      return res.status(429).json({
        error: `Muitas requisições (Rate Limit atingido para ${category}). Aguarde o reset da janela de tempo.`
      });
    }
    next();
  };
};

// Middlewares
const authorizeTaskRole = () => {
  return async (req: Request, res: Response, next: any) => {
    const authReq = req as TenantRequest;
    const role = authReq.user?.dbRole;
    if (!role || !isTaskRole(role)) {
      try {
        await db.insert(operationalLogs).values({
          userId: authReq.user?.uid || 'anonymous',
          userName: authReq.user?.dbName || 'Desconhecido',
          userRole: role,
          action: 'TASK_ACCESS_DENIED',
          details: `[ACESSO RECUSADO] Perfil '${role}' não autorizado a acessar módulo de tarefas escolares no endpoint ${req.method} ${req.path}`
        });
      } catch (e) {
        console.error('Erro ao registrar log TASK_ACCESS_DENIED:', e);
      }
      return res.status(403).json({
        error: `Acesso Negado: O seu perfil de utilizador '${role}' não possui privilégios para aceder ao módulo de tarefas escolares.`
      });
    }
    next();
  };
};

const authorizeTaskAction = (action: 'create_task' | 'edit_task' | 'update_status' | 'delete_task' | 'restore_task' | 'view_metrics' | 'view_archived') => {
  return async (req: Request, res: Response, next: any) => {
    const authReq = req as TenantRequest;
    const role = authReq.user?.dbRole;
    if (!role || !isTaskRole(role)) {
      try {
        await db.insert(operationalLogs).values({
          userId: authReq.user?.uid || 'anonymous',
          userName: authReq.user?.dbName || 'Desconhecido',
          userRole: role,
          action: 'TASK_ACCESS_DENIED',
          details: `[ACESSO RECUSADO] Perfil '${role}' não autorizado a aceder ao endpoint ${req.method} ${req.path}`
        });
      } catch (e) {
        console.error('Erro ao registrar log:', e);
      }
      return res.status(403).json({
        error: `Acesso Negado: O seu perfil de utilizador '${role}' não possui privilégios para aceder ao módulo de tarefas escolares.`
      });
    }

    if (!hasPermission(role, action)) {
      try {
        await db.insert(operationalLogs).values({
          userId: authReq.user?.uid || 'anonymous',
          userName: authReq.user?.dbName || 'Desconhecido',
          userRole: role,
          action: 'TASK_PERMISSION_VIOLATION',
          details: `[VIOLAÇÃO PERMISSÃO] Perfil '${role}' não tem permissão para a ação '${action}' no endpoint ${req.method} ${req.path}`
        });
      } catch (e) {
        console.error('Erro ao registrar log TASK_PERMISSION_VIOLATION:', e);
      }
      return res.status(403).json({
        error: `Acesso Proibido: O seu perfil de utilizador '${role}' não possui permissão para executar a ação '${action}'.`
      });
    }

    next();
  };
};

/**
 * Register Enterprise school task routes in Express
 */
export function registerSchoolTaskRoutes(app: Application) {
  // Global Request context headers middleware for school-tasks
  app.use('/api/school-tasks', (req: Request, res: Response, next: any) => {
    const authReq = req as TenantRequest;
    const reqId = req.headers['x-request-id'] as string || `req-${Math.floor(100000 + Math.random() * 900000)}`;
    const correlationId = req.headers['x-correlation-id'] as string || `corr-${Math.floor(100000 + Math.random() * 900000)}`;

    res.setHeader('X-Request-ID', reqId);
    res.setHeader('X-Correlation-ID', correlationId);

    authReq.headers['x-request-id'] = reqId;
    authReq.headers['x-correlation-id'] = correlationId;
    next();
  });

  // 1. Overall Metrics
  app.get('/api/school-tasks/metrics', requireAuth, multiTenantMiddleware, authorizeTaskAction('view_metrics'), rateLimiter('analytics', 20), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    try {
      const metrics = await SchoolTaskService.getMetrics(authReq.tenantId!);
      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Productivity Analytics
  app.get('/api/school-tasks/analytics/productivity', requireAuth, multiTenantMiddleware, authorizeTaskAction('view_metrics'), rateLimiter('analytics', 20), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    try {
      const prod = await SchoolTaskService.getProductivity(authReq.tenantId!);
      res.json(prod);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Department Analytics
  app.get('/api/school-tasks/analytics/departments', requireAuth, multiTenantMiddleware, authorizeTaskAction('view_metrics'), rateLimiter('analytics', 20), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    try {
      const dept = await SchoolTaskService.getDepartmentAnalytics(authReq.tenantId!);
      res.json(dept);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. SLA & Health Telemetry
  app.get('/api/school-tasks/health', requireAuth, multiTenantMiddleware, authorizeTaskAction('view_metrics'), rateLimiter('health', 10), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    try {
      const health = await SchoolTaskService.getHealth(authReq.tenantId!);
      res.json(health);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Exporter (CSV, Excel, PDF, JSON)
  app.get('/api/school-tasks/export', requireAuth, multiTenantMiddleware, rateLimiter('analytics', 20), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    const role = authReq.user?.dbRole;
    if (role !== 'admin' && role !== 'director') {
      try {
        await db.insert(operationalLogs).values({
          userId: authReq.user?.uid || 'anonymous',
          userName: authReq.user?.dbName || 'Desconhecido',
          userRole: role,
          action: 'TASK_PERMISSION_VIOLATION',
          details: `[ACESSO NEGADO RECOVERY] Perfil '${role}' tentou exportar dados de tarefas.`
        });
      } catch (e) {
        console.error('Erro ao registar log de segurança:', e);
      }
      return res.status(403).json({ error: 'Acesso Proibido: Apenas Super Admin e Direção podem exportar backups de tarefas.' });
    }

    try {
      const format = String(req.query.format || 'json');
      const filter = {
        status: req.query.status ? String(req.query.status) : undefined,
        department: req.query.department ? String(req.query.department) : undefined,
        priority: req.query.priority ? String(req.query.priority) : undefined,
      };

      const { data, mimeType, filename } = await SchoolTaskService.exportTasks(authReq.tenantId!, filter, format);
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Backup Restorer (Import)
  app.post('/api/school-tasks/import-backup', requireAuth, multiTenantMiddleware, rateLimiter('escrita', 10), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    const role = authReq.user?.dbRole;
    if (role !== 'admin' && role !== 'director') {
      return res.status(403).json({ error: 'Acesso Proibido: Apenas Super Admin e Direção podem restaurar backups no sistema.' });
    }

    const { tasks, checksum } = req.body;
    if (!tasks || !Array.isArray(tasks) || !checksum) {
      return res.status(400).json({ error: 'Formato de payload inválido. É obrigatório fornecer o array "tasks" e o "checksum".' });
    }

    // Cryptographic Signature Validation
    if (!verifyBackupSignature(tasks, checksum)) {
      try {
        await db.insert(operationalLogs).values({
          userId: authReq.user?.uid || 'anonymous',
          userName: authReq.user?.dbName || 'Desconhecido',
          userRole: role,
          action: 'TASK_SECURITY_ALERT',
          details: `[ALERT_RESTORE_FAILED] Tentativa de restauro de backup com assinatura digital inválida.`
        });
      } catch (e) {
        console.error('Erro ao registar log de segurança:', e);
      }
      return res.status(400).json({ error: 'Restauração abortada: A assinatura digital de integridade do backup não corresponde.' });
    }

    // Verify task definitions inside backup
    for (const task of tasks) {
      const check = validateTaskInput(task, false);
      if (!check.isValid) {
        return res.status(400).json({ error: 'O arquivo de backup contém registros que violam as regras de validação atuais.', details: check.errors });
      }
    }

    try {
      const count = await SchoolTaskService.importBackup(tasks, authReq.tenantId!, authReq.schoolId!, authReq.organizationId!, authReq.user?.dbName || 'Admin');
      
      await db.insert(operationalLogs).values({
        userId: authReq.user?.uid || 'anonymous',
        userName: authReq.user?.dbName || 'Admin',
        userRole: role,
        action: 'DISASTER_RECOVERY_RESTORE',
        details: `Restauração lógica bem-sucedida de ${count} tarefas sob o tenant ${authReq.tenantId!}.`
      });

      res.json({ success: true, message: 'Backup restaurado com sucesso.', count });
    } catch (err: any) {
      res.status(500).json({ error: `Falha na restauração do backup: ${err.message}` });
    }
  });

  // 7. List Tasks with pagination, filters and Full-Text Search
  app.get('/api/school-tasks', requireAuth, multiTenantMiddleware, authorizeTaskRole(), rateLimiter('leitura', 100), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    try {
      const filter = {
        status: req.query.status ? String(req.query.status) : undefined,
        department: req.query.department ? String(req.query.department) : undefined,
        assignedTo: req.query.assignedTo ? String(req.query.assignedTo) : undefined,
        priority: req.query.priority ? String(req.query.priority) : undefined,
        dueDate: req.query.dueDate ? String(req.query.dueDate) : undefined,
        createdBy: req.query.createdBy ? String(req.query.createdBy) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        page: req.query.page ? parseInt(String(req.query.page)) : 1,
        limit: req.query.limit ? parseInt(String(req.query.limit)) : 10,
      };

      const tasks = await SchoolTaskService.getTasks(authReq.tenantId!, filter);
      res.json(tasks);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Count of matching tasks
  app.get('/api/school-tasks/count', requireAuth, multiTenantMiddleware, authorizeTaskRole(), rateLimiter('leitura', 100), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    try {
      const filter = {
        status: req.query.status ? String(req.query.status) : undefined,
        department: req.query.department ? String(req.query.department) : undefined,
        assignedTo: req.query.assignedTo ? String(req.query.assignedTo) : undefined,
        priority: req.query.priority ? String(req.query.priority) : undefined,
        dueDate: req.query.dueDate ? String(req.query.dueDate) : undefined,
        createdBy: req.query.createdBy ? String(req.query.createdBy) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
      };

      const count = await SchoolTaskService.getTasksCount(authReq.tenantId!, filter);
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Archived / Deleted tasks
  app.get('/api/school-tasks/deleted', requireAuth, multiTenantMiddleware, authorizeTaskAction('view_archived'), rateLimiter('leitura', 100), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    try {
      const tasks = await SchoolTaskService.getDeletedTasks(authReq.tenantId!);
      res.json(tasks);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Individual Task Details
  app.get('/api/school-tasks/:id', requireAuth, multiTenantMiddleware, authorizeTaskRole(), rateLimiter('leitura', 100), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    try {
      const task = await SchoolTaskService.getTaskById(req.params.id, authReq.tenantId!);
      if (!task) {
        return res.status(404).json({ error: 'Tarefa não encontrada ou não pertence ao seu Tenant.' });
      }
      res.json(task);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. Create Task
  app.post('/api/school-tasks', requireAuth, multiTenantMiddleware, authorizeTaskAction('create_task'), rateLimiter('escrita', 30), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    const body = authReq.body;

    const validation = validateTaskInput(body, false);
    if (!validation.isValid) {
      try {
        await db.insert(operationalLogs).values({
          userId: authReq.user?.uid || 'anonymous',
          userName: authReq.user?.dbName || 'Desconhecido',
          userRole: authReq.user?.dbRole || 'unassigned',
          action: 'TASK_SECURITY_ALERT',
          details: `[INPUT_VALIDATION_FAILED] Erros: ${validation.errors.join(' | ')}`
        });
      } catch (logErr) {
        console.error('Erro ao registar log:', logErr);
      }
      return res.status(400).json({ error: 'Payload de entrada inválido.', details: validation.errors });
    }

    try {
      const newId = body.id || `TSK-${Math.floor(2000 + Math.random() * 8000)}`;
      const metadata = {
        userId: authReq.user?.uid || 'system',
        userName: authReq.user?.dbName || 'Nexus Copilot IA',
        requestId: res.getHeader('X-Request-ID'),
        correlationId: res.getHeader('X-Correlation-ID'),
        ipAddress: authReq.ip,
        userAgent: authReq.headers['user-agent']
      };

      const taskData = {
        ...body,
        id: newId,
        createdBy: authReq.user?.dbName || 'Nexus Copilot IA'
      };

      const task = await SchoolTaskService.createTask(taskData, authReq.tenantId!, authReq.schoolId!, authReq.organizationId!, authReq.user?.dbName || 'Admin', metadata);
      res.status(201).json(task);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. Update Task
  app.put('/api/school-tasks/:id', requireAuth, multiTenantMiddleware, rateLimiter('escrita', 30), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    const { id } = req.params;
    const body = authReq.body;

    const role = authReq.user?.dbRole;
    if (!role || !isTaskRole(role)) {
      return res.status(403).json({ error: 'Acesso Negado: Perfil sem privilégios para tarefas.' });
    }

    const hasOtherFields = body.priority !== undefined ||
                           body.title !== undefined ||
                           body.description !== undefined ||
                           body.dueDate !== undefined ||
                           body.limitDate !== undefined ||
                           body.assignedTo !== undefined ||
                           body.department !== undefined ||
                           body.dependencies !== undefined;

    const requiredAction = hasOtherFields ? 'edit_task' : 'update_status';

    if (!hasPermission(role, requiredAction)) {
      return res.status(403).json({ error: `Acesso Proibido: Perfil sem permissão para executar a ação ${requiredAction}.` });
    }

    const validation = validateTaskInput(body, true);
    if (!validation.isValid) {
      return res.status(400).json({ error: 'Payload de atualização inválido.', details: validation.errors });
    }

    try {
      const metadata = {
        userId: authReq.user?.uid || 'system',
        userName: authReq.user?.dbName || 'Nexus Copilot IA',
        requestId: res.getHeader('X-Request-ID'),
        correlationId: res.getHeader('X-Correlation-ID'),
        ipAddress: authReq.ip,
        userAgent: authReq.headers['user-agent']
      };

      const task = await SchoolTaskService.updateTask(id, body, authReq.tenantId!, authReq.user?.dbName || 'Admin', metadata);
      res.json(task);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 13. Delete Task (Archiving)
  app.delete('/api/school-tasks/:id', requireAuth, multiTenantMiddleware, authorizeTaskAction('delete_task'), rateLimiter('escrita', 30), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    const { id } = req.params;

    try {
      const metadata = {
        userId: authReq.user?.uid || 'system',
        userName: authReq.user?.dbName || 'Nexus Copilot IA',
        requestId: res.getHeader('X-Request-ID'),
        correlationId: res.getHeader('X-Correlation-ID')
      };

      const success = await SchoolTaskService.deleteTask(id, authReq.tenantId!, authReq.user?.dbName || 'Admin', metadata);
      if (!success) {
        return res.status(404).json({ error: 'Tarefa não encontrada ou não pertence ao seu Tenant.' });
      }
      res.json({ success: true, message: 'Tarefa escolar enviada para a lixeira/arquivo com sucesso.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 14. Restore Task
  app.post('/api/school-tasks/:id/restore', requireAuth, multiTenantMiddleware, authorizeTaskAction('restore_task'), rateLimiter('escrita', 30), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    const { id } = req.params;

    try {
      const metadata = {
        userId: authReq.user?.uid || 'system',
        userName: authReq.user?.dbName || 'Nexus Copilot IA',
        requestId: res.getHeader('X-Request-ID'),
        correlationId: res.getHeader('X-Correlation-ID')
      };

      const task = await SchoolTaskService.restoreTask(id, authReq.tenantId!, authReq.user?.dbName || 'Admin', metadata);
      if (!task) {
        return res.status(404).json({ error: 'Tarefa não encontrada para restauração.' });
      }
      res.json({ success: true, message: 'Tarefa escolar restaurada com sucesso.', task });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15. Dependency Cascading Impact
  app.get('/api/school-tasks/:id/dependency-impact', requireAuth, multiTenantMiddleware, rateLimiter('leitura', 100), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    try {
      const impact = await SchoolTaskService.getDependencyImpact(req.params.id, authReq.tenantId!);
      res.json(impact);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 16. Snapshot Timeline Audit Logs
  app.get('/api/school-tasks/:id/timeline', requireAuth, multiTenantMiddleware, authorizeTaskRole(), rateLimiter('leitura', 100), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    try {
      const timeline = await SchoolTaskService.getTimeline(req.params.id, authReq.tenantId!);
      res.json(timeline);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 17. Rollback task version to snapshot
  app.post('/api/school-tasks/:id/rollback', requireAuth, multiTenantMiddleware, authorizeTaskAction('edit_task'), rateLimiter('escrita', 30), async (req: Request, res: Response) => {
    const authReq = req as TenantRequest;
    const { id } = req.params;
    const { version } = req.body;

    if (version === undefined || typeof version !== 'number') {
      return res.status(400).json({ error: 'É obrigatório fornecer o número da versão para efetuar o rollback.' });
    }

    try {
      const metadata = {
        userId: authReq.user?.uid || 'system',
        userName: authReq.user?.dbName || 'Nexus Copilot IA',
        requestId: res.getHeader('X-Request-ID'),
        correlationId: res.getHeader('X-Correlation-ID')
      };

      const task = await SchoolTaskService.rollbackTask(id, version, authReq.tenantId!, authReq.user?.dbName || 'Admin', metadata);
      res.json({ success: true, message: `Tarefa revertida com sucesso para a Versão ${version}.`, task });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
