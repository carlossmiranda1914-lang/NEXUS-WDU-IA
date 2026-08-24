import { db, isInMemoryFallbackAllowed, isPersistentDatabaseConfigured } from './index.ts';
import { sql } from 'drizzle-orm';

// Runtime startup validates the migration-owned contract; it never creates or
// alters business schema. Schema evolution belongs exclusively to nexus:migrate.
const requiredRelations = [
  'users', 'students', 'teachers', 'invoices', 'announcements', 'chat_messages',
  'automations', 'uploaded_documents', 'operational_logs', 'approvals',
  'school_tasks', 'task_versions', 'nexus_schema_migrations',
] as const;

export async function initializeDatabase(): Promise<void> {
  if (!isPersistentDatabaseConfigured) {
    if (isInMemoryFallbackAllowed) return;
    throw new Error('[DB-INIT] Persistent database configuration is required when local in-memory fallback is disabled.');
  }

  const result = await db.execute(sql`
    SELECT relation_name
      FROM unnest(ARRAY[${sql.join(requiredRelations.map((relation) => sql`${relation}`), sql`, `)}]::text[]) AS relation_name
     WHERE to_regclass(format('%I.%I', current_schema(), relation_name)) IS NULL
  `);
  const missing = result.rows.map((row: any) => row.relation_name);
  if (missing.length > 0) {
    throw new Error(`[DB-INIT] Required migration-owned schema is missing: ${missing.join(', ')}. Run nexus:migrate before startup.`);
  }
}
