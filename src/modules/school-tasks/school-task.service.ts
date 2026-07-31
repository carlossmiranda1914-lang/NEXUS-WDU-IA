import { SchoolTaskRepository, TaskFilter } from './school-task.repository.ts';
import { SchoolTaskCache } from './cache-manager.ts';
import { eventBus, TaskEventName } from './event-bus.ts';
import { db, inMemoryDb } from '../../db/index.ts';
import { schoolTasks } from '../../db/schema.ts';
import { and, eq, sql, ne } from 'drizzle-orm';

export class SchoolTaskService {
  /**
   * Automatically invalidate tenant cache on CRUD changes
   */
  static registerCacheEvictors(): void {
    const eventsToEvict: TaskEventName[] = [
      'TaskCreated',
      'TaskUpdated',
      'TaskDeleted',
      'TaskCompleted',
      'TaskRestored',
      'TaskArchived',
      'TaskDependencyChanged',
      'TaskSlaBreached',
      'TaskAssigned'
    ];

    for (const event of eventsToEvict) {
      eventBus.subscribe(event, async (payload) => {
        await SchoolTaskCache.invalidate(payload.tenantId);
      });
    }
  }

  /**
   * Get overall metrics with multi-tenant filtration and automatic caching
   */
  static async getMetrics(tenantId: string): Promise<any> {
    const cached = await SchoolTaskCache.get(tenantId, 'metrics');
    if (cached) return cached;

    const todayStr = new Date().toISOString().split('T')[0];

    let result: any;
    if (!process.env.SQL_HOST) {
      // High-fidelity fallback emulation
      const tasks = inMemoryDb.school_tasks.filter(t => t.tenantId === tenantId);
      const active = tasks.filter(t => !t.isDeleted);

      const total = active.length;
      const pending = active.filter(t => t.status === 'Pendente').length;
      const inProgress = active.filter(t => t.status === 'Em Curso').length;
      const completed = active.filter(t => t.status === 'Concluída').length;
      const overdue = active.filter(t => t.status !== 'Concluída' && t.limitDate < todayStr).length;
      const archived = tasks.filter(t => t.isDeleted).length;

      const byDepartment: Record<string, any> = {};
      for (const t of active) {
        const dept = t.department || 'Outro';
        if (!byDepartment[dept]) {
          byDepartment[dept] = { total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0 };
        }
        byDepartment[dept].total++;
        if (t.status === 'Pendente') byDepartment[dept].pending++;
        else if (t.status === 'Em Curso') byDepartment[dept].inProgress++;
        else if (t.status === 'Concluída') byDepartment[dept].completed++;
        if (t.status !== 'Concluída' && t.limitDate < todayStr) byDepartment[dept].overdue++;
      }

      result = {
        totalTasks: total,
        pendingTasks: pending,
        inProgressTasks: inProgress,
        completedTasks: completed,
        overdueTasks: overdue,
        archivedTasks: archived,
        byDepartment
      };
    } else {
      // Highly optimized single-query database execution
      const statsResult = await db.select({
        total: sql<number>`count(*) filter (where not is_deleted)`,
        pending: sql<number>`count(*) filter (where not is_deleted and status = 'Pendente')`,
        inProgress: sql<number>`count(*) filter (where not is_deleted and status = 'Em Curso')`,
        completed: sql<number>`count(*) filter (where not is_deleted and status = 'Concluída')`,
        overdue: sql<number>`count(*) filter (where not is_deleted and status <> 'Concluída' and limit_date < ${todayStr})`,
        archived: sql<number>`count(*) filter (where is_deleted)`
      })
      .from(schoolTasks)
      .where(eq(schoolTasks.tenantId, tenantId));

      const stats = statsResult[0] || { total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0, archived: 0 };

      const deptStatsResult = await db.select({
        department: schoolTasks.department,
        total: sql<number>`count(*) filter (where not is_deleted)`,
        pending: sql<number>`count(*) filter (where not is_deleted and status = 'Pendente')`,
        inProgress: sql<number>`count(*) filter (where not is_deleted and status = 'Em Curso')`,
        completed: sql<number>`count(*) filter (where not is_deleted and status = 'Concluída')`,
        overdue: sql<number>`count(*) filter (where not is_deleted and status <> 'Concluída' and limit_date < ${todayStr})`
      })
      .from(schoolTasks)
      .where(eq(schoolTasks.tenantId, tenantId))
      .groupBy(schoolTasks.department);

      const byDepartment: Record<string, any> = {};
      for (const row of deptStatsResult) {
        const dept = row.department || 'Outro';
        byDepartment[dept] = {
          total: Number(row.total || 0),
          pending: Number(row.pending || 0),
          inProgress: Number(row.inProgress || 0),
          completed: Number(row.completed || 0),
          overdue: Number(row.overdue || 0)
        };
      }

      result = {
        totalTasks: Number(stats.total || 0),
        pendingTasks: Number(stats.pending || 0),
        inProgressTasks: Number(stats.inProgress || 0),
        completedTasks: Number(stats.completed || 0),
        overdueTasks: Number(stats.overdue || 0),
        archivedTasks: Number(stats.archived || 0),
        byDepartment
      };
    }

    await SchoolTaskCache.set(tenantId, 'metrics', result, 60); // Cache for 1 minute
    return result;
  }

