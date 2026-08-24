import { db, inMemoryDb, isPersistentDatabaseConfigured } from '../../db/index.ts';
import { schoolTasks, taskVersions } from '../../db/schema.ts';
import { eq, and, or, desc, sql, asc } from 'drizzle-orm';

const schoolTaskSelectCols = {
  id: schoolTasks.id,
  title: schoolTasks.title,
  description: schoolTasks.description,
  assignedTo: schoolTasks.assignedTo,
  department: schoolTasks.department,
  priority: schoolTasks.priority,
  status: schoolTasks.status,
  createdAt: schoolTasks.createdAt,
  dueDate: schoolTasks.dueDate,
  limitDate: schoolTasks.limitDate,
  createdAutomatically: schoolTasks.createdAutomatically,
  referenceId: schoolTasks.referenceId,
  referenceType: schoolTasks.referenceType,
  observations: schoolTasks.observations,
  history: schoolTasks.history,
  attachments: schoolTasks.attachments,
  updatedAt: schoolTasks.updatedAt,
  createdBy: schoolTasks.createdBy,
  executedBy: schoolTasks.executedBy,
  completedBy: schoolTasks.completedBy,
  completedAt: schoolTasks.completedAt,
  dependencies: schoolTasks.dependencies,
  isDeleted: schoolTasks.isDeleted,
  deletedAt: schoolTasks.deletedAt,
  deletedBy: schoolTasks.deletedBy,
  startedAt: schoolTasks.startedAt,
  firstResponseAt: schoolTasks.firstResponseAt,
  slaDeadline: schoolTasks.slaDeadline,
  slaStatus: schoolTasks.slaStatus,
  tenantId: schoolTasks.tenantId,
  schoolId: schoolTasks.schoolId,
  organizationId: schoolTasks.organizationId,
};

const taskVersionSelectCols = {
  id: taskVersions.id,
  taskId: taskVersions.taskId,
  version: taskVersions.version,
  snapshot: taskVersions.snapshot,
  changedBy: taskVersions.changedBy,
  changedAt: taskVersions.changedAt,
  action: taskVersions.action,
  requestId: taskVersions.requestId,
  correlationId: taskVersions.correlationId,
  ipAddress: taskVersions.ipAddress,
  userAgent: taskVersions.userAgent,
  diff: taskVersions.diff,
};


export interface TaskFilter {
  status?: string;
  department?: string;
  assignedTo?: string;
  priority?: string;
  dueDate?: string;
  createdBy?: string;
  search?: string; // Full-Text Search term
  page?: number;
  limit?: number;
}

export class SchoolTaskRepository {
  /**
   * Helper to append tenant isolation condition to a Drizzle where array
   */
  private static withTenant(tenantId: string, conditions: any[] = []): any {
    return and(eq(schoolTasks.tenantId, tenantId), eq(schoolTasks.isDeleted, false), ...conditions);
  }

  /**
   * Find a single task by ID within the tenant's boundaries
   */
  static async findById(id: string, tenantId: string): Promise<any | null> {
    const results = await db
      .select(schoolTaskSelectCols)
      .from(schoolTasks)
      .where(and(eq(schoolTasks.id, id), eq(schoolTasks.tenantId, tenantId), eq(schoolTasks.isDeleted, false)));
    return results[0] || null;
  }

  /**
   * Find a single task by ID even if deleted/archived
   */
  static async findByIdIncludingDeleted(id: string, tenantId: string): Promise<any | null> {
    const results = await db
      .select(schoolTaskSelectCols)
      .from(schoolTasks)
      .where(and(eq(schoolTasks.id, id), eq(schoolTasks.tenantId, tenantId)));
    return results[0] || null;
  }

  /**
   * Create a new task with automatic version snapshot initialization
   */
  static async create(taskData: any, tenantId: string, schoolId: string, organizationId: string, changedBy: string, metadata?: { requestId?: string; correlationId?: string; ipAddress?: string; userAgent?: string }): Promise<any> {
    const insertData = {
      ...taskData,
      tenantId,
      schoolId,
      organizationId,
      createdAt: taskData.createdAt || new Date(),
      updatedAt: taskData.updatedAt || new Date(),
    };

    return db.transaction(async (tx) => {
      const results = await tx.insert(schoolTasks).values(insertData).returning();
      const createdTask = (results && results[0]) || insertData;
      await this.createVersionSnapshot(createdTask, 'CREATE', changedBy, 1, null, metadata, tx);
      return createdTask;
    });
  }

