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

    // 2. Perform Seeding
    // A. Students Seeding
    const studentCountResult = await db.execute(sql`SELECT count(*) FROM students`);
    const studentCount = parseInt((studentCountResult.rows[0] as any)?.count || '0');
    if (studentCount === 0) {
      console.log('[DB-INIT] Seeding initial students...');
      for (const s of initialStudents) {
        await db.insert(students).values({
          id: s.id,
          name: s.name,
          class: s.class,
          attendanceRate: s.attendanceRate,
          averageGrade: s.averageGrade,
          status: s.status,
          outstandingFees: s.outstandingFees,
          guardiansName: s.guardiansName,
          guardiansContact: s.guardiansContact,
          behaviorDegree: s.behaviorDegree,
          documents: s.documents,
          behaviorHistory: s.behaviorHistory,
          grades: s.grades,
        });
      }
    }

    // B. Teachers Seeding
    const teacherCountResult = await db.execute(sql`SELECT count(*) FROM teachers`);
    const teacherCount = parseInt((teacherCountResult.rows[0] as any)?.count || '0');
    if (teacherCount === 0) {
      console.log('[DB-INIT] Seeding initial teachers...');
      for (const t of initialTeachers) {
        await db.insert(teachers).values({
          id: t.id,
          name: t.name,
          email: t.email,
          phone: t.phone || '',
          subjects: t.subjects,
          classes: t.classes,
          productivityScore: t.productivityScore,
          schedule: t.schedule,
          status: t.status,
          documents: t.documents || [],
        });
      }
    }

    // C. Invoices Seeding
    const invoicesCountResult = await db.execute(sql`SELECT count(*) FROM invoices`);
    const invoicesCount = parseInt((invoicesCountResult.rows[0] as any)?.count || '0');
    if (invoicesCount === 0) {
      console.log('[DB-INIT] Seeding initial invoices...');
      for (const inv of initialInvoices) {
        await db.insert(invoices).values({
          id: inv.id,
          studentId: inv.studentId,
          studentName: inv.studentName,
          amount: inv.amount,
          dueDate: inv.dueDate,
          status: inv.status,
          category: inv.category,
        });
      }
    }

    // D. Announcements Seeding
    const announcementsCountResult = await db.execute(sql`SELECT count(*) FROM announcements`);
    const announcementsCount = parseInt((announcementsCountResult.rows[0] as any)?.count || '0');
    if (announcementsCount === 0) {
      console.log('[DB-INIT] Seeding initial announcements...');
      for (const ann of initialAnnouncements) {
        await db.insert(announcements).values({
          id: ann.id,
          title: ann.title,
          content: ann.content,
          author: ann.author,
          role: ann.role,
          date: ann.date,
          target: ann.target,
        });
      }
    }

    // E. Automations Seeding
    const automationsCountResult = await db.execute(sql`SELECT count(*) FROM automations`);
    const automationsCount = parseInt((automationsCountResult.rows[0] as any)?.count || '0');
    if (automationsCount === 0) {
      console.log('[DB-INIT] Seeding initial automations...');
      for (const aut of initialAutomations) {
        await db.insert(automations).values({
          id: aut.id,
          title: aut.title,
          description: aut.description,
          trigger: aut.trigger,
          action: aut.action,
          active: aut.active,
          type: aut.type,
          executions: aut.executions,
        });
      }
    }

    // F. Chat Messages Seeding
    const chatMsgCountResult = await db.execute(sql`SELECT count(*) FROM chat_messages`);
    const chatMsgCount = parseInt((chatMsgCountResult.rows[0] as any)?.count || '0');
    if (chatMsgCount === 0) {
      console.log('[DB-INIT] Seeding initial chat messages...');
      for (const m of initialMessages) {
        await db.insert(chatMessages).values({
          sender: m.sender,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          channel: m.channel,
        });
      }
    }

    // F2. Todo Tasks Seeding
    const tasksCountResult = await db.execute(sql`SELECT count(*) FROM todo_tasks`);
    const tasksCount = parseInt((tasksCountResult.rows[0] as any)?.count || '0');
    if (tasksCount === 0) {
      console.log('[DB-INIT] Seeding initial todo tasks...');
      const initialTodoTasks = [
        {
          id: 'TASK-101',
          title: 'Rever faturas vencidas do 8º Ano B',
          description: 'Identificar encarregados de educação com propinas em atraso e programar disparo de aviso.',
          dueDate: '2026-06-25',
          priority: 'alta',
          status: 'pendente',
          assignedTo: 'Financeiro'
        },
        {
          id: 'TASK-102',
          title: 'Emitir certificado de matrícula de Mariana Costa',
          description: 'Gerar o respectivo certificado oficial assinado digitalmente pelo Diretor Pedagógico.',
          dueDate: '2026-06-26',
          priority: 'média',
          status: 'pendente',
          assignedTo: 'Secretaria'
        },
        {
          id: 'TASK-103',
          title: 'Auditar pautas acadêmicas do 9º Ano',
          description: 'Analisar e retificar notas de exames introduzidas no final do 2º Período.',
          dueDate: '2026-06-30',
          priority: 'baixa',
          status: 'concluído',
          assignedTo: 'all'
        }
      ];
      for (const t of initialTodoTasks) {
        await db.insert(todoTasks).values(t);
      }
    }

    // G. Create System Log confirm initialization
    await db.insert(operationalLogs).values({
      userId: 'system',
      userName: 'Nexus Server',
      userRole: 'system',
      action: 'DB_INITIALIZATION',
      details: 'Cloud SQL Database successfully self-healed, provisioned and seeded with operational mock records.',
    });

    console.log('[DB-INIT] Database successfully initialized and seeded.');
  } catch (error) {
    console.error('[DB-INIT] Failed to initialize database:', error);
  }
}
