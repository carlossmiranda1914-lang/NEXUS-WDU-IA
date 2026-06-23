import { pgTable, serial, text, integer, timestamp, boolean, doublePrecision, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users Profile Table (linked directly to Firebase Authentication UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default('student'), // 'admin' | 'director' | 'secretariat' | 'teacher' | 'parent' | 'student'
  phone: text('phone'),
  department: text('department'), // e.g. 'Direção', 'Secretaria', 'Professorado', 'Financeiro', 'Acompanhamento', 'Alunos'
  status: text('status').notNull().default('active'), // 'active' | 'suspended'
  lastAccess: timestamp('last_access'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Students Table
export const students = pgTable('students', {
  id: text('id').primaryKey(), // e.g., 'ALU-101'
  name: text('name').notNull(),
  class: text('class').notNull(),
  attendanceRate: integer('attendance_rate').notNull().default(100),
  averageGrade: doublePrecision('average_grade').notNull().default(0.0),
  status: text('status').notNull().default('active'), // 'active' | 'inactive'
  outstandingFees: integer('outstanding_fees').notNull().default(0),
  guardiansName: text('guardians_name').notNull(),
  guardiansContact: text('guardians_contact').notNull(),
  behaviorDegree: text('behavior_degree').notNull().default('Excelente'), // 'Excelente' | 'Bom' | 'Regular' | 'Atenção'
  documents: jsonb('documents').notNull().default([]), // array of { name: string, submitted: boolean, date: string }
  behaviorHistory: jsonb('behavior_history').notNull().default([]), // array of { date: string, note: string, categoryDefault: string }
  grades: jsonb('grades').notNull().default([]), // array of { subject: string, score: number }
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Teachers Table
export const teachers = pgTable('teachers', {
  id: text('id').primaryKey(), // e.g., 'PROF-001'
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  subjects: jsonb('subjects').notNull().default([]), // array of strings
  classes: jsonb('classes').notNull().default([]), // array of strings
  productivityScore: integer('productivity_score').notNull().default(90),
  schedule: jsonb('schedule').notNull().default([]), // array of strings
  status: text('status').notNull().default('active'), // 'active' | 'inactive'
  documents: jsonb('documents').notNull().default([]), // array of { name: string, submitted: boolean, date: string }
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Invoices / Payments Table
export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(), // e.g., 'FAT-9901'
  studentId: text('student_id').references(() => students.id).notNull(),
  studentName: text('student_name').notNull(),
  amount: integer('amount').notNull(),
  dueDate: text('due_date').notNull(), // YYYY-MM-DD
  status: text('status').notNull().default('pending'), // 'paid' | 'pending' | 'overdue'
  category: text('category').notNull().default('tuition'), // 'tuition' | 'material' | 'extracurricular'
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. Announcements Table
export const announcements = pgTable('announcements', {
  id: text('id').primaryKey(), // e.g., 'AVISO-01'
  title: text('title').notNull(),
  content: text('content').notNull(),
  author: text('author').notNull(),
  role: text('role').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  target: text('target').notNull().default('all'), // 'all' | 'teachers' | 'parents' | 'students'
  createdAt: timestamp('created_at').defaultNow(),
});

// 6. Chat Messages Table
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  sender: text('sender').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  timestamp: text('timestamp').notNull(), // HH:MM
  channel: text('channel').notNull(), // 'gral' | 'direction-teachers' | 'administration-secretariat'
  createdAt: timestamp('created_at').defaultNow(),
});

// 7. System Automations / n8n Trigger Simulations
export const automations = pgTable('automations', {
  id: text('id').primaryKey(), // e.g., 'FLUX-01'
  title: text('title').notNull(),
  description: text('description').notNull(),
  trigger: text('trigger').notNull(),
  action: text('action').notNull(),
  active: boolean('active').notNull().default(true),
  type: text('type').notNull(), // 'sms' | 'email' | 'system' | 'whatsapp'
  executions: integer('executions').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// 8. Uploaded/Processed Documents Table
export const uploadedDocuments = pgTable('uploaded_documents', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // e.g. 'pdf', 'png', etc.
  url: text('url'), // Local download/virtual storage link
  size: text('size').notNull().default('0 KB'),
  category: text('category').notNull().default('Unassigned'), // extracted/detected category e.g. 'Contrato de Matrícula'
  extractedDetails: jsonb('extracted_details').notNull().default({}), // OCR extracted JSON data
  status: text('status').notNull().default('Processing'), // 'Processing' | 'Analyzed' | 'Failed'
  createdAt: timestamp('created_at').defaultNow(),
});

// 9. Operational Activity Logs Table (System Traceability)
export const operationalLogs = pgTable('operational_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id'), // Firebase UID or 'system'
  userName: text('user_name').notNull().default('System'),
  userRole: text('user_role').notNull().default('system'),
  action: text('action').notNull(), // e.g., 'LOGIN', 'WORKFLOW_TRIGGER', 'PAYMENT_RECEIPT', 'OCR_ANALYSIS'
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// DEFINE SYSTEM RELATIONSHIPS
export const studentRelations = relations(students, ({ many }) => ({
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  student: one(students, {
    fields: [invoices.studentId],
    references: [students.id],
  }),
}));

// 10. Institutional Approvals Table
export const approvals = pgTable('approvals', {
  id: text('id').primaryKey(), // e.g., 'APR-001'
  title: text('title').notNull(),
  description: text('description').notNull(),
  flowType: text('flow_type').notNull(), // 'secretariat_to_director' | 'teacher_to_director' | 'financial_to_director'
  status: text('status').notNull().default('pending'), // 'pending' | 'analyzing' | 'approved' | 'rejected' | 'revision_requested'
  requesterRole: text('requester_role').notNull(),
  requesterName: text('requester_name').notNull(),
  createdAtDate: text('created_at_date').notNull(), // 'YYYY-MM-DD'
  createdAtTime: text('created_at_time').notNull(), // 'HH:MM:SS'
  updatedAt: timestamp('updated_at').defaultNow(),
  history: jsonb('history').notNull().default([]), // array of { id, timestamp, action, userRole, userName, comment }
});

// 11. Custom/Staff Tasks Table
export const todoTasks = pgTable('todo_tasks', {
  id: text('id').primaryKey(), // e.g. 'TASK-1002'
  title: text('title').notNull(),
  description: text('description').notNull(),
  dueDate: text('due_date').notNull(), // 'YYYY-MM-DD'
  priority: text('priority').notNull().default('média'), // 'alta' | 'média' | 'baixa'
  status: text('status').notNull().default('pendente'), // 'pendente' | 'concluído'
  assignedTo: text('assigned_to').notNull().default('all'), // 'all' or specific role/name
  createdAt: timestamp('created_at').defaultNow(),
});