  /**
   * Update an existing task, calculating diff and recording a new version snapshot
   */
  static async update(id: string, updates: any, tenantId: string, changedBy: string, metadata?: { requestId?: string; correlationId?: string; ipAddress?: string; userAgent?: string }): Promise<any> {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new Error(`Tarefa com o ID ${id} não foi encontrada.`);
    }

    const updatedFields = {
      ...updates,
      updatedAt: new Date(),
    };

    return db.transaction(async (tx) => {
      const results = await tx
        .update(schoolTasks)
        .set(updatedFields)
        .where(and(eq(schoolTasks.id, id), eq(schoolTasks.tenantId, tenantId)))
        .returning();
      const updatedTask = results[0];
      if (!updatedTask) return updatedTask;

      const latestVersion = await this.getLatestVersionNumber(id, tx);
      const diff: any = {};
      for (const key of Object.keys(updates)) {
        if (JSON.stringify(existing[key]) !== JSON.stringify(updatedTask[key])) {
          diff[key] = { before: existing[key], after: updatedTask[key] };
        }
      }
      await this.createVersionSnapshot(updatedTask, 'UPDATE', changedBy, latestVersion + 1, diff, metadata, tx);
      return updatedTask;
    });
  }

  /**
   * Soft delete a task and record snapshot
   */
  static async delete(id: string, tenantId: string, deletedBy: string, metadata?: { requestId?: string; correlationId?: string; ipAddress?: string; userAgent?: string }): Promise<boolean> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return false;

    return db.transaction(async (tx) => {
      const results = await tx
        .update(schoolTasks)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy,
          updatedAt: new Date(),
        })
        .where(and(eq(schoolTasks.id, id), eq(schoolTasks.tenantId, tenantId)))
        .returning();
      const deletedTask = results[0];
      if (!deletedTask) return false;
      const latest = await this.getLatestVersionNumber(id, tx);
      await this.createVersionSnapshot(deletedTask, 'DELETE', deletedBy, latest + 1, { isDeleted: { before: false, after: true } }, metadata, tx);
      return true;
    });
  }

  /**
   * Restore a soft-deleted task
   */
  static async restore(id: string, tenantId: string, restoredBy: string, metadata?: { requestId?: string; correlationId?: string; ipAddress?: string; userAgent?: string }): Promise<any> {
    const existing = await this.findByIdIncludingDeleted(id, tenantId);
    if (!existing) return null;

    const results = await db
      .update(schoolTasks)
      .set({
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date(),
      })
      .where(and(eq(schoolTasks.id, id), eq(schoolTasks.tenantId, tenantId)))
      .returning();

    const restoredTask = results[0];
    if (restoredTask) {
      const latest = await this.getLatestVersionNumber(id);
      await this.createVersionSnapshot(restoredTask, 'RESTORE', restoredBy, latest + 1, { isDeleted: { before: true, after: false } }, metadata);
    }
    return restoredTask;
  }

  /**
   * Find tasks with pagination, filtering, and PostgreSQL Full-Text Search
   */
  static async findMany(tenantId: string, filter: TaskFilter): Promise<any[]> {
    const { status, department, assignedTo, priority, dueDate, createdBy, search, page = 1, limit = 50 } = filter;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (status) conditions.push(eq(schoolTasks.status, status));
    if (department) conditions.push(eq(schoolTasks.department, department));
    if (assignedTo) conditions.push(eq(schoolTasks.assignedTo, assignedTo));
    if (priority) conditions.push(eq(schoolTasks.priority, priority));
    if (dueDate) conditions.push(eq(schoolTasks.dueDate, dueDate));
    if (createdBy) conditions.push(eq(schoolTasks.createdBy, createdBy));

    const baseWhere = this.withTenant(tenantId, conditions);

    // If search is active, execute PostgreSQL Full-Text Search or in-memory fallback
    if (search && search.trim().length > 0) {
      const cleanTerm = search.trim();

      if (!isPersistentDatabaseConfigured) {
        // High-fidelity local memory full-text search emulator
        const tasks = inMemoryDb.school_tasks.filter((t: any) => {
          if (t.tenantId !== tenantId || t.isDeleted) return false;

          // Simple filters
          if (status && t.status !== status) return false;
          if (department && t.department !== department) return false;
          if (assignedTo && t.assignedTo !== assignedTo) return false;
          if (priority && t.priority !== priority) return false;
          if (dueDate && t.dueDate !== dueDate) return false;
          if (createdBy && t.createdBy !== createdBy) return false;

          const fields = [t.title, t.description, t.observations, JSON.stringify(t.attachments || [])].join(' ').toLowerCase();
          return cleanTerm.toLowerCase().split(/\s+/).every(word => fields.includes(word));
        });

        // Simple sorting for emulator (e.g. latest created first)
        return tasks.slice(offset, offset + limit);
      }

      // Live PostgreSQL Full Text Search using GIN index & tsvector ranking relevance
      // Match keywords in Portuguese/English configurations
      const searchWords = cleanTerm.split(/\s+/).filter(Boolean);
      const queryStr = searchWords.map(w => `${w}:*`).join(' & ');

      const results = await db
        .select({
          task: schoolTasks,
          relevance: sql<number>`ts_rank_cd(
            to_tsvector('portuguese', coalesce(${schoolTasks.title}, '') || ' ' || coalesce(${schoolTasks.description}, '') || ' ' || coalesce(${schoolTasks.observations}, '')),
            to_tsquery('portuguese', ${queryStr})
          )`
        })
        .from(schoolTasks)
        .where(
          and(
            baseWhere,
            sql`to_tsvector('portuguese', coalesce(${schoolTasks.title}, '') || ' ' || coalesce(${schoolTasks.description}, '') || ' ' || coalesce(${schoolTasks.observations}, '')) @@ to_tsquery('portuguese', ${queryStr})`
          )
        )
        .orderBy((fields) => desc(fields.relevance))
        .limit(limit)
        .offset(offset);

      return results.map(r => r.task);
    }

    // Normal query when no search term is specified
    return await db
      .select(schoolTaskSelectCols)
      .from(schoolTasks)
      .where(baseWhere)
      .orderBy(desc(schoolTasks.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count total matching tasks for pagination
   */
  static async count(tenantId: string, filter: Omit<TaskFilter, 'page' | 'limit'>): Promise<number> {
    const { status, department, assignedTo, priority, dueDate, createdBy, search } = filter;
    const conditions: any[] = [];

    if (status) conditions.push(eq(schoolTasks.status, status));
    if (department) conditions.push(eq(schoolTasks.department, department));
    if (assignedTo) conditions.push(eq(schoolTasks.assignedTo, assignedTo));
    if (priority) conditions.push(eq(schoolTasks.priority, priority));
    if (dueDate) conditions.push(eq(schoolTasks.dueDate, dueDate));
    if (createdBy) conditions.push(eq(schoolTasks.createdBy, createdBy));

    const baseWhere = this.withTenant(tenantId, conditions);

    if (search && search.trim().length > 0) {
      if (!isPersistentDatabaseConfigured) {
        const cleanTerm = search.trim().toLowerCase();
        return inMemoryDb.school_tasks.filter((t: any) => {
          if (t.tenantId !== tenantId || t.isDeleted) return false;
          if (status && t.status !== status) return false;
          if (department && t.department !== department) return false;
          const fields = [t.title, t.description, t.observations].join(' ').toLowerCase();
          return cleanTerm.split(/\s+/).every(word => fields.includes(word));
        }).length;
      }

      const searchWords = search.trim().split(/\s+/).filter(Boolean);
      const queryStr = searchWords.map(w => `${w}:*`).join(' & ');

      const countResult = await db
        .select({ count: sql`count(*)` })
        .from(schoolTasks)
        .where(
          and(
            baseWhere,
            sql`to_tsvector('portuguese', coalesce(${schoolTasks.title}, '') || ' ' || coalesce(${schoolTasks.description}, '') || ' ' || coalesce(${schoolTasks.observations}, '')) @@ to_tsquery('portuguese', ${queryStr})`
          )
        );

      return Number((countResult[0] as any)?.count || 0);
    }

    const countResult = await db
      .select({ count: sql`count(*)` })
      .from(schoolTasks)
      .where(baseWhere);

    return Number((countResult[0] as any)?.count || 0);
  }

  /**
   * Retrieve all soft-deleted / archived tasks
   */
  static async findDeleted(tenantId: string): Promise<any[]> {
    return await db
      .select(schoolTaskSelectCols)
      .from(schoolTasks)
      .where(and(eq(schoolTasks.tenantId, tenantId), eq(schoolTasks.isDeleted, true)))
      .orderBy(desc(schoolTasks.deletedAt));
  }

  /**
   * Snapshot/Version logging helper
   */
  private static async createVersionSnapshot(
    task: any,
    action: string,
    changedBy: string,
    version: number,
    diff: any | null,
    metadata?: { requestId?: string; correlationId?: string; ipAddress?: string; userAgent?: string },
    executor: any = db,
  ): Promise<void> {
    const snapshotObj = { ...task };

    const versionData = {
      taskId: task.id,
      version,
      snapshot: snapshotObj,
      changedBy,
      changedAt: new Date(),
      action,
      requestId: metadata?.requestId || null,
      correlationId: metadata?.correlationId || null,
      ipAddress: metadata?.ipAddress || null,
      userAgent: metadata?.userAgent || null,
      diff: diff || {},
    };

    // Save in database
    await executor.insert(taskVersions).values(versionData);
  }

  /**
   * Find the highest recorded version number for a task
   */
  static async getLatestVersionNumber(taskId: string, executor: any = db): Promise<number> {
    const results = await executor
      .select({ version: taskVersions.version })
      .from(taskVersions)
      .where(eq(taskVersions.taskId, taskId))
      .orderBy(desc(taskVersions.version))
      .limit(1);

    return results[0]?.version || 0;
  }

  /**
   * Retrieve the complete audit history/timeline of versions for a task
   */
  static async getTaskHistoryTimeline(taskId: string, tenantId: string): Promise<any[]> {
    // First confirm task belongs to tenant
    const task = await this.findByIdIncludingDeleted(taskId, tenantId);
    if (!task) return [];

    return await db
      .select(taskVersionSelectCols)
      .from(taskVersions)
      .where(eq(taskVersions.taskId, taskId))
      .orderBy(desc(taskVersions.version));
  }

  /**
   * Rollback a task back to a specific version snapshot
   */
  static async rollback(taskId: string, version: number, tenantId: string, rolledBy: string, metadata?: { requestId?: string; correlationId?: string; ipAddress?: string; userAgent?: string }): Promise<any> {
    const existing = await this.findByIdIncludingDeleted(taskId, tenantId);
    if (!existing) {
      throw new Error(`Rollback abortado: Tarefa ${taskId} não encontrada no seu tenant.`);
    }

    const versionRecord = await db
      .select(taskVersionSelectCols)
      .from(taskVersions)
      .where(and(eq(taskVersions.taskId, taskId), eq(taskVersions.version, version)))
      .limit(1);

    if (versionRecord.length === 0) {
      throw new Error(`Rollback abortado: A versão ${version} para a tarefa ${taskId} não existe.`);
    }

    const targetSnapshot = versionRecord[0].snapshot as any;
    
    // Extricate immutable system fields we don't want to roll back blindly
    const rollbackPayload = {
      title: targetSnapshot.title,
      description: targetSnapshot.description,
      assignedTo: targetSnapshot.assignedTo,
      department: targetSnapshot.department,
      priority: targetSnapshot.priority,
      status: targetSnapshot.status,
      dueDate: targetSnapshot.dueDate,
      limitDate: targetSnapshot.limitDate,
      observations: targetSnapshot.observations,
      dependencies: targetSnapshot.dependencies || [],
      attachments: targetSnapshot.attachments || [],
      updatedAt: new Date(),
    };

    const results = await db
      .update(schoolTasks)
      .set(rollbackPayload)
      .where(and(eq(schoolTasks.id, taskId), eq(schoolTasks.tenantId, tenantId)))
      .returning();

    const rolledTask = results[0];

    if (rolledTask) {
      const latest = await this.getLatestVersionNumber(taskId);
      const nextVersion = latest + 1;
      
      const diff = {
        rollback_to_version: {
          before: existing.status,
          after: `Restaurado para a Versão ${version}`
        }
      };

      await this.createVersionSnapshot(rolledTask, `ROLLBACK_V${version}`, rolledBy, nextVersion, diff, metadata);
    }

    return rolledTask;
  }
}
