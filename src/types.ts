export interface Student {
  id: string;
  name: string;
  class: string;
  attendanceRate: number;
  averageGrade: number;
  status: 'active' | 'inactive';
  outstandingFees: number;
  guardiansContact: string;
  guardiansName: string;
  behaviorDegree: 'Excelente' | 'Bom' | 'Regular' | 'Atenção';
  documents: {
    name: string;
    submitted: boolean;
    date: string;
    paymentPlan?: string;
    scholarship?: string;
    discount?: number;
    financialNotes?: string;
    financialHistory?: { date: string; amount: number; type: string; title: string; status: 'paid' | 'pending' | 'cancelled' }[];
  }[];
  behaviorHistory: { date: string; note: string; categoryDefault: string }[];
  grades: { subject: string; score: number }[];
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subjects: string[];
  classes: string[];
  productivityScore: number;
  schedule: string[];
  status: 'active' | 'inactive';
  documents?: { name: string; submitted: boolean; date: string }[];
}

export interface Invoice {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  category: 'tuition' | 'material' | 'extracurricular';
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  role: string;
  date: string;
  target: 'all' | 'teachers' | 'parents' | 'students';
}

export interface ChatMessage {
  id: string;
  sender: string;
  role: string;
  content: string;
  timestamp: string;
  channel: 'gral' | 'direction-teachers' | 'administration-secretariat';
}

export interface AutomationFlow {
  id: string;
  title: string;
  description: string;
  trigger: string;
  action: string;
  active: boolean;
  type: 'sms' | 'email' | 'system' | 'whatsapp';
  executions: number;
}

export type UserRole = 'admin' | 'director' | 'secretariat' | 'teacher' | 'parent' | 'student' | 'financial';

export interface NotificationPreset {
  category: string;
  name: string;
  description: string;
  enabled: boolean;
  allowedRoles: UserRole[];
  customTitle: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  rawTime: string;
  userRole: UserRole;
  attemptedTab: string;
  attemptedTabName: string;
  ipAddress: string;
  status: 'BLOCKED' | 'ALLOWED';
  // Enhanced attributes for security audits
  eventType?: 'LOGIN' | 'TAB_ACCESS' | 'ACTION_RUN' | 'ACTION_BLOCK';
  details?: string;
  operatorName?: string;
}

export type ApprovalStatus = 'pending' | 'analyzing' | 'approved' | 'rejected' | 'revision_requested';

export type ApprovalFlowType = 'secretariat_to_director' | 'teacher_to_director' | 'financial_to_director';

export interface ApprovalHistoryEntry {
  id: string;
  timestamp: string; // YYYY-MM-DD HH:mm:ss
  action: 'create' | 'analyze' | 'approve' | 'reject' | 'request_revision' | 'resubmit';
  userRole: UserRole;
  userName: string;
  comment: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  description: string;
  flowType: ApprovalFlowType;
  status: ApprovalStatus;
  requesterRole: UserRole;
  requesterName: string;
  createdAtDate: string; // YYYY-MM-DD
  createdAtTime: string; // HH:mm:ss
  updatedAt?: string;
  history: ApprovalHistoryEntry[];
}

export type DigitalSignatureStatus = 'draft' | 'sent' | 'signed' | 'archived';
export type DigitalSignatureDocType = 'Contrato' | 'Autorização' | 'Declaração' | 'Termo';

export interface DigitalSignatureRequest {
  id: string;
  title: string;
  documentType: DigitalSignatureDocType;
  content: string; // The text content of the document to be signed
  status: DigitalSignatureStatus;
  requesterName: string;
  requesterRole: UserRole;
  signerName: string;
  signerEmail: string;
  signerContact?: string;
  sentAtDate: string; // YYYY-MM-DD
  sentAtTime: string; // HH:mm:ss
  signedAtDate?: string; // YYYY-MM-DD
  signedAtTime?: string; // HH:mm:ss
  archivedAtDate?: string; // YYYY-MM-DD
  hash?: string; // SHA-256 style signature proof code
  ipAddress?: string; // Client IP for security log
  signatureStrokeData?: string; // SVG path data or draw coordinates for proof representability
  referenceModule?: 'documentos' | 'matriculas' | 'financeiro';
  referenceId?: string; // ID of the related model (e.g., Doc ID, Student ID, or Invoice ID)
}

export type TaskPriority = 'Baixa' | 'Normal' | 'Alta' | 'Urgente' | 'Crítica';
export type TaskState = 'Pendente' | 'Em Curso' | 'Aguardando Aprovação' | 'Concluída' | 'Cancelada' | 'Atrasada';

export interface TaskHistoryEvent {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details?: string;
}

export interface TaskAttachment {
  name: string;
  url: string;
  size?: string;
}

export interface SchoolTask {
  id: string;
  title: string;
  description: string;
  assignedTo: string; // Name of person, or "Não atribuído"
  department: 'Secretaria' | 'Financeiro' | 'Professor' | 'Direção' | 'Administrador' | 'Todos';
  priority: TaskPriority;
  status: TaskState;
  createdAt: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  limitDate: string; // YYYY-MM-DD
  createdAutomatically?: boolean;
  referenceId?: string;
  referenceType?: 'matricula' | 'documento' | 'financeiro';
  observations?: string;
  history?: TaskHistoryEvent[];
  attachments?: TaskAttachment[];
  updatedAt?: string; // YYYY-MM-DD HH:MM
  createdBy?: string;
  executedBy?: string;
  completedBy?: string;
  completedAt?: string; // YYYY-MM-DD HH:MM
  dependencies?: string[]; // Precedent task IDs
}



