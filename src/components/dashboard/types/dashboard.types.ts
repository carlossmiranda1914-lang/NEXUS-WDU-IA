import { Student, Teacher, Invoice, Announcement, ApprovalRequest, DigitalSignatureRequest, UserRole } from '../../../types';
import { SchoolDoc } from '../../SchoolDocuments';

export interface LogRecord {
  id: number;
  userId: string | null;
  userName: string;
  userRole: string;
  action: string;
  details: string;
  created_at?: string;
  timestamp?: string;
  level?: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
}

export interface TodoTask {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: string;
  status: string;
  assignedTo: string;
}

export interface DashboardProps {
  students: Student[];
  teachers: Teacher[];
  invoices: Invoice[];
  announcements: Announcement[];
  setCurrentTab: (tab: string) => void;
  onQuickAction: (actionType: string) => void;
  approvals?: ApprovalRequest[];
  signatures?: DigitalSignatureRequest[];
  schoolDocs?: SchoolDoc[];
  currentUserRole?: UserRole;
  theme?: string;
}

export interface KPIMetrics {
  totalStudents: number;
  averageGrade: string;
  averageAttendance: number;
}
