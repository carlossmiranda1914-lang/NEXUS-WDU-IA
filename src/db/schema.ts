import { pgTable, serial, text, integer, timestamp, boolean, doublePrecision, jsonb, date, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// vNext identity model. These tables intentionally coexist with the legacy
// `users` table during the progressive migration.
export const institutions = pgTable('institutions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('institutions_slug_unique').on(table.slug),
]);

export const people = pgTable('people', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  birthDate: date('birth_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const identities = pgTable('identities', {
  id: uuid('id').defaultRandom().primaryKey(),
  personId: uuid('person_id').notNull().references(() => people.id, { onDelete: 'restrict' }),
  provider: text('provider').notNull(),
  providerSubject: text('provider_subject').notNull(),
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('identities_provider_subject_unique').on(table.provider, table.providerSubject),
]);

export const memberships = pgTable('memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  personId: uuid('person_id').notNull().references(() => people.id, { onDelete: 'restrict' }),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'restrict' }),
  role: text('role').notNull(),
  status: text('status').notNull().default('pending'),
  approvedBy: uuid('approved_by').references(() => people.id, { onDelete: 'restrict' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('memberships_person_institution_role_unique').on(table.personId, table.institutionId, table.role),
]);

// vNext school roles. A student and a guardian are people with institutional
// relationships; neither relationship is inferred from an email or a fixed ID.
export const studentProfiles = pgTable('student_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'restrict' }),
  personId: uuid('person_id').notNull().references(() => people.id, { onDelete: 'restrict' }),
  studentNumber: text('student_number'),
  // Transitional link to the legacy SIS record. It is intentionally nullable:
  // no profile receives access to legacy data until an administrator maps it.
  legacyStudentId: text('legacy_student_id'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('student_profiles_institution_person_unique').on(table.institutionId, table.personId),
]);

export const guardianRelationships = pgTable('guardian_relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'restrict' }),
  guardianPersonId: uuid('guardian_person_id').notNull().references(() => people.id, { onDelete: 'restrict' }),
  studentPersonId: uuid('student_person_id').notNull().references(() => people.id, { onDelete: 'restrict' }),
  relationship: text('relationship').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('guardian_relationships_institution_guardian_student_unique').on(table.institutionId, table.guardianPersonId, table.studentPersonId),
]);

// Ownership bridge for records that still live in legacy domain tables. A
// resource can belong to exactly one institution; no mapping means no access.
export const institutionResourceOwnership = pgTable('institution_resource_ownership', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'restrict' }),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('institution_resource_ownership_resource_unique').on(table.resourceType, table.resourceId),
  index('institution_resource_ownership_scope_idx').on(table.institutionId, table.resourceType),
]);

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
  institutionId: uuid('institution_id').references(() => institutions.id, { onDelete: 'restrict' }),
  userId: text('user_id'), // Firebase UID or 'system'
  userName: text('user_name').notNull().default('System'),
  userRole: text('user_role').notNull().default('system'),
  action: text('action').notNull(), // e.g., 'LOGIN', 'WORKFLOW_TRIGGER', 'PAYMENT_RECEIPT', 'OCR_ANALYSIS'
  details: text('details').notNull(),
  requestId: text('request_id'),
  correlationId: text('correlation_id'),
  outcome: text('outcome').notNull().default('success'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow(),
});

// The enrollment domain is separate from the legacy `students` table.  Every
// record has an institution boundary and the student is always a `person`.
export const academicYears = pgTable('academic_years', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('academic_years_institution_name_unique').on(table.institutionId, table.name)]);

export const enrollmentOffers = pgTable('enrollment_offers', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'restrict' }),
  academicYearId: uuid('academic_year_id').notNull().references(() => academicYears.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('enrollment_offers_institution_code_unique').on(table.institutionId, table.code)]);

