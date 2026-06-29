import { db } from './index.ts';
import { sql } from 'drizzle-orm';
import {
  users,
  students,
  teachers,
  invoices,
  announcements,
  chatMessages,
  automations,
  operationalLogs,
  approvals,
  schoolTasks
} from './schema.ts';

export async function initializeDatabase() {
  console.log('[DB-INIT] Starting database initialization...');
  if (!process.env.SQL_HOST) {
    console.log('[DB-INIT] Cloud SQL configuration not detected. Operating with in-memory persistence fallback.');
    return;
  }
  
  try {
    // 1. Ensure tables exist via self-contained SQL DDL
    // Using simple queries because UpdateSchema might be running into container/privilege constraints
    console.log('[DB-INIT] Provisioning tables if not exists...');
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        phone TEXT,
        department TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        last_access TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Dynamically upgrade existing users table if it existed prior to the upgrade
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_access TIMESTAMP`);
    } catch (colErr) {
      console.log('[DB-INIT] Handled user columns exception, columns may already exist:', colErr);
    }

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        class TEXT NOT NULL,
        attendance_rate INTEGER NOT NULL DEFAULT 100,
        average_grade DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'active',
        outstanding_fees INTEGER NOT NULL DEFAULT 0,
        guardians_name TEXT NOT NULL,
        guardians_contact TEXT NOT NULL,
        behavior_degree TEXT NOT NULL DEFAULT 'Excelente',
        documents JSONB NOT NULL DEFAULT '[]'::jsonb,
        behavior_history JSONB NOT NULL DEFAULT '[]'::jsonb,
        grades JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS teachers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
        classes JSONB NOT NULL DEFAULT '[]'::jsonb,
        productivity_score INTEGER NOT NULL DEFAULT 90,
        schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
        status TEXT NOT NULL DEFAULT 'active',
        documents JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // We do NOT use foreign key references to students if students aren't fully synchronized yet, to make sure it never fails because of insert order
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        due_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        category TEXT NOT NULL DEFAULT 'tuition',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        role TEXT NOT NULL,
        date TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT 'all',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        sender TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        channel TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS automations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        trigger TEXT NOT NULL,
        action TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        type TEXT NOT NULL,
        executions INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS uploaded_documents (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT,
        size TEXT NOT NULL DEFAULT '0 KB',
        category TEXT NOT NULL DEFAULT 'Unassigned',
        extracted_details JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'Processing',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS operational_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        user_name TEXT NOT NULL DEFAULT 'System',
        user_role TEXT NOT NULL DEFAULT 'system',
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        flow_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        requester_role TEXT NOT NULL,
        requester_name TEXT NOT NULL,
        created_at_date TEXT NOT NULL,
        created_at_time TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW(),
        history JSONB NOT NULL DEFAULT '[]'::jsonb
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS school_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        assigned_to TEXT NOT NULL DEFAULT 'Não atribuído',
        department TEXT NOT NULL DEFAULT 'Secretaria',
        priority TEXT NOT NULL DEFAULT 'Normal',
        status TEXT NOT NULL DEFAULT 'Pendente',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        due_date DATE NOT NULL,
        limit_date DATE NOT NULL,
        created_automatically BOOLEAN DEFAULT false,
        reference_id TEXT,
        reference_type TEXT,
        observations TEXT,
        history JSONB DEFAULT '[]'::jsonb,
        attachments JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by TEXT,
        executed_by TEXT,
        completed_by TEXT,
        completed_at TIMESTAMP WITH TIME ZONE,
        dependencies JSONB DEFAULT '[]'::jsonb,
        is_deleted BOOLEAN DEFAULT false NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by TEXT,
        started_at TIMESTAMP WITH TIME ZONE,
        first_response_at TIMESTAMP WITH TIME ZONE,
        sla_deadline TIMESTAMP WITH TIME ZONE,
        sla_status TEXT DEFAULT 'On Track'
      );
    `);

    // Dynamically upgrade existing school_tasks table to production-ready native columns
    try {
      await db.execute(sql`ALTER TABLE school_tasks ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false NOT NULL`);
      await db.execute(sql`ALTER TABLE school_tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE`);
      await db.execute(sql`ALTER TABLE school_tasks ADD COLUMN IF NOT EXISTS deleted_by TEXT`);
    } catch (colErr) {
      console.log('[DB-INIT] Handled school_tasks soft-delete columns exception:', colErr);
    }

    try {
      await db.execute(sql`ALTER TABLE school_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE`);
      await db.execute(sql`ALTER TABLE school_tasks ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP WITH TIME ZONE`);
      await db.execute(sql`ALTER TABLE school_tasks ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMP WITH TIME ZONE`);
      await db.execute(sql`ALTER TABLE school_tasks ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'On Track'`);
    } catch (slaErr) {
      console.log('[DB-INIT] Handled school_tasks SLA columns exception:', slaErr);
    }

    try {
      await db.execute(sql`
        ALTER TABLE school_tasks 
        ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE 
        USING (created_at::timestamp with time zone)
      `);
    } catch (err) {
      console.log('[DB-INIT] Handled school_tasks created_at migration:', err);
    }

    try {
      await db.execute(sql`
        ALTER TABLE school_tasks 
        ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE 
        USING (updated_at::timestamp with time zone)
      `);
    } catch (err) {
      console.log('[DB-INIT] Handled school_tasks updated_at migration:', err);
    }

    try {
      await db.execute(sql`
        ALTER TABLE school_tasks 
        ALTER COLUMN completed_at TYPE TIMESTAMP WITH TIME ZONE 
        USING (completed_at::timestamp with time zone)
      `);
    } catch (err) {
      console.log('[DB-INIT] Handled school_tasks completed_at migration:', err);
    }

    try {
      await db.execute(sql`
        ALTER TABLE school_tasks 
        ALTER COLUMN due_date TYPE DATE 
        USING (due_date::date)
      `);
    } catch (err) {
      console.log('[DB-INIT] Handled school_tasks due_date migration:', err);
    }

    try {
      await db.execute(sql`
        ALTER TABLE school_tasks 
        ALTER COLUMN limit_date TYPE DATE 
        USING (limit_date::date)
      `);
    } catch (err) {
      console.log('[DB-INIT] Handled school_tasks limit_date migration:', err);
    }

    // Create required indexes for school_tasks
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_school_tasks_dept_status ON school_tasks(department, status);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_school_tasks_status_dept ON school_tasks(status, department);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_school_tasks_assigned_status ON school_tasks(assigned_to, status);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_school_tasks_created_at ON school_tasks(created_at);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_school_tasks_completed_at ON school_tasks(completed_at);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_school_tasks_assigned ON school_tasks(assigned_to);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_school_tasks_ref ON school_tasks(reference_id, reference_type);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_school_tasks_due ON school_tasks(due_date);
    `);

    console.log('[DB-INIT] Tables checked and created.');

    // Seeding has been disabled to ensure a clean, production-ready operational state with zero dummy records.
    
    // G. Create System Log confirm initialization
    await db.insert(operationalLogs).values({
      userId: 'system',
      userName: 'Nexus Server',
      userRole: 'system',
      action: 'DB_INITIALIZATION',
      details: 'Cloud SQL Database successfully self-healed, provisioned for clean slate operational usage.',
    });

    console.log('[DB-INIT] Database successfully initialized.');
  } catch (error) {
    console.error('[DB-INIT] Failed to initialize database:', error);
  }
}