  /**
   * Get team productivity metrics with multi-tenant filtering and caching
   */
  static async getProductivity(tenantId: string): Promise<any> {
    const cached = await SchoolTaskCache.get(tenantId, 'productivity');
    if (cached) return cached;

    const todayStr = new Date().toISOString().split('T')[0];
    let result: any;

    if (!process.env.SQL_HOST) {
      // In-memory fallback
      const tasks = inMemoryDb.school_tasks.filter(t => t.tenantId === tenantId && !t.isDeleted);
      const completed = tasks.filter(t => t.status === 'Concluída');

      let totalHours = 0;
      for (const t of completed) {
        const start = new Date(t.createdAt).getTime();
        const end = t.completedAt ? new Date(t.completedAt).getTime() : start;
        totalHours += Math.max(0, (end - start) / 3600000);
      }
      const avgHours = completed.length > 0 ? totalHours / completed.length : 0;

      const completedByUser: Record<string, number> = {};
      for (const t of completed) {
        const user = t.completedBy || 'Sistema / IA';
        completedByUser[user] = (completedByUser[user] || 0) + 1;
      }

      const overdue = tasks.filter(t => t.status !== 'Concluída' && t.limitDate < todayStr).length;

      const slaComplianceRate = tasks.length > 0
        ? parseFloat(((tasks.filter(t => t.slaStatus !== 'Breached').length / tasks.length) * 100).toFixed(2))
        : 100;

      result = {
        averageCompletionTimeHours: parseFloat(avgHours.toFixed(2)),
        completedByUser,
        overdueTasks: overdue,
        slaComplianceRate
      };
    } else {
      // Postgres SQL
      const avgTimeResult = await db.select({
        avgHours: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600), 0)`
      })
      .from(schoolTasks)
      .where(and(eq(schoolTasks.tenantId, tenantId), eq(schoolTasks.isDeleted, false), eq(schoolTasks.status, 'Concluída')));

      const completedByUserResult = await db.select({
        user: schoolTasks.completedBy,
        count: sql<number>`count(*)`
      })
      .from(schoolTasks)
      .where(and(eq(schoolTasks.tenantId, tenantId), eq(schoolTasks.isDeleted, false), eq(schoolTasks.status, 'Concluída')))
      .groupBy(schoolTasks.completedBy);

      const completedByUser: Record<string, number> = {};
      for (const row of completedByUserResult) {
        const user = row.user || 'Sistema / IA';
        completedByUser[user] = (completedByUser[user] || 0) + Number(row.count);
      }

      const overdueResult = await db.select({
        count: sql<number>`count(*)`
      })
      .from(schoolTasks)
      .where(and(
        eq(schoolTasks.tenantId, tenantId),
        eq(schoolTasks.isDeleted, false),
        ne(schoolTasks.status, 'Concluída'),
        sql`limit_date < ${todayStr}`
      ));

      const slaStatsResult = await db.select({
        total: sql<number>`count(*)`,
        onTrackOrWarning: sql<number>`count(*) filter (where sla_status <> 'Breached')`
      })
      .from(schoolTasks)
      .where(and(eq(schoolTasks.tenantId, tenantId), eq(schoolTasks.isDeleted, false)));

      const totalSla = Number(slaStatsResult[0]?.total || 0);
      const onTrackOrWarning = Number(slaStatsResult[0]?.onTrackOrWarning || 0);
      const slaComplianceRate = totalSla > 0
        ? parseFloat(((onTrackOrWarning / totalSla) * 100).toFixed(2))
        : 100;

      result = {
        averageCompletionTimeHours: parseFloat(Number(avgTimeResult[0]?.avgHours || 0).toFixed(2)),
        completedByUser,
        overdueTasks: Number(overdueResult[0]?.count || 0),
        slaComplianceRate
      };
    }

    await SchoolTaskCache.set(tenantId, 'productivity', result, 60);
    return result;
  }

  /**
   * Get department productivity analytics with multi-tenant caching
   */
  static async getDepartmentAnalytics(tenantId: string): Promise<any> {
    const cached = await SchoolTaskCache.get(tenantId, 'departments');
    if (cached) return cached;

    let result: any;
    if (!process.env.SQL_HOST) {
      // In-memory fallback
      const tasks = inMemoryDb.school_tasks.filter(t => t.tenantId === tenantId && !t.isDeleted);
      const byDept: Record<string, any> = {};

      for (const t of tasks) {
        const d = t.department || 'Outro';
        if (!byDept[d]) {
          byDept[d] = { total: 0, completed: 0, onTrack: 0, totalHours: 0 };
        }
        byDept[d].total++;
        if (t.status === 'Concluída') {
          byDept[d].completed++;
          const start = new Date(t.createdAt).getTime();
          const end = t.completedAt ? new Date(t.completedAt).getTime() : start;
          byDept[d].totalHours += Math.max(0, (end - start) / 3600000);
        }
        if (t.slaStatus !== 'Breached') {
          byDept[d].onTrack++;
        }
      }

      const formatted: Record<string, any> = {};
      for (const d of Object.keys(byDept)) {
        const item = byDept[d];
        formatted[d] = {
          completedTasks: item.completed,
          averageCompletionTimeHours: parseFloat((item.completed > 0 ? item.totalHours / item.completed : 0).toFixed(2)),
          slaComplianceRate: item.total > 0 ? parseFloat(((item.onTrack / item.total) * 100).toFixed(2)) : 100
        };
      }

      result = { byDepartment: formatted };
    } else {
      const deptAnalyticsResult = await db.select({
        department: schoolTasks.department,
        totalTasks: sql<number>`count(*)`,
        completedTasks: sql<number>`count(*) filter (where status = 'Concluída')`,
        slaOnTrackOrWarningCount: sql<number>`count(*) filter (where sla_status <> 'Breached')`,
        avgHours: sql<number>`COALESCE(AVG(CASE WHEN status = 'Concluída' THEN EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600 ELSE NULL END), 0)`
      })
      .from(schoolTasks)
      .where(and(eq(schoolTasks.tenantId, tenantId), eq(schoolTasks.isDeleted, false)))
      .groupBy(schoolTasks.department);

      const formattedDepartments: Record<string, any> = {};

      for (const row of deptAnalyticsResult) {
        const dept = row.department || 'Outro';
        const total = Number(row.totalTasks || 0);
        const completed = Number(row.completedTasks || 0);
        const onTrackOrWarning = Number(row.slaOnTrackOrWarningCount || 0);
        const avgHours = Number(row.avgHours || 0);

        formattedDepartments[dept] = {
          completedTasks: completed,
          averageCompletionTimeHours: parseFloat(avgHours.toFixed(2)),
          slaComplianceRate: total > 0 ? parseFloat(((onTrackOrWarning / total) * 100).toFixed(2)) : 100
        };
      }

      result = { byDepartment: formattedDepartments };
    }

    await SchoolTaskCache.set(tenantId, 'departments', result, 60);
    return result;
  }

  /**
   * Get multi-tenant SLA and health telemetry
   */
  static async getHealth(tenantId: string): Promise<any> {
    const cached = await SchoolTaskCache.get(tenantId, 'health');
    if (cached) return cached;

    const todayStr = new Date().toISOString().split('T')[0];
    const startTime = Date.now();
    let result: any;

    if (!process.env.SQL_HOST) {
      // In-memory fallback
      const tasks = inMemoryDb.school_tasks.filter(t => t.tenantId === tenantId);
      const active = tasks.filter(t => !t.isDeleted);
      const overdue = active.filter(t => t.status !== 'Concluída' && t.limitDate < todayStr).length;
      const archived = tasks.filter(t => t.isDeleted).length;

      let invalidDepsCount = 0;
      for (const task of active) {
        const deps = task.dependencies || [];
        const hasInvalid = deps.some((depId: string) => {
          const depTask = inMemoryDb.school_tasks.find(d => d.id === depId && d.tenantId === tenantId && !d.isDeleted);
          return !depTask;
        });
        if (hasInvalid && deps.length > 0) {
          invalidDepsCount++;
        }
      }

      result = {
        totalRegistros: tasks.length,
        tempoMedioQueryMs: Date.now() - startTime,
        tarefasAtrasadas: overdue,
        tarefasComDependenciasInvalidas: invalidDepsCount,
        tarefasArquivadas: archived
      };
    } else {
      const countsResult = await db.select({
        total: sql<number>`count(*)`,
        archived: sql<number>`count(*) filter (where is_deleted)`,
        overdue: sql<number>`count(*) filter (where not is_deleted and status <> 'Concluída' and limit_date < ${todayStr})`
      })
      .from(schoolTasks)
      .where(eq(schoolTasks.tenantId, tenantId));

      const counts = countsResult[0] || { total: 0, archived: 0, overdue: 0 };

      const invalidDepsResult = await db.execute(sql`
        SELECT COUNT(DISTINCT t.id)::int as count
        FROM school_tasks t
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(t.dependencies, '[]'::jsonb)) as dep_id
        LEFT JOIN school_tasks d ON d.id = dep_id AND d.is_deleted = false AND d.tenant_id = t.tenant_id
        WHERE t.is_deleted = false AND t.tenant_id = ${tenantId} AND d.id IS NULL;
      `);
      const dependenciasInvalidasCount = Number((invalidDepsResult.rows[0] as any)?.count || 0);

      result = {
        totalRegistros: Number(counts.total || 0),
        tempoMedioQueryMs: Date.now() - startTime,
        tarefasAtrasadas: Number(counts.overdue || 0),
        tarefasComDependenciasInvalidas: dependenciasInvalidasCount,
        tarefasArquivadas: Number(counts.archived || 0)
      };
    }

    await SchoolTaskCache.set(tenantId, 'health', result, 30);
    return result;
  }

  /**
   * Filtered and paginated lists
   */
  static async getTasks(tenantId: string, filter: TaskFilter): Promise<any[]> {
    return await SchoolTaskRepository.findMany(tenantId, filter);
  }

  static async getTasksCount(tenantId: string, filter: Omit<TaskFilter, 'page' | 'limit'>): Promise<number> {
    return await SchoolTaskRepository.count(tenantId, filter);
  }

  static async getDeletedTasks(tenantId: string): Promise<any[]> {
    return await SchoolTaskRepository.findDeleted(tenantId);
  }

  static async getTaskById(id: string, tenantId: string): Promise<any | null> {
    return await SchoolTaskRepository.findById(id, tenantId);
  }

  /**
   * Create tasks and trigger events
   */
  static async createTask(taskData: any, tenantId: string, schoolId: string, organizationId: string, changedBy: string, metadata: any): Promise<any> {
    // Business Validation: Circular / precedence validation
    if (taskData.dependencies && taskData.dependencies.includes(taskData.id)) {
      throw new Error('Uma tarefa não pode depender de si própria.');
    }

    const task = await SchoolTaskRepository.create(taskData, tenantId, schoolId, organizationId, changedBy, metadata);
    const resolvedTask = task || { ...taskData, id: taskData.id || `TSK-${Math.floor(2000 + Math.random() * 8000)}` };

    // Event Publishing
    eventBus.publish({
      eventName: 'TaskCreated',
      tenantId,
      taskId: resolvedTask.id,
      data: resolvedTask,
      userId: metadata.userId,
      userName: metadata.userName,
      timestamp: new Date().toISOString(),
      requestId: metadata.requestId,
      correlationId: metadata.correlationId
    });

    if (resolvedTask.assignedTo && resolvedTask.assignedTo !== 'Não atribuído') {
      eventBus.publish({
        eventName: 'TaskAssigned',
        tenantId,
        taskId: resolvedTask.id,
        data: { assignedTo: resolvedTask.assignedTo },
        userId: metadata.userId,
        userName: metadata.userName,
        timestamp: new Date().toISOString(),
        requestId: metadata.requestId,
        correlationId: metadata.correlationId
      });
    }

    return resolvedTask;
  }

  /**
   * Update tasks, detect events like status changes / completed / dependencies, etc
   */
  static async updateTask(id: string, updates: any, tenantId: string, changedBy: string, metadata: any): Promise<any> {
    const existing = await SchoolTaskRepository.findById(id, tenantId);
    if (!existing) {
      throw new Error(`Tarefa com o ID ${id} não foi encontrada.`);
    }

    // Business checks for precedence
    if (updates.dependencies) {
      if (updates.dependencies.includes(id)) {
        throw new Error('Uma tarefa não pode depender de si própria.');
      }
      
      // Prevent cyclic dependency graphs (direct cycles)
      for (const depId of updates.dependencies) {
        const depTask = await SchoolTaskRepository.findById(depId, tenantId);
        if (depTask && depTask.dependencies && depTask.dependencies.includes(id)) {
          throw new Error(`Dependência circular detectada! A tarefa ${depId} já depende desta tarefa (${id}).`);
        }
      }
    }

    const task = await SchoolTaskRepository.update(id, updates, tenantId, changedBy, metadata);

    // Dynamic Event dispatching
    eventBus.publish({
      eventName: 'TaskUpdated',
      tenantId,
      taskId: task.id,
      data: { updates },
      userId: metadata.userId,
      userName: metadata.userName,
      timestamp: new Date().toISOString(),
      requestId: metadata.requestId,
      correlationId: metadata.correlationId
    });

    if (updates.status && updates.status !== existing.status) {
      if (updates.status === 'Concluída') {
        eventBus.publish({
          eventName: 'TaskCompleted',
          tenantId,
          taskId: task.id,
          data: { completedBy: changedBy },
          userId: metadata.userId,
          userName: metadata.userName,
          timestamp: new Date().toISOString(),
          requestId: metadata.requestId,
          correlationId: metadata.correlationId
        });
      }
    }

    if (updates.assignedTo && updates.assignedTo !== existing.assignedTo) {
      eventBus.publish({
        eventName: 'TaskAssigned',
        tenantId,
        taskId: task.id,
        data: { assignedTo: updates.assignedTo },
        userId: metadata.userId,
        userName: metadata.userName,
        timestamp: new Date().toISOString(),
        requestId: metadata.requestId,
        correlationId: metadata.correlationId
      });
    }

    if (updates.dependencies && JSON.stringify(updates.dependencies) !== JSON.stringify(existing.dependencies)) {
      eventBus.publish({
        eventName: 'TaskDependencyChanged',
        tenantId,
        taskId: task.id,
        data: { dependencies: updates.dependencies },
        userId: metadata.userId,
        userName: metadata.userName,
        timestamp: new Date().toISOString(),
        requestId: metadata.requestId,
        correlationId: metadata.correlationId
      });
    }

    // Check SLA Breach alert
    if (task.slaStatus === 'Breached' && existing.slaStatus !== 'Breached') {
      eventBus.publish({
        eventName: 'TaskSlaBreached',
        tenantId,
        taskId: task.id,
        data: { limitDate: task.limitDate },
        userId: metadata.userId,
        userName: metadata.userName,
        timestamp: new Date().toISOString(),
        requestId: metadata.requestId,
        correlationId: metadata.correlationId
      });
    }

    return task;
  }

  /**
   * Soft delete task
   */
  static async deleteTask(id: string, tenantId: string, deletedBy: string, metadata: any): Promise<boolean> {
    const success = await SchoolTaskRepository.delete(id, tenantId, deletedBy, metadata);
    if (success) {
      eventBus.publish({
        eventName: 'TaskDeleted',
        tenantId,
        taskId: id,
        data: { deletedBy },
        userId: metadata.userId,
        userName: metadata.userName,
        timestamp: new Date().toISOString(),
        requestId: metadata.requestId,
        correlationId: metadata.correlationId
      });
    }
    return success;
  }

  /**
   * Restore a soft-deleted task
   */
  static async restoreTask(id: string, tenantId: string, restoredBy: string, metadata: any): Promise<any> {
    const task = await SchoolTaskRepository.restore(id, tenantId, restoredBy, metadata);
    if (task) {
      eventBus.publish({
        eventName: 'TaskRestored',
        tenantId,
        taskId: id,
        data: { restoredBy },
        userId: metadata.userId,
        userName: metadata.userName,
        timestamp: new Date().toISOString(),
        requestId: metadata.requestId,
        correlationId: metadata.correlationId
      });
    }
    return task;
  }

  /**
   * Get version history timeline
   */
  static async getTimeline(taskId: string, tenantId: string): Promise<any[]> {
    return await SchoolTaskRepository.getTaskHistoryTimeline(taskId, tenantId);
  }

  /**
   * Rollback a task to a previous snapshot
   */
  static async rollbackTask(taskId: string, version: number, tenantId: string, rolledBy: string, metadata: any): Promise<any> {
    const task = await SchoolTaskRepository.rollback(taskId, version, tenantId, rolledBy, metadata);
    if (task) {
      eventBus.publish({
        eventName: 'TaskUpdated',
        tenantId,
        taskId,
        data: { rolledBackToVersion: version },
        userId: metadata.userId,
        userName: metadata.userName,
        timestamp: new Date().toISOString(),
        requestId: metadata.requestId,
        correlationId: metadata.correlationId
      });
    }
    return task;
  }

  /**
   * Get circular precedence or dependency impact cascades
   */
  static async getDependencyImpact(id: string, tenantId: string): Promise<any> {
    // Build direct and indirect impact tree
    const allTasks = !process.env.SQL_HOST 
      ? inMemoryDb.school_tasks.filter(t => t.tenantId === tenantId && !t.isDeleted)
      : await db.select().from(schoolTasks).where(and(eq(schoolTasks.tenantId, tenantId), eq(schoolTasks.isDeleted, false)));

    const directImpact: string[] = [];
    const indirectImpact: string[] = [];

    // Find direct dependents (tasks that have 'id' in their dependencies array)
    for (const t of allTasks) {
      const deps = t.dependencies || [];
      if (deps.includes(id)) {
        directImpact.push(t.id);
      }
    }

    // DFS helper for recursive cascading dependents
    const findIndirect = (currentIds: string[]) => {
      const nextBatch: string[] = [];
      for (const t of allTasks) {
        const deps = t.dependencies || [];
        const hasDep = deps.some((depId: string) => currentIds.includes(depId));
        if (hasDep && !directImpact.includes(t.id) && !indirectImpact.includes(t.id) && t.id !== id) {
          nextBatch.push(t.id);
          indirectImpact.push(t.id);
        }
      }
      if (nextBatch.length > 0) {
        findIndirect(nextBatch);
      }
    };

    if (directImpact.length > 0) {
      findIndirect(directImpact);
    }

    return {
      taskId: id,
      directDependentCount: directImpact.length,
      directDependentIds: directImpact,
      indirectDependentCount: indirectImpact.length,
      indirectDependentIds: indirectImpact,
      totalImpactCount: directImpact.length + indirectImpact.length
    };
  }

  /**
   * Export database tasks in multiple enterprise formats (JSON, CSV, simulated EXCEL, or summary lists)
   */
  static async exportTasks(tenantId: string, filter: TaskFilter, format: string): Promise<{ data: any; mimeType: string; filename: string }> {
    const tasks = await SchoolTaskRepository.findMany(tenantId, { ...filter, limit: 1000 }); // Large limit for exports

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cleanFormat = format.trim().toLowerCase();

    if (cleanFormat === 'csv') {
      const headers = ['ID', 'Titulo', 'Prioridade', 'Status', 'Responsavel', 'Departamento', 'Data_Limite', 'Data_Criacao'];
      const rows = tasks.map(t => [
        t.id,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        t.priority,
        t.status,
        t.assignedTo,
        t.department,
        t.limitDate,
        t.createdAt ? new Date(t.createdAt).toISOString() : ''
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      return {
        data: Buffer.from(csvContent, 'utf-8'),
        mimeType: 'text/csv',
        filename: `backup-tasks-${tenantId}-${timestamp}.csv`
      };
    }

    if (cleanFormat === 'excel') {
      // Excel-friendly CSV with UTF-8 BOM
      const headers = ['ID', 'Titulo', 'Prioridade', 'Status', 'Responsavel', 'Departamento', 'Prazo SLA', 'Criador'];
      const rows = tasks.map(t => [
        t.id,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        t.priority,
        t.status,
        t.assignedTo,
        t.department,
        t.limitDate,
        t.createdBy || ''
      ]);
      const bom = '\uFEFF';
      const excelContent = bom + [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
      return {
        data: Buffer.from(excelContent, 'utf-8'),
        mimeType: 'application/vnd.ms-excel',
        filename: `backup-tasks-${tenantId}-${timestamp}.xls`
      };
    }

    if (cleanFormat === 'pdf') {
      // PDF summary report layout compiled as structured human-readable document summary text
      const report = [
        `==================================================`,
        `NEXUS PORTAL - RELATÓRIO DE TAREFAS ESCOLARES`,
        `Tenant ID: ${tenantId}`,
        `Gerado em: ${new Date().toLocaleString('pt-PT')}`,
        `Total de Registos: ${tasks.length}`,
        `==================================================\n`,
        ...tasks.map((t, idx) => {
          return `${idx + 1}. [${t.id}] ${t.title}
   - Estado: ${t.status} | Prioridade: ${t.priority}
   - Atribuído a: ${t.assignedTo} (${t.department})
   - Prazo Limite: ${t.limitDate} | Criado por: ${t.createdBy || 'N/A'}
   --------------------------------------------------`;
        })
      ].join('\n');

      return {
        data: Buffer.from(report, 'utf-8'),
        mimeType: 'application/pdf',
        filename: `relatorio-tasks-${tenantId}-${timestamp}.pdf`
      };
    }

    // Default to JSON
    return {
      data: JSON.stringify({ tasks, exportedAt: new Date().toISOString() }, null, 2),
      mimeType: 'application/json',
      filename: `backup-tasks-${tenantId}-${timestamp}.json`
    };
  }

  /**
   * Atomic transactional restore from logical file backups
   */
  static async importBackup(tasks: any[], tenantId: string, schoolId: string, organizationId: string, importedBy: string): Promise<number> {
    if (!tasks || !Array.isArray(tasks)) {
      throw new Error('Backup corrompido: Formato de tarefas inválido.');
    }

    // Execute safe database transaction
    await db.transaction(async (tx) => {
      // Delete old tasks under this tenant only to avoid cross-tenant contamination
      await tx.delete(schoolTasks).where(eq(schoolTasks.tenantId, tenantId));

      if (tasks.length > 0) {
        const payload = tasks.map((t: any) => ({
          ...t,
          tenantId,
          schoolId,
          organizationId,
          createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
          updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
          deletedAt: t.deletedAt ? new Date(t.deletedAt) : null,
          slaDeadline: t.slaDeadline ? new Date(t.slaDeadline) : null,
          completedAt: t.completedAt ? new Date(t.completedAt) : null,
          startedAt: t.startedAt ? new Date(t.startedAt) : null,
          firstResponseAt: t.firstResponseAt ? new Date(t.firstResponseAt) : null,
        }));
        
        await tx.insert(schoolTasks).values(payload);
      }
    });

    console.log(`[Backup] Atomic logical restore successful: imported ${tasks.length} tasks for tenant ${tenantId}`);
    return tasks.length;
  }
}

// Auto-register evictors on load
SchoolTaskService.registerCacheEvictors();