export const enrollmentApplications = pgTable('enrollment_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'restrict' }),
  studentPersonId: uuid('student_person_id').notNull().references(() => people.id, { onDelete: 'restrict' }),
  guardianPersonId: uuid('guardian_person_id').references(() => people.id, { onDelete: 'restrict' }),
  academicYearId: uuid('academic_year_id').notNull().references(() => academicYears.id, { onDelete: 'restrict' }),
  offerId: uuid('offer_id').notNull().references(() => enrollmentOffers.id, { onDelete: 'restrict' }),
  status: text('status').notNull().default('draft'),
  createdBy: uuid('created_by').notNull().references(() => people.id, { onDelete: 'restrict' }),
  updatedBy: uuid('updated_by').notNull().references(() => people.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('enrollment_applications_active_unique').on(table.institutionId, table.studentPersonId, table.academicYearId).where(sql`status <> 'cancelled'`),
  index('enrollment_applications_institution_status_idx').on(table.institutionId, table.status),
]);

export const enrollmentDocuments = pgTable('enrollment_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'restrict' }),
  enrollmentApplicationId: uuid('enrollment_application_id').notNull().references(() => enrollmentApplications.id, { onDelete: 'cascade' }),
  documentType: text('document_type').notNull(),
  status: text('status').notNull().default('pending'),
  evidenceReference: text('evidence_reference'),
  verifiedBy: uuid('verified_by').references(() => people.id, { onDelete: 'restrict' }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('enrollment_documents_application_type_unique').on(table.enrollmentApplicationId, table.documentType)]);

export const enrollmentEvents = pgTable('enrollment_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'restrict' }),
  enrollmentApplicationId: uuid('enrollment_application_id').notNull().references(() => enrollmentApplications.id, { onDelete: 'cascade' }),
  actorPersonId: uuid('actor_person_id').notNull().references(() => people.id, { onDelete: 'restrict' }),
  eventType: text('event_type').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index('enrollment_events_application_created_idx').on(table.enrollmentApplicationId, table.createdAt)]);

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

// 12. New School Tasks Table (PostgreSQL)
export const schoolTasks = pgTable('school_tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  assignedTo: text('assigned_to').notNull().default('Não atribuído'),
  department: text('department').notNull().default('Secretaria'),
  priority: text('priority').notNull().default('Normal'),
  status: text('status').notNull().default('Pendente'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  dueDate: date('due_date').notNull(),
  limitDate: date('limit_date').notNull(),
  createdAutomatically: boolean('created_automatically').default(false),
  referenceId: text('reference_id'),
  referenceType: text('reference_type'),
  observations: text('observations'),
  history: jsonb('history').default([]), // TaskHistoryEvent[]
  attachments: jsonb('attachments').default([]), // TaskAttachment[]
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  createdBy: text('created_by'),
  executedBy: text('executed_by'),
  completedBy: text('completed_by'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  dependencies: jsonb('dependencies').default([]), // string[] (precedent task IDs)
  isDeleted: boolean('is_deleted').default(false).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: text('deleted_by'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  firstResponseAt: timestamp('first_response_at', { withTimezone: true }),
  slaDeadline: timestamp('sla_deadline', { withTimezone: true }),
  slaStatus: text('sla_status').default('On Track'),
  // Phase 11 - Enterprise Multi-Tenancy
  tenantId: text('tenant_id').notNull().default('default-tenant'),
  schoolId: text('school_id').notNull().default('default-school'),
  organizationId: text('organization_id').notNull().default('default-org'),
});

// 13. Task Versions and Snapshots (Phase 11 - Advanced Audit & Snapshots for Rollbacks)
export const taskVersions = pgTable('task_versions', {
  id: serial('id').primaryKey(),
  taskId: text('task_id').notNull(),
  version: integer('version').notNull(),
  snapshot: jsonb('snapshot').notNull(), // Full JSON dump of the schoolTasks row at this specific version
  changedBy: text('changed_by').notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
  action: text('action').notNull(), // 'CREATE' | 'UPDATE' | 'RESTORE' | 'DELETE' | 'ARCHIVE'
  requestId: text('request_id'),
  correlationId: text('correlation_id'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  diff: jsonb('diff'), // JSON record detailing specific field updates
});



