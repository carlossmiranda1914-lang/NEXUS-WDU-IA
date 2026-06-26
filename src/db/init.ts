import { db } from './index.ts';
import { sql } from 'drizzle-orm';
import {
  initialStudents,
  initialTeachers,
  initialInvoices,
  initialAnnouncements,
  initialAutomations,
  initialMessages
} from '../mockData.ts';
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
  todoTasks
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
      CREATE TABLE IF NOT EXISTS todo_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        due_date TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'média',
        status TEXT NOT NULL DEFAULT 'pendente',
        assigned_to TEXT NOT NULL DEFAULT 'all',
        created_at TIMESTAMP DEFAULT NOW()
      );
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
