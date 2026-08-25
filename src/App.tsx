import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  GraduationCap, 
  DollarSign, 
  Megaphone, 
  Zap, 
  Sliders, 
  Sparkles, 
  Bot, 
  LayoutDashboard,
  ShieldAlert,
  Clock,
  Menu,
  X,
  UserCheck,
  Brain,
  Trophy,
  Search,
  ClipboardCheck,
  FolderOpen,
  Database,
  PenTool,
  FileSpreadsheet,
  ListTodo,
  Check,
  RefreshCw,
  Mail
} from 'lucide-react';

import { Student, Teacher, Invoice, Announcement, ChatMessage, AutomationFlow, UserRole, AuditLog, NotificationPreset, ApprovalRequest, ApprovalFlowType, DigitalSignatureRequest, DigitalSignatureDocType, SchoolTask } from './types';
import {
  supabaseConfigured,
  getLiveStudents,
  getLiveTeachers,
  getLiveInvoices,
  getLiveAnnouncements,
  getLiveMessages,
  getLiveAutomations,
  upsertLiveStudent,
  deleteLiveStudent,
  upsertLiveTeacher,
  deleteLiveTeacher,
  upsertLiveInvoice,
  upsertLiveAnnouncement,
  upsertLiveMessage,
  upsertLiveAutomation,
  getLiveLogs,
  getLiveApprovals,
  createLiveApproval,
  transitionLiveApproval,
  getLiveTasks,
  upsertLiveTask,
  deleteLiveTask
} from './supabaseClient';

import { auth, googleAuthProvider } from './lib/firebase.ts';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, updateProfile, sendPasswordResetEmail } from 'firebase/auth';

// Subcomponents - Statically Imported
import GlobalSearch from './components/GlobalSearch';
import type { SchoolDoc } from './components/SchoolDocuments';

// Subcomponents - Lazy Loaded for Code Splitting and Bundle Optimization
const Dashboard = lazy(() => import('./components/Dashboard'));
const EnrollmentOperationsWorkspace = lazy(() => import('./components/EnrollmentOperationsWorkspace'));
const TeachersList = lazy(() => import('./components/TeachersList'));
const FinancialPanel = lazy(() => import('./components/FinancialPanel'));
const CommunicationCenter = lazy(() => import('./components/CommunicationCenter'));
const SystemConfig = lazy(() => import('./components/SystemConfig'));
const AIAssistant = lazy(() => import('./components/AIAssistant'));

function FactualUnavailablePanel({ title, detail }: { title: string; detail: string }) {
  return (
    <section role="status" className="mx-auto max-w-2xl rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-zinc-100">
      <h2 className="text-lg font-semibold text-amber-200">{title}</h2>
      <p className="mt-2 text-sm text-zinc-300">{detail}</p>
    </section>
  );
}
const TeacherAI = lazy(() => import('./components/TeacherAI'));
const SchoolDocuments = lazy(() => import('./components/SchoolDocuments'));
const WorkflowsCentral = lazy(() => import('./components/WorkflowsCentral'));
const ParentPortal = lazy(() => import('./components/ParentPortal'));
const InstitutionalApprovals = lazy(() => import('./components/InstitutionalApprovals'));
const DigitalSignatureSystem = lazy(() => import('./components/DigitalSignatureSystem'));
const TasksCenter = lazy(() => import('./components/TasksCenter'));
const GoogleSheetsCenter = lazy(() => import('./components/GoogleSheetsCenter'));

function fuzzyMatches(text: string, query: string): boolean {
  if (!query) return true;
  const normText = text.toLowerCase();
  const normQuery = query.toLowerCase();
  if (normText.includes(normQuery)) return true;
  let qIdx = 0;
  let tIdx = 0;
  while (tIdx < normText.length && qIdx < normQuery.length) {
    if (normText[tIdx] === normQuery[qIdx]) qIdx++;
    tIdx++;
  }
  return qIdx === normQuery.length;
}

const TAB_NAMES: Record<string, string> = {
  dashboard: 'Painel Geral',
  students: 'Alunos & Matrículas',
  teachers: 'Corpo Docente',
  financials: 'Finanças & Contas',
  documents: 'Dossier & Processos Automáticos',
  communications: 'Comunicação',
  config: 'Definições do Sistema',
  workflows: 'Central de Processos',
  approvals: 'Aprovações Internas',
  signatures: 'Assinatura Digital',
  tasks: 'Centro de Tarefas',
  sheets: 'Google Sheets'
};

const DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['dashboard', 'students', 'teachers', 'financials', 'documents', 'communications', 'config', 'workflows', 'approvals', 'signatures', 'tasks', 'sheets'],
  director: ['dashboard', 'students', 'teachers', 'financials', 'documents', 'communications', 'config', 'workflows', 'approvals', 'signatures', 'tasks', 'sheets'],
  secretariat: ['dashboard', 'students', 'documents', 'communications', 'approvals', 'signatures', 'tasks', 'sheets'],
  financial: ['dashboard', 'financials', 'documents', 'communications', 'approvals', 'signatures', 'tasks', 'sheets'],
  teacher: ['students', 'teachers', 'documents', 'communications', 'approvals', 'signatures', 'tasks'],
  parent: ['dashboard', 'signatures', 'tasks'],
  student: ['dashboard', 'students', 'documents', 'communications', 'signatures', 'tasks']
};

export const getFriendlyRoleName = (role: UserRole): string => {
  const map: Record<UserRole, string> = {
    admin: 'Administrador',
    director: 'Diretor',
    secretariat: 'Secretaria',
    financial: 'Financeiro',
    teacher: 'Professor',
    parent: 'Encarregado',
    student: 'Aluno'
  };
  return map[role] || 'Utilizador';
};

export const TABS_LAYOUT_CONFIG: Record<string, {
  type: string;
  containerClass: string;
  description: string;
}> = {
  dashboard: {
    type: 'Painel Central Integrado',
    containerClass: "space-y-8 w-full max-w-[1600px] mx-auto",
    description: "Visão geral e monitorização de desempenho letivo, acessos rápidos e alertas."
  },
  financials: {
    type: 'Layout Financeiro Executivo',
    containerClass: "w-full max-w-[1700px] mx-auto space-y-6",
    description: "Gestão financeira de propinas, faturação e controlo administrativo de pagamentos."
  },
  students: {
    type: 'Workspace Operacional de Alunos & Matrículas',
    containerClass: "space-y-6 w-full max-w-[1600px] mx-auto",
    description: "Entradas, matrículas em curso, exceções e alunos ativos num fluxo institucional único."
  },
  teachers: {
    type: 'Layout de Lista Geral',
    containerClass: "space-y-6 w-full max-w-7xl mx-auto",
    description: "Quadro de gestão documental e de disciplinas do corpo docente da instituição."
  },
  teacher_ai: {
    type: 'Portal de Apoio Pedagógico',
    containerClass: "w-full max-w-7xl mx-auto space-y-6",
    description: "Plataforma de auxílio ao professor para planos de aula e orientação académica."
  },
  communications: {
    type: 'Painel de Avisos e Comunicação',
    containerClass: "w-full max-w-[1500px] mx-auto space-y-6",
    description: "Quadros de avisos institucionais e canais diretos de comunicação escolar."
  },
  documents: {
    type: 'Arquivo Documental Digital',
    containerClass: "space-y-6 w-full max-w-6xl mx-auto",
    description: "Pasta organizacional de atas, regulamentos, manuais e circulares administrativas."
  },
  automations: {
    type: 'Gestor de Processos Frequentes',
    containerClass: "w-full max-w-6xl mx-auto space-y-6",
    description: "Estatísticas de notificações automáticas de frequência e avisos gerais."
  },
  config: {
    type: 'Definições Gerais e Acessos',
    containerClass: "space-y-6 w-full max-w-6xl mx-auto",
    description: "Gestão de permissões de utilizadores, segurança e perfis operacionais de acesso."
  },
  copilot: {
    type: 'Orientador Académico Assistido',
    containerClass: "space-y-4 w-full max-w-4xl mx-auto",
    description: "Assistente inteligente para elaboração de resumos executivos e relatórios de progresso acadêmico."
  },
  migration: {
    type: 'Leitor de Registos Externos',
    containerClass: "space-y-6 w-full max-w-[1600px] mx-auto",
    description: "Módulo assistido de migração e estruturação inicial de dados letivos externos."
  },
  approvals: {
    type: 'Fluxos de Aprovação Interna',
    containerClass: "space-y-6 w-full max-w-6xl mx-auto",
    description: "Sistema institucional de revisões internas, autorizações e compliance corporativo."
  },
  signatures: {
    type: 'Validador de Assinaturas',
    containerClass: "space-y-6 w-full max-w-[1600px] mx-auto",
    description: "Câmara de verificação e recolhas de assinaturas digitais nos documentos escolares."
  },
  workflows: {
    type: 'Central de Processos Escolares',
    containerClass: "w-full max-w-[1600px] mx-auto space-y-6",
    description: "Orquestração de etapas letivas automatizadas (conclusões de matrícula, alertas de e-mail e emissões fiscais)."
  },
  tasks: {
    type: 'Centro de Trabalho Operacional',
    containerClass: "w-full max-w-[1600px] mx-auto space-y-6",
    description: "Centro integrado de gestão de tarefas operacionais, caixa de entrada pessoal e simulações."
  },
  sheets: {
    type: 'Sincronização & Integração de Dados',
    containerClass: "w-full max-w-[1600px] mx-auto space-y-6",
    description: "Integração oficial com Google Sheets e Google Drive para exportação e importação de alunos."
  }
};

const defaultNotificationPresets: NotificationPreset[] = [
  {
    category: 'student_updated',
    name: 'Cadastro de Aluno Atualizado',
    description: 'Silenciado por padrão. Disparado ao alterar qualificações, notas ou perfil de um aluno no sistema.',
    enabled: false,
    allowedRoles: ['admin', 'secretariat', 'teacher'],
    customTitle: 'Atualização Escolar'
  },
  {
    category: 'new_enrollment',
    name: 'Nova Matrícula Integrada',
    description: 'Alerta de sucesso enviado quando uma nova matrícula inteligente é integrada na base escolar.',
    enabled: true,
    allowedRoles: ['admin', 'secretariat', 'financial', 'director'],
    customTitle: 'Nova Matrícula Integrada'
  },
  {
    category: 'invoice_paid',
    name: 'Mensalidade Concluída',
    description: 'Mensagem de sucesso quando uma fatura é liquidada pelos encarregados de educação.',
    enabled: true,
    allowedRoles: ['admin', 'financial', 'director', 'parent'],
    customTitle: 'Mensalidade Concluída'
  },
  {
    category: 'invoice_created',
    name: 'Nova Fatura Emitida',
    description: 'Lançamento de faturas manuais e propinas automáticas emitidas pela administração.',
    enabled: true,
    allowedRoles: ['admin', 'financial', 'parent'],
    customTitle: 'Nova Fatura Emitida'
  },
  {
    category: 'invoice_cancelled',
    name: 'Fatura Cancelada',
    description: 'Alerta preventivo ao anular guias de pagamento por inconformidades contabilísticas.',
    enabled: true,
    allowedRoles: ['admin', 'financial'],
    customTitle: 'Fatura Cancelada'
  },
  {
    category: 'bank_reconciliation',
    name: 'Reconciliação Bancária Concluída',
    description: 'Resultado da conciliação em lote das receitas declaradas por extratos bancários.',
    enabled: true,
    allowedRoles: ['admin', 'financial'],
    customTitle: 'Reconciliação Concluída'
  },
  {
    category: 'document_uploaded',
    name: 'Ficheiro Recebido e Analisado',
    description: 'Processamento automático do motor OCR inteligente ao ler contratos e fichas de vacinas.',
    enabled: true,
    allowedRoles: ['admin', 'secretariat'],
    customTitle: 'Documento Recebido e Analisado'
  },
  {
    category: 'document_deleted',
    name: 'Documento Removido',
    description: 'Notificação ao administrador sobre exclusão permanente de documentos no arquivo virtual.',
    enabled: true,
    allowedRoles: ['admin', 'secretariat'],
    customTitle: 'Documento Removido'
  },
  {
    category: 'mural_announcement',
    name: 'Publicação no Mural de Avisos',
    description: 'Notifica que novos comunicados institucionais de relevância foram publicados no mural global.',
    enabled: true,
    allowedRoles: ['admin', 'director', 'teacher', 'parent', 'student'],
    customTitle: 'Mural de Avisos Coração'
  },
  {
    category: 'chat_message',
    name: 'Nova Mensagem nos Canais de Equipa',
    description: 'Avisos instantâneos de novas mensagens de texto nos canais de comunicação interna.',
    enabled: true,
    allowedRoles: ['admin', 'director', 'secretariat', 'teacher'],
    customTitle: 'Mensagem no Chat'
  },
  {
    category: 'automation_attendance',
    name: 'Ausência Registada (Fluxo Auto)',
    description: 'Alerta de frequência automático enviado preventivamente aos encarregados de educação.',
    enabled: true,
    allowedRoles: ['admin', 'director', 'secretariat', 'parent'],
    customTitle: 'Ausência Registada'
  },
  {
    category: 'automation_invoice',
    name: 'Cobrança de Fatura Expirada (Workflow Auto)',
    description: 'Avisos preventivos automáticos de regularização financeira em atraso.',
    enabled: true,
    allowedRoles: ['admin', 'financial', 'parent'],
    customTitle: 'Aviso de Pagamento'
  },
  {
    category: 'automation_enrollment',
    name: 'Provisionamento de Contas e-Learning (Workflow Auto)',
    description: 'Criação e ligação lógica de contas do aluno no LMS Moodle institucional.',
    enabled: true,
    allowedRoles: ['admin', 'secretariat'],
    customTitle: 'Matrícula Sincronizada'
  },
  {
    category: 'automation_grade',
    name: 'Alerta Preventivo de Rendimento (Workflow Auto)',
    description: 'Sinalização sob risco de insucesso escolar quando a média é crítica.',
    enabled: true,
    allowedRoles: ['admin', 'director', 'teacher', 'parent'],
    customTitle: 'Alerta Pedagógico Ativado'
  }
];

export default function App() {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [authRegisterName, setAuthRegisterName] = useState<string>('');
  const [currentUserStatus, setCurrentUserStatus] = useState<string>('active');
  const [recoveryEmail, setRecoveryEmail] = useState<string>('');
  const [recoveryError, setRecoveryError] = useState<string>('');
  const [recoverySuccess, setRecoverySuccess] = useState<string>('');
  const [sendingRecovery, setSendingRecovery] = useState<boolean>(false);

  // Access request form states for pending users
  const [requestedPhone, setRequestedPhone] = useState<string>('');
  const [requestedRole, setRequestedRole] = useState<string>('student');
  const [requestedDepartment, setRequestedDepartment] = useState<string>('Alunos');
  const [requestAccessSuccess, setRequestAccessSuccess] = useState<boolean>(false);
  const [requestAccessError, setRequestAccessError] = useState<string>('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false);

  // Email verification states
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [verificationError, setVerificationError] = useState<string>('');
  const [verificationSuccess, setVerificationSuccess] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isSendingCode, setIsSendingCode] = useState<boolean>(false);
  const [sendCodeSuccess, setSendCodeSuccess] = useState<string>('');
  const [debugCodeReceived, setDebugCodeReceived] = useState<string>('');

  const [loginStep, setLoginStep] = useState<number>(1);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('admin');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);

  // Reorganized navigation: sub-tab states for modular layout
  const [teachersSubTab, setTeachersSubTab] = useState<'list' | 'ai'>('list');
  const [documentsSubTab, setDocumentsSubTab] = useState<'list' | 'automations'>('list');
  const [configSubTab, setConfigSubTab] = useState<'settings' | 'migration'>('settings');
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [showRecoveryInfo, setShowRecoveryInfo] = useState<boolean>(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('nexus_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('nexus_theme', theme);
    const body = document.body;
    if (theme === 'light') {
      body.classList.add('light');
    } else {
      body.classList.remove('light');
    }
  }, [theme]);

  // Dynamic granular permissions state
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, string[]>>(() => {
    const saved = localStorage.getItem('nexus_role_permissions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if ((parsed.admin && parsed.admin.includes('teacher_ai')) || (parsed.parent && parsed.parent.length > 1)) {
          localStorage.setItem('nexus_role_permissions', JSON.stringify(DEFAULT_PERMISSIONS));
          return DEFAULT_PERMISSIONS;
        }
        return parsed;
      } catch (e) {
        return DEFAULT_PERMISSIONS;
      }
    }
    return DEFAULT_PERMISSIONS;
  });

  const handleUpdatePermissions = (updated: Record<UserRole, string[]>) => {
    setRolePermissions(updated);
    localStorage.setItem('nexus_role_permissions', JSON.stringify(updated));
  };

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('nexus_audit_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const handleClearAuditLogs = () => {
    setAuditLogs([]);
    localStorage.removeItem('nexus_audit_logs');
  };

  const logAuditEvent = (
    role: UserRole,
    tab: string,
    status: 'ALLOWED' | 'BLOCKED',
    eventType?: 'LOGIN' | 'TAB_ACCESS' | 'ACTION_RUN' | 'ACTION_BLOCK',
    details?: string
  ) => {
    let operatorName = 'Simulador de Perfis';
    if (firebaseUser) {
      operatorName = firebaseUser.displayName || firebaseUser.email || 'Utilizador Nexus';
    }

    const newLog: AuditLog = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString('pt-PT') + ' ' + new Date().toLocaleDateString('pt-PT'),
      rawTime: new Date().toISOString(),
      userRole: role,
      attemptedTab: tab,
      attemptedTabName: TAB_NAMES[tab] || tab,
      ipAddress: `192.168.10.${Math.floor(Math.random() * 253 + 2)}`,
      status,
      eventType: eventType || (status === 'BLOCKED' ? 'TAB_ACCESS' : 'ACTION_RUN'),
      details: details || (status === 'BLOCKED'
        ? `Tentativa de acesso não autorizada ao módulo "${TAB_NAMES[tab] || tab}" bloqueada pelo sistema.`
        : `Acesso permitido ao módulo "${TAB_NAMES[tab] || tab}".`),
      operatorName
    };

    setAuditLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 80);
      localStorage.setItem('nexus_audit_logs', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const allowedList = rolePermissions[currentUserRole] || [];
    if (!allowedList.includes(activeTab)) {
      const duplicate = auditLogs.some(l =>
        l.userRole === currentUserRole &&
        l.attemptedTab === activeTab &&
        l.status === 'BLOCKED' &&
        (Date.now() - new Date(l.rawTime).getTime() < 5000)
      );
      if (!duplicate) {
        logAuditEvent(currentUserRole, activeTab, 'BLOCKED', 'TAB_ACCESS');
      }
    } else {
      const duplicate = auditLogs.some(l =>
        l.userRole === currentUserRole &&
        l.attemptedTab === activeTab &&
        l.status === 'ALLOWED' &&
        (Date.now() - new Date(l.rawTime).getTime() < 10000)
      );
      if (!duplicate) {
        logAuditEvent(currentUserRole, activeTab, 'ALLOWED', 'TAB_ACCESS');
      }
    }
  }, [activeTab, currentUserRole, rolePermissions]);

  const handleSimulationRoleChange = async (newRole: UserRole) => {
    setCurrentUserRole(newRole);
    logAuditEvent(newRole, activeTab, 'ALLOWED', 'LOGIN', `O utilizador iniciou sessão ou trocou com sucesso para o perfil de ${newRole.toUpperCase()}.`);
    
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/profile/role', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ role: newRole })
        });
        if (res.ok) {
          console.log(`[AUTH] Profile role updated successfully in PostgreSQL to: ${newRole}`);
        } else {
          console.warn('[AUTH] Warning: Failed to update simulated role in PostgreSQL.');
        }
      } catch (err) {
        console.warn('[AUTH] Warning: Error synchronizing simulated role with backend:', err);
      }
    }
  };

  // Core School State Engine (React hydrated from local mock db)
  const [students, setStudents] = useState<Student[]>([]);

  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const visibleStudents = students.filter(student => {
    if (currentUserRole === 'student' || currentUserRole === 'parent') {
      return student.id === 'ALU-101'; // Alice Siqueira is our target student/child
    }
    if (currentUserRole === 'teacher') {
      // Teachers can only view students from their designated classes (such as "9º Ano A", "10º Ano A")
      return ['9º Ano A', '10º Ano A'].includes(student.class);
    }
    return true;
  });

  const visibleInvoices = invoices.filter(invoice => {
    if (currentUserRole === 'student' || currentUserRole === 'parent') {
      return invoice.studentId === 'ALU-101'; // Alice Siqueira is our target invoice subject
    }
    if (currentUserRole === 'teacher') {
      // Teachers have no financial visibility at all
      return false;
    }
    return true;
  });

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Real-time dynamic states
  const [notificationPresets, setNotificationPresets] = useState<NotificationPreset[]>(() => {
    const saved = localStorage.getItem('nexus_notification_presets');
    return saved ? JSON.parse(saved) : defaultNotificationPresets;
  });

  const handleUpdateNotificationPresets = (updated: NotificationPreset[]) => {
    setNotificationPresets(updated);
    localStorage.setItem('nexus_notification_presets', JSON.stringify(updated));
  };

  const [realtimeNotifications, setRealtimeNotifications] = useState<Array<{ id: string; title: string; message: string; type: 'success' | 'info' | 'warning' | 'alert'; timestamp: string }>>([]);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [automationFlows, setAutomationFlows] = useState<AutomationFlow[]>([]);

  const [schoolDocs, setSchoolDocs] = useState<SchoolDoc[]>([]);

  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);

  const [signatures, setSignatures] = useState<DigitalSignatureRequest[]>([]);

  const [tasks, setTasks] = useState<SchoolTask[]>([]);

  // Sync state engine to localstorage for instant persistence
  useEffect(() => {
    localStorage.setItem('nexus_approvals', JSON.stringify(approvals));
  }, [approvals]);

  useEffect(() => {
    localStorage.setItem('nexus_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('nexus_teachers', JSON.stringify(teachers));
  }, [teachers]);

  useEffect(() => {
    localStorage.setItem('nexus_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('nexus_announcements', JSON.stringify(announcements));
  }, [announcements]);

  useEffect(() => {
    localStorage.setItem('nexus_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('nexus_automations', JSON.stringify(automationFlows));
  }, [automationFlows]);

  useEffect(() => {
    localStorage.setItem('nexus_school_docs', JSON.stringify(schoolDocs));
  }, [schoolDocs]);

  useEffect(() => {
    localStorage.setItem('nexus_signatures', JSON.stringify(signatures));
  }, [signatures]);

  // Redefinição limpa de primeiro carregamento para destruir qualquer sessão simulada/teste anterior
  useEffect(() => {
    const isWiped = localStorage.getItem('nexus_system_reset_v4');
    if (!isWiped) {
      console.log('[SYSTEM-WIPE] Clean boot detected: clearing and signing out any active sessions...');
      signOut(auth).then(() => {
        localStorage.clear();
        localStorage.setItem('nexus_system_reset_v4', 'true');
        window.location.reload();
      }).catch((e) => {
        console.error(e);
        localStorage.clear();
        localStorage.setItem('nexus_system_reset_v4', 'true');
      });
    }
  }, []);

  const handleWipeSystemSessions = async () => {
    console.log('[SYSTEM-WIPE] Manual wipe triggered. Clearing sessions & local cache...');
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
    localStorage.clear();
    localStorage.setItem('nexus_system_reset_v4', 'true');
    window.location.reload();
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
      if (usr) {
        console.log('[AUTH-CLIENT] onAuthStateChanged active user detected:', usr.email);
        setFirebaseUser(usr);
        // Load the PostgreSQL profile role on access
        try {
          const token = await usr.getIdToken();
          console.log('[AUTH-CLIENT] onAuthStateChanged fetching PostgreSQL profile...');
          const pRes = await fetch('/api/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (pRes.ok) {
            const profile = await pRes.json();
            console.log('[AUTH-PG] Active PG user role profile loaded:', profile);
            if (profile.status === 'suspended') {
              console.warn('[AUTH-PG] Account is suspended, signing out.');
              await signOut(auth);
              setFirebaseUser(null);
              setLoginError('A sua conta está temporariamente suspensa pelo administrador pedagógico.');
            } else {
              setCurrentUserRole(profile.role);
              setCurrentUserStatus(profile.status || 'active');
            }
          } else {
            console.error('[AUTH-PG] Profile fetch failed with status:', pRes.status);
            // If the profile fetch fails (e.g. user deleted from PostgreSQL), we must sign out to remain synchronized!
            await signOut(auth);
            setFirebaseUser(null);
          }
        } catch (e) {
          console.error('[AUTH-PG] Error loading profile from Postgres:', e);
          await signOut(auth);
          setFirebaseUser(null);
        }
      } else {
        console.log('[AUTH-CLIENT] onAuthStateChanged detected signed out state.');
        setFirebaseUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Custom Event listener for granular cross-tab transitions (eg dossier -> signature)
  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        const allowedList = [
          'dashboard', 'students', 'teachers', 'financials', 'documents', 'communications', 'config', 'workflows', 'approvals', 'signatures'
        ];
        if (allowedList.includes(customEvent.detail)) {
          setActiveTab(customEvent.detail);
        }
      }
    };
    window.addEventListener('nexus-navigate-tab', handleNavigate);
    return () => window.removeEventListener('nexus-navigate-tab', handleNavigate);
  }, []);

  // Refs to avoid tearing down WebSocket connections during state updates
  const presetsRef = React.useRef(notificationPresets);
  useEffect(() => {
    presetsRef.current = notificationPresets;
  }, [notificationPresets]);

  const roleRef = React.useRef(currentUserRole);
  useEffect(() => {
    roleRef.current = currentUserRole;
  }, [currentUserRole]);

  // Real-time Event Hub WebSocket Connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    
    async function connect() {
      try {
        const token = await firebaseUser.getIdToken();
        if (!token) {
          setIsLiveConnected(false);
          return;
        }

        // The server verifies this token and derives the institution from the
        // active membership. The browser never chooses a room by itself.
        const secureWsUrl = new URL(wsUrl);
        secureWsUrl.searchParams.set('access_token', token);
        console.log('[REALTIME] Initializing authenticated institutional connection.');
        ws = new WebSocket(secureWsUrl.toString());
      } catch (error) {
        console.warn('[REALTIME] Could not obtain an authenticated connection token:', error);
        setIsLiveConnected(false);
        reconnectTimeout = setTimeout(connect, 4000);
        return;
      }
      
      ws.onopen = () => {
        console.log('[REALTIME] WebSocket connected. Live organization updates ready.');
        setIsLiveConnected(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'HEARTBEAT') {
            return;
          }
          
          if (data.type === 'NOTIFY') {
            const { title, message, alertType, category } = data.payload;
            
            // Apply customizable role & toggled notification filter policies
            let displayTitle = title;
            if (category) {
              const matchedPreset = presetsRef.current?.find(p => p.category === category);
              if (matchedPreset) {
                // Check of active states
                if (!matchedPreset.enabled) {
                  console.log(`[NOTIFY] Ignored muted alert category: ${category}`);
                  return;
                }
                // Check of roles
                const permitted = matchedPreset.allowedRoles || [];
                if (!permitted.includes(roleRef.current)) {
                  console.log(`[NOTIFY] Bypassed category ${category} because user role ${roleRef.current} is not authorized in preset:`, permitted);
                  return;
                }
                // Check of custom title override
                if (matchedPreset.customTitle) {
                  displayTitle = matchedPreset.customTitle;
                }
              }
            }

            const notId = `notif-${Math.random().toString(36).substr(2, 9)}`;
            
            // Push toast
            setRealtimeNotifications(prev => [
              {
                id: notId,
                title: displayTitle,
                message,
                type: alertType || 'info',
                timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
              },
              ...prev
            ]);
            
            // Auto timeout toast after 6 seconds
            setTimeout(() => {
              setRealtimeNotifications(prev => prev.filter(n => n.id !== notId));
            }, 6000);
          }
          
          if (data.type === 'REFRESH_DATA') {
            console.log('[REALTIME] Database alteration detected. Refreshing local states...');
            loadLiveDb();
          }

          if (data.type === 'ADD_MESSAGE') {
            const msg = data.payload;
            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }

          if (data.type === 'ADD_ANNOUNCEMENT') {
            const ann = data.payload;
            setAnnouncements(prev => {
              if (prev.some(a => a.id === ann.id)) return prev;
              return [ann, ...prev];
            });
          }

          if (data.type === 'UPDATE_STUDENT') {
            const { id, fields } = data.payload;
            setStudents(prev => prev.map(s => s.id === id ? { ...s, ...fields } : s));
          }

          if (data.type === 'UPDATE_INVOICE') {
            const { id, status } = data.payload;
            setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv));
          }

          if (data.type === 'ADD_APPROVAL') {
            const apr = data.payload;
            setApprovals(prev => {
              if (prev.some(a => a.id === apr.id)) return prev;
              return [apr, ...prev];
            });
          }

          if (data.type === 'UPDATE_APPROVAL') {
            const apr = data.payload;
            setApprovals(prev => prev.map(a => a.id === apr.id ? apr : a));
          }

          if (data.type === 'task_created') {
            const task = data.payload;
            setTasks(prev => {
              if (prev.some(t => t.id === task.id)) return prev;
              return [task, ...prev];
            });
          }

          if (data.type === 'task_updated') {
            const task = data.payload;
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...task } : t));
          }

          if (data.type === 'task_deleted') {
            const { id } = data.payload;
            setTasks(prev => prev.filter(t => t.id !== id));
          }

          // Trigger a global custom event for Dashboard.tsx or other child components to update immediately
          window.dispatchEvent(new CustomEvent('nexus-realtime-update', { detail: data }));
          
        } catch (err) {
          console.error('[REALTIME] WS Parsing Error: ', err);
        }
      };
      
      ws.onclose = () => {
        console.log('[REALTIME] WebSocket connection closed. Reconnecting in 4 seconds...');
        setIsLiveConnected(false);
        reconnectTimeout = setTimeout(connect, 4000);
      };
      
      ws.onerror = (err) => {
        console.warn('[REALTIME] Connection error (retrying):', err);
      };
    }
    
    if (firebaseUser) {
      connect();
    }
    
    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [firebaseUser]);

  const loadLiveDb = async () => {
    if (!supabaseConfigured) return;
    try {
      const [liveSt, liveTc, liveIv, liveAn, liveMs, liveAu, liveAp, liveTasks] = await Promise.all([
        getLiveStudents(),
        getLiveTeachers(),
        getLiveInvoices(),
        getLiveAnnouncements(),
        getLiveMessages(),
        getLiveAutomations(),
        getLiveApprovals(),
        getLiveTasks()
      ]);
      
      if (liveSt) setStudents(liveSt);
      if (liveTc) setTeachers(liveTc);
      if (liveIv) setInvoices(liveIv);
      if (liveAn) setAnnouncements(liveAn);
      if (liveMs) setMessages(liveMs);
      if (liveAu) setAutomationFlows(liveAu);
      if (liveAp) setApprovals(liveAp);
      if (liveTasks) setTasks(liveTasks);
      console.log("🟢 Live PostgreSQL Data loaded successfully.");
    } catch (err) {
      console.warn("⚠️ Local storage caching fallback: ", err);
    }
  };

  // Load live data from Supabase if configured, falling back quietly to localStorage if empty/offline
  useEffect(() => {
    if (!firebaseUser) return;
    loadLiveDb();
  }, [firebaseUser]);

  const handleModularLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();

    console.log('[DEBUG-AUTH-FLOW] 1. Clique no botão Login.');

    if (!email || !password) {
      setLoginError('O email e a palavra-passe são obrigatórios.');
      return;
    }

    try {
      let usrCredential;

      if (isRegistering) {
        // Real Sign Up / Registration
        console.log(`[AUTH-REAL] Creating real account for email: ${email}`);
        if (password.length < 6) {
          setLoginError('A palavra-passe deve ter pelo menos 6 caracteres.');
          return;
        }
        if (!authRegisterName.trim()) {
          setLoginError('O Nome Completo é obrigatório para registo.');
          return;
        }
        console.log('[DEBUG-AUTH-FLOW] 2. Antes de chamar createUserWithEmailAndPassword:', {
          email: email,
          passwordLength: password.length
        });
        try {
          usrCredential = await createUserWithEmailAndPassword(auth, email, password);
          if (usrCredential.user) {
            await updateProfile(usrCredential.user, { displayName: authRegisterName.trim() });
            console.log('[AUTH-REAL] Display name updated successfully in Firebase Auth');
          }
          console.log('[DEBUG-AUTH-FLOW] 3. Depois da chamada: SUCCESS');
        } catch (regErr: any) {
          console.log('[DEBUG-AUTH-FLOW] 3. Depois da chamada falhou:', {
            code: regErr.code,
            message: regErr.message,
            stack: regErr.stack
          });
          throw regErr;
        }
      } else {
        // Real Sign In
        console.log(`[AUTH-REAL] Logging in real account for email: ${email}`);
        console.log('[DEBUG-AUTH-FLOW] 2. Antes de chamar signInWithEmailAndPassword:', {
          email: email,
          passwordLength: password.length
        });

        try {
          usrCredential = await signInWithEmailAndPassword(auth, email, password);
          console.log('[DEBUG-AUTH-FLOW] 3. Depois da chamada: SUCCESS');
        } catch (signInErr: any) {
          console.log('[DEBUG-AUTH-FLOW] 3. Depois da chamada falhou:', {
            code: signInErr.code,
            message: signInErr.message,
            stack: signInErr.stack
          });
          throw signInErr;
        }
      }

      if (usrCredential && usrCredential.user) {
        console.log('[DEBUG-AUTH-FLOW] 4. Login Firebase funcionou!');
        console.log('[DEBUG-AUTH-FLOW] UID:', usrCredential.user.uid);
        console.log('[DEBUG-AUTH-FLOW] EMAIL:', usrCredential.user.email);
        const token = await usrCredential.user.getIdToken();
        console.log('[DEBUG-AUTH-FLOW] TOKEN GERADO:', token);
        
        console.log('[DEBUG-AUTH-FLOW] 5. Antes de chamar /api/profile. Authorization Header:', `Bearer ${token}`);
        const pRes = await fetch('/api/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (pRes.ok) {
          const profile = await pRes.json();
          console.log('[AUTH-CLIENT] Existing profile found in PostgreSQL:', profile);
          if (profile.status === 'suspended') {
            await signOut(auth);
            setLoginError('A sua conta está temporariamente suspensa pelo administrador pedagógico.');
            return;
          }
          setCurrentUserRole(profile.role);
          setCurrentUserStatus(profile.status || 'active');
          setFirebaseUser(usrCredential.user);
        } else {
          console.error('[AUTH-CLIENT] Failed to synchronize and verify PostgreSQL profile.');
          await signOut(auth);
          setLoginError('Falha crítica de sincronização: Não foi possível obter ou persistir o perfil do utilizador no PostgreSQL.');
        }
      }
    } catch (err: any) {
      console.warn('[DEBUG-AUTH-FLOW] 10. Exceção de autenticação tratada no frontend:', err);
      console.log('[DEBUG-AUTH-FLOW] Stack Trace do erro de autenticação:', err.stack);
      let errorMsg = 'Falha durante a autenticação. Verifique os dados introduzidos.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errorMsg = 'Credenciais incorretas ou utilizador não encontrado.';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'Este endereço de email já se encontra registado.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'A palavra-passe escolhida é demasiado fraca (mínimo de 6 caracteres).';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'O endereço de email introduzido é inválido.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMsg = 'O provedor de autenticação "E-mail/palavra-passe" não está ativado no seu novo projeto Firebase ("nexus-edu-platform"). Por favor, aceda ao Console Firebase > Authentication > separador "Método de login" (Sign-in method), clique em "Adicionar novo provedor", escolha "E-mail/palavra-passe" e ative-o para poder efetuar o registo e login de utilizadores.';
      } else {
        errorMsg = `Erro na autenticação: ${err.message || String(err)}`;
      }
      setLoginError(errorMsg);
    }
  };

  const handleSendVerificationCode = async (forceResend = false) => {
    if (!firebaseUser || !firebaseUser.email) return;
    setIsSendingCode(true);
    setSendCodeSuccess('');
    setVerificationError('');
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: firebaseUser.email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSendCodeSuccess(data.message || 'Código de confirmação enviado!');
        if (data.codePreview) {
          setDebugCodeReceived(data.codePreview);
        } else {
          setDebugCodeReceived('');
        }
      } else {
        setVerificationError(data.error || 'Falha ao enviar o código de confirmação.');
      }
    } catch (err: any) {
      console.error('[SEND-CODE-ERROR]', err);
      setVerificationError('Erro ao estabelecer ligação para envio de código.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !firebaseUser.email || !verificationCode) return;
    setIsVerifying(true);
    setVerificationError('');
    setVerificationSuccess('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: firebaseUser.email, code: verificationCode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVerificationSuccess(data.message || 'Email verificado com sucesso!');
        setVerificationCode('');
        
        // Refresh profile on backend to update the status in our React state
        const token = await firebaseUser.getIdToken();
        const pRes = await fetch('/api/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (pRes.ok) {
          const profile = await pRes.json();
          setCurrentUserStatus(profile.status);
        } else {
          window.location.reload();
        }
      } else {
        setVerificationError(data.error || 'Código incorreto ou expirado. Tente novamente.');
      }
    } catch (err: any) {
      console.error('[VERIFY-CODE-ERROR]', err);
      setVerificationError('Erro ao validar o código. Verifique a ligação de rede.');
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (firebaseUser && currentUserStatus === 'unverified_email') {
      handleSendVerificationCode();
    }
  }, [firebaseUser, currentUserStatus]);

  const handleCustomLogin = async (e: React.FormEvent) => {
    handleModularLogin(e);
  };

  const handleGoogleLogin = async () => {
    setLoginError('');
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      setLoginError('Não foi possível efetuar o login com o Google. Por favor use o formulário de email/palavra-passe.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setFirebaseUser(null);
      setLoginStep(1);
    } catch (err) {
      console.error("Error signing out:", err);
      setFirebaseUser(null);
      setLoginStep(1);
    }
  };

  const handleImportLiveDatabase = (liveData: {
    students: Student[];
    teachers: Teacher[];
    invoices: Invoice[];
    announcements: Announcement[];
    messages: ChatMessage[];
    automationFlows: AutomationFlow[];
  }) => {
    if (liveData.students && liveData.students.length > 0) setStudents(liveData.students);
    if (liveData.teachers && liveData.teachers.length > 0) setTeachers(liveData.teachers);
    if (liveData.invoices && liveData.invoices.length > 0) setInvoices(liveData.invoices);
    if (liveData.announcements && liveData.announcements.length > 0) setAnnouncements(liveData.announcements);
    if (liveData.messages && liveData.messages.length > 0) setMessages(liveData.messages);
    if (liveData.automationFlows && liveData.automationFlows.length > 0) setAutomationFlows(liveData.automationFlows);
  };

  // State Mutators
  const handleAddStudent = (newStudentData: Omit<Student, 'id'>) => {
    const id = `ALU-${Math.floor(106 + Math.random() * 900)}`;
    const student: Student = { ...newStudentData, id };
    setStudents(prev => [student, ...prev]);
    if (supabaseConfigured) {
      upsertLiveStudent(student).catch(err => console.error("Error creating student:", err));
    }

    const today = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const t1Id = `TSK-REC-${student.id}`;
    const t2Id = `TSK-VAL-${student.id}`;
    const t3Id = `TSK-APR-${student.id}`;
    const t4Id = `TSK-FIN-${student.id}`;
    const t5Id = `TSK-CRE-${student.id}`;

    // 1. Receber documentos
    const t1: SchoolTask = {
      id: t1Id,
      title: `Receber documentos de matrícula - ${student.name}`,
      description: `Coletar e organizar a ficha de matrícula assinada, documento de identificação e boletim escolar de ${student.name} (${student.id}).`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      createdBy: 'Sistema (Fluxo Matrícula)',
      referenceId: student.id,
      referenceType: 'matricula',
      dependencies: [],
      history: [
        {
          id: `H-1-${t1Id}`,
          timestamp,
          action: 'Tarefa de recepção criada automaticamente',
          user: 'Sistema (Fluxo Matrícula)',
          details: 'Primeira etapa operacional do fluxo de matrícula.'
        }
      ]
    };

    // 2. Validar documentos (Depende de T1)
    const t2: SchoolTask = {
      id: t2Id,
      title: `Validar documentos académicos - ${student.name}`,
      description: `Verificar autenticidade, histórico escolar e validade legal da documentação submetida para o aluno ${student.name} (${student.id}).`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Alta',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      createdBy: 'Sistema (Fluxo Matrícula)',
      referenceId: student.id,
      referenceType: 'matricula',
      dependencies: [t1Id],
      history: [
        {
          id: `H-1-${t2Id}`,
          timestamp,
          action: 'Tarefa de validação criada automaticamente',
          user: 'Sistema (Fluxo Matrícula)',
          details: `Dependente da recepção documental (${t1Id}).`
        }
      ]
    };

    // 3. Aprovar matrícula administrativamente (Depende de T2)
    const t3: SchoolTask = {
      id: t3Id,
      title: `Aprovar matrícula administrativamente - ${student.name}`,
      description: `Homologação formal do processo de inscrição do aluno ${student.name} (${student.id}) para atribuição de turma e dossier letivo.`,
      assignedTo: 'Direção Executiva',
      department: 'Direção',
      priority: 'Alta',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      createdBy: 'Sistema (Fluxo Matrícula)',
      referenceId: student.id,
      referenceType: 'matricula',
      dependencies: [t2Id],
      history: [
        {
          id: `H-1-${t3Id}`,
          timestamp,
          action: 'Tarefa de aprovação administrativa criada',
          user: 'Sistema (Fluxo Matrícula)',
          details: `Aguardando a validação completa de documentos (${t2Id}).`
        }
      ]
    };

    // 4. Criar plano financeiro (Depende de T3)
    const t4: SchoolTask = {
      id: t4Id,
      title: `Criar plano financeiro e propinas - ${student.name}`,
      description: `Definir regime de mensalidades, descontos aplicáveis, isenções ou bolsas de estudo para o aluno ${student.name} (${student.id}).`,
      assignedTo: 'Financeiro Executivo',
      department: 'Financeiro',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      createdBy: 'Sistema (Fluxo Matrícula)',
      referenceId: student.id,
      referenceType: 'matricula',
      dependencies: [t3Id],
      history: [
        {
          id: `H-1-${t4Id}`,
          timestamp,
          action: 'Tarefa de plano financeiro criada',
          user: 'Sistema (Fluxo Matrícula)',
          details: `Dependente da homologação formal da matrícula (${t3Id}).`
        }
      ]
    };

    // 5. Emitir credenciais de acesso (Depende de T4)
    const t5: SchoolTask = {
      id: t5Id,
      title: `Emitir credenciais de acesso - ${student.name}`,
      description: `Criar conta letiva na plataforma escolar e enviar o e-mail de boas-vindas com dados de login para o aluno/encarregado de ${student.name}.`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      createdBy: 'Sistema (Fluxo Matrícula)',
      referenceId: student.id,
      referenceType: 'matricula',
      dependencies: [t4Id],
      history: [
        {
          id: `H-1-${t5Id}`,
          timestamp,
          action: 'Tarefa de emissão de acessos criada',
          user: 'Sistema (Fluxo Matrícula)',
          details: `Ativação letiva dependente da configuração financeira do aluno (${t4Id}).`
        }
      ]
    };

    setTasks(prev => [t1, t2, t3, t4, t5, ...prev]);
    if (supabaseConfigured) {
      Promise.all([
        upsertLiveTask(t1),
        upsertLiveTask(t2),
        upsertLiveTask(t3),
        upsertLiveTask(t4),
        upsertLiveTask(t5)
      ]).catch(err => console.error("Error creating student matricula tasks:", err));
    }
  };

  const handleUpdateStudent = (id: string, updatedFields: Partial<Student>) => {
    setStudents(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...updatedFields } : s);
      const updatedSt = next.find(s => s.id === id);
      if (updatedSt && supabaseConfigured) {
        upsertLiveStudent(updatedSt).catch(err => console.error("Error updating student:", err));
      }

      // Automatically trigger approval task for Directorate if grades are modified
      if (updatedFields.grades && updatedSt) {
        const studentName = updatedSt.name;
        const today = new Date().toISOString().split('T')[0];
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const gradesTask: SchoolTask = {
          id: `TSK-AVAL-${id}-${Math.floor(100 + Math.random() * 899)}`,
          title: `Homologar notas oficiais - ${studentName}`,
          description: `Revisar e homologar a pauta de avaliação de notas submetida no diário escolar para o aluno ${studentName} (${id}).`,
          assignedTo: 'Direção Executiva',
          department: 'Direção',
          priority: 'Alta',
          status: 'Aguardando Aprovação',
          createdAt: today,
          dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
          limitDate: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString().split('T')[0],
          createdAutomatically: true,
          createdBy: 'Sistema (Fluxo Avaliações)',
          referenceId: id,
          referenceType: 'matricula',
          history: [
            {
              id: `H-1-TSK-AVAL-${id}`,
              timestamp,
              action: 'Pauta de notas registada',
              user: 'Sistema (Fluxo Avaliações)',
              details: 'Lançamento de notas de disciplinas requer homologação de pauta pela direção.'
            }
          ]
        };
        setTasks(prevTasks => [gradesTask, ...prevTasks]);
        if (supabaseConfigured) {
          upsertLiveTask(gradesTask).catch(err => console.error("Error creating grades task:", err));
        }
      }

      return next;
    });
  };

  const handleDeleteStudent = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    setInvoices(prev => prev.filter(i => i.studentId !== id));
    if (supabaseConfigured) {
      deleteLiveStudent(id).catch(err => console.error("Error deleting student:", err));
    }
  };

  const handleAddTeacher = (newTeacherData: Omit<Teacher, 'id'>) => {
    const id = `PROF-${Math.floor(105 + Math.random() * 900)}`;
    const teacher: Teacher = { ...newTeacherData, id };
    setTeachers(prev => [teacher, ...prev]);
    if (supabaseConfigured) {
      upsertLiveTeacher(teacher).catch(err => console.error("Error creating teacher:", err));
    }
  };

  const handleUpdateTeacher = (id: string, updatedFields: Partial<Teacher>) => {
    setTeachers(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...updatedFields } : t);
      const updatedT = next.find(t => t.id === id);
      if (updatedT && supabaseConfigured) {
        upsertLiveTeacher(updatedT).catch(err => console.error("Error updating teacher:", err));
      }
      return next;
    });
  };

  const handleDeleteTeacher = (id: string) => {
    setTeachers(prev => prev.filter(t => t.id !== id));
    if (supabaseConfigured) {
      deleteLiveTeacher(id).catch(err => console.error("Error deleting teacher:", err));
    }
  };

  const handleUpdateInvoiceStatus = (id: string, status: 'paid' | 'pending' | 'overdue') => {
    setInvoices(prev => {
      const nextInvoices = prev.map(i => {
        if (i.id === id) {
          const amountDiff = status === 'paid' ? -i.amount : i.amount;
          setStudents(prevStuds => {
            const nextStuds = prevStuds.map(s => {
              if (s.id === i.studentId) {
                const updatedSt = { ...s, outstandingFees: Math.max(0, s.outstandingFees + amountDiff) };
                if (supabaseConfigured) {
                  upsertLiveStudent(updatedSt).catch(err => console.error("Error syncing student outstanding fees:", err));
                }
                return updatedSt;
              }
              return s;
            });
            return nextStuds;
          });
          const updatedIv = { ...i, status };
          if (supabaseConfigured) {
            upsertLiveInvoice(updatedIv).catch(err => console.error("Error updating invoice status:", err));
          }

          // Trigger: Pagamento em atraso -> criar tarefa automática para financeiro
          if (status === 'overdue') {
            const taskId = `TSK-COB-${i.id}`;
            const today = new Date().toISOString().split('T')[0];
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
            const lateTask: SchoolTask = {
              id: taskId,
              title: `Cobrar propinas em atraso - ${i.studentName}`,
              description: `A fatura ${i.id} de €${i.amount} está em atraso desde ${i.dueDate}. Enviar notificação e contactar o encarregado.`,
              assignedTo: 'Financeiro Executivo',
              department: 'Financeiro',
              priority: 'Crítica',
              status: 'Atrasada',
              createdAt: today,
              dueDate: today,
              limitDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              createdAutomatically: true,
              createdBy: 'Sistema (Fluxo Financeiro)',
              referenceId: i.id,
              referenceType: 'financeiro',
              dependencies: [],
              history: [
                {
                  id: `H-1-${taskId}`,
                  timestamp,
                  action: 'Cobrança urgente iniciada',
                  user: 'Sistema (Fluxo Financeiro)',
                  details: `Fatura ${i.id} de valor €${i.amount} vencida em ${i.dueDate}.`
                }
              ]
            };
            setTasks(prev => [lateTask, ...prev]);
            if (supabaseConfigured) {
              upsertLiveTask(lateTask).catch(err => console.error("Error creating late payment task:", err));
            }
          }

          return updatedIv;
        }
        return i;
      });
      return nextInvoices;
    });
  };

  const handleAddInvoice = (newInv: Omit<Invoice, 'id'>) => {
    const id = `FAT-${Math.floor(8810 + Math.random() * 1000)}`;
    const invoice: Invoice = { ...newInv, id };
    setInvoices(prev => {
      setStudents(prevStuds => {
        const nextStuds = prevStuds.map(s => {
          if (s.name.toLowerCase() === newInv.studentName.toLowerCase()) {
            const updatedSt = { ...s, outstandingFees: s.outstandingFees + newInv.amount };
            if (supabaseConfigured) {
              upsertLiveStudent(updatedSt).catch(err => console.error("Error updating student outstanding fees for invoice:", err));
            }
            return updatedSt;
          }
          return s;
        });
        return nextStuds;
      });
      if (supabaseConfigured) {
        upsertLiveInvoice(invoice).catch(err => console.error("Error creating invoice:", err));
      }
      return [invoice, ...prev];
    });
  };

  const handleAddAnnouncement = (newAnn: Omit<Announcement, 'id' | 'date'>) => {
    const date = new Date().toISOString().split('T')[0];
    const id = `AVISO-${Math.floor(10 + Math.random() * 90)}`;
    const announcement: Announcement = { ...newAnn, id, date };
    setAnnouncements(prev => [announcement, ...prev]);
    if (supabaseConfigured) {
      upsertLiveAnnouncement(announcement).catch(err => console.error("Error creating announcement:", err));
    }

    // Automatically trigger task to publish across secondary communication channels
    const taskId = `TSK-COM-${id}`;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const commTask: SchoolTask = {
      id: taskId,
      title: `Divulgar anúncio nos canais secundários - ${newAnn.title}`,
      description: `Garantir que o comunicado "${newAnn.title}" seja divulgado nos canais auxiliares, grupos institucionais de WhatsApp e email geral.`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: date,
      dueDate: date,
      limitDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      createdBy: 'Sistema (Fluxo Comunicação)',
      referenceId: id,
      referenceType: 'documento',
      dependencies: [],
      history: [
        {
          id: `H-1-${taskId}`,
          timestamp,
          action: 'Tarefa de divulgação criada automaticamente',
          user: 'Sistema (Fluxo Comunicação)',
          details: `Iniciado após publicação do aviso formal ${id}.`
        }
      ]
    };
    setTasks(prev => [commTask, ...prev]);
    if (supabaseConfigured) {
      upsertLiveTask(commTask).catch(err => console.error("Error creating communication task:", err));
    }
  };

  const handleAddMessage = (newMsg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const id = `M-${Math.floor(100 + Math.random() * 900)}`;
    const message: ChatMessage = { ...newMsg, id, timestamp };
    setMessages(prev => [...prev, message]);
    if (supabaseConfigured) {
      upsertLiveMessage(message).catch(err => console.error("Error saving message:", err));
    }
  };

  const handleCreateApproval = async (title: string, description: string, flowType: ApprovalFlowType) => {
    try {
      const created = await createLiveApproval(title, description, flowType);
      setApprovals(prev => [created, ...prev]);
    } catch (err: any) {
      console.error("Error creating approval request:", err);
      throw err;
    }
  };

  const handleTransitionApproval = async (id: string, action: 'analyze' | 'approve' | 'reject' | 'request_revision' | 'resubmit', comment: string) => {
    try {
      const updated = await transitionLiveApproval(id, action, comment);
      setApprovals(prev => prev.map(a => a.id === id ? updated : a));
    } catch (err: any) {
      console.error("Error transitioning approval request:", err);
      throw err;
    }
  };

  const handleToggleFlow = (id: string) => {
    setAutomationFlows(prev => {
      const next = prev.map(f => f.id === id ? { ...f, active: !f.active } : f);
      const updatedFlow = next.find(f => f.id === id);
      if (updatedFlow && supabaseConfigured) {
        upsertLiveAutomation(updatedFlow).catch(err => console.error("Error toggling automation flow:", err));
      }
      return next;
    });
  };

  const handleSimulateFlow = (id: string) => {
    setAutomationFlows(prev => {
      const next = prev.map(f => f.id === id ? { ...f, executions: f.executions + 1 } : f);
      const updatedFlow = next.find(f => f.id === id);
      if (updatedFlow && supabaseConfigured) {
        upsertLiveAutomation(updatedFlow).catch(err => console.error("Error triggering automation run:", err));
      }
      return next;
    });
  };

  const handleBonusPointsToStudent = (id: string, amount: number) => {
    setStudents(prev => {
      const next = prev.map(s => {
        if (s.id === id) {
          return {
            ...s,
            averageGrade: Number(Math.min(10, s.averageGrade + (amount / 400)).toFixed(1))
          };
        }
        return s;
      });
      const updatedSt = next.find(s => s.id === id);
      if (updatedSt && supabaseConfigured) {
        upsertLiveStudent(updatedSt).catch(err => console.error("Error rewarding points:", err));
      }
      return next;
    });
  };

  const handleBonusPointsToTeacher = (id: string, amount: number) => {
    setTeachers(prev => {
      const next = prev.map(t => {
        if (t.id === id) {
          return {
            ...t,
            productivityScore: Math.min(100, t.productivityScore + Math.floor(amount / 50))
          };
        }
        return t;
      });
      const updatedTc = next.find(t => t.id === id);
      if (updatedTc && supabaseConfigured) {
        upsertLiveTeacher(updatedTc).catch(err => console.error("Error rewarding points:", err));
      }
      return next;
    });
  };

  const handleAddSchoolDocs = (doc: SchoolDoc) => {
    setSchoolDocs(prev => [doc, ...prev]);

    const today = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const valTaskId = `TSK-VALDOC-${doc.id}`;
    const classTaskId = `TSK-CLASSDOC-${doc.id}`;
    const aprTaskId = `TSK-APRDOC-${doc.id}`;

    // 1. Validar documento
    const valTask: SchoolTask = {
      id: valTaskId,
      title: `Validar documento - ${doc.title}`,
      description: `Verificar integridade digital, legibilidade e autenticidade do ficheiro submetido (${doc.id}).`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      createdBy: 'Sistema (Fluxo Documentos)',
      referenceId: doc.id,
      referenceType: 'documento',
      dependencies: [],
      history: [
        {
          id: `H-1-${valTaskId}`,
          timestamp,
          action: 'Tarefa de validação iniciada',
          user: 'Sistema (Fluxo Documentos)',
          details: `Iniciada automaticamente após carregamento do documento ${doc.title}.`
        }
      ]
    };

    // 2. Classificar documento (Depende de 1)
    const classTask: SchoolTask = {
      id: classTaskId,
      title: `Classificar documento - ${doc.title}`,
      description: `Arquivar, indexar e rotular digitalmente o documento "${doc.title}" nas pastas adequadas de arquivo geral de ${doc.id}.`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Baixa',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      createdBy: 'Sistema (Fluxo Documentos)',
      referenceId: doc.id,
      referenceType: 'documento',
      dependencies: [valTaskId],
      history: [
        {
          id: `H-1-${classTaskId}`,
          timestamp,
          action: 'Tarefa de classificação criada',
          user: 'Sistema (Fluxo Documentos)',
          details: `Requer a conclusão prévia da validação documental (${valTaskId}).`
        }
      ]
    };

    // 3. Aprovar documento (Depende de 2)
    const appTask: SchoolTask = {
      id: aprTaskId,
      title: `Aprovar documento - ${doc.title}`,
      description: `Homologação final e assinatura formal do diretor sobre o documento "${doc.title}" de arquivo letivo.`,
      assignedTo: 'Direção Executiva',
      department: 'Direção',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      createdBy: 'Sistema (Fluxo Documentos)',
      referenceId: doc.id,
      referenceType: 'documento',
      dependencies: [classTaskId],
      history: [
        {
          id: `H-1-${aprTaskId}`,
          timestamp,
          action: 'Tarefa de homologação de arquivo criada',
          user: 'Sistema (Fluxo Documentos)',
          details: `Dependente da classificação física e digital prévia pela secretaria (${classTaskId}).`
        }
      ]
    };

    setTasks(prev => [valTask, classTask, appTask, ...prev]);
    if (supabaseConfigured) {
      Promise.all([
        upsertLiveTask(valTask),
        upsertLiveTask(classTask),
        upsertLiveTask(appTask)
      ]).catch(err => console.error("Error creating document tasks:", err));
    }
  };

  const handleUpdateSchoolDocs = (doc: SchoolDoc) => {
    setSchoolDocs(prev => prev.map(d => d.id === doc.id ? doc : d));
  };

  const handleDeleteSchoolDocs = (id: string) => {
    setSchoolDocs(prev => prev.filter(d => d.id !== id));
  };

  const handleAddSignature = (sig: DigitalSignatureRequest) => {
    setSignatures(prev => [sig, ...prev]);
  };

  const handleUpdateSignature = (sig: DigitalSignatureRequest) => {
    setSignatures(prev => prev.map(s => s.id === sig.id ? sig : s));
  };

  const handleDeleteSignature = (id: string) => {
    setSignatures(prev => prev.filter(s => s.id !== id));
  };

  // Filter sidebar items according to executive guidelines: "Cada utilizador deve ver apenas o necessário"
  const sidebarItems = [
    { id: 'dashboard', name: 'Painel Geral', icon: LayoutDashboard },
    { id: 'tasks', name: 'Centro de Tarefas', icon: ListTodo },
    { id: 'students', name: 'Alunos & Matrículas', icon: Users },
    { id: 'teachers', name: 'Corpo Docente', icon: GraduationCap },
    { id: 'financials', name: 'Finanças & Contas', icon: DollarSign },
    { id: 'documents', name: 'Dossier & Processos Automáticos', icon: FolderOpen },
    { id: 'sheets', name: 'Google Sheets', icon: FileSpreadsheet },
    { id: 'communications', name: 'Comunicação', icon: Megaphone },
    { id: 'config', name: 'Definições', icon: Sliders },
    { id: 'workflows', name: 'Central de Processos', icon: Zap },
    { id: 'approvals', name: 'Aprovações Internas', icon: ClipboardCheck },
    { id: 'signatures', name: 'Assinatura Digital', icon: PenTool }
  ].filter(item => {
    const allowedList = rolePermissions[currentUserRole] || [];
    return allowedList.includes(item.id);
  });

  const sidebarGroups = [
    {
      title: currentUserRole === 'parent' ? "Espaço do Enc." : "Visão Geral",
      items: [
        { id: 'dashboard', name: currentUserRole === 'parent' ? 'Portal do Responsável' : 'Painel Geral', icon: LayoutDashboard },
        { id: 'tasks', name: 'Centro de Tarefas', icon: ListTodo }
      ]
    },
    {
      title: "Secretaria Escolar",
      items: [
        { id: 'students', name: 'Alunos & Matrículas', icon: Users },
        { id: 'teachers', name: 'Corpo Docente', icon: GraduationCap }
      ]
    },
    {
      title: "Administrativo",
      items: [
        { id: 'financials', name: 'Finanças & Contas', icon: DollarSign },
        { id: 'documents', name: 'Dossier & Processos Automáticos', icon: FolderOpen },
        { id: 'sheets', name: 'Google Sheets', icon: FileSpreadsheet },
        { id: 'communications', name: 'Comunicação', icon: Megaphone }
      ]
    },
    {
      title: "Processos & Execução",
      items: [
        { id: 'workflows', name: 'Central de Processos', icon: Zap },
        { id: 'approvals', name: 'Aprovações Internas', icon: ClipboardCheck },
        { id: 'signatures', name: 'Assinatura Digital', icon: PenTool }
      ]
    },
    {
      title: "Configuração",
      items: [
        { id: 'config', name: 'Definições do Sistema', icon: Sliders }
      ]
    }
  ];

  // Auto-validate active tab on role changes to satisfy granular role isolation
  useEffect(() => {
    const allowedIds = sidebarItems.map(item => item.id);
    if (!allowedIds.includes(activeTab) && allowedIds.length > 0) {
      setActiveTab(allowedIds[0]);
    }
  }, [currentUserRole, rolePermissions]);

  if (authLoading) {
    return (
      <div className={`min-h-screen ${theme === 'light' ? 'bg-[#F8FAFC]' : 'bg-zinc-950'} flex flex-col items-center justify-center font-sans`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className={`text-base font-semibold tracking-wide ${theme === 'light' ? 'text-zinc-650' : 'text-zinc-400'}`}>A estabelecer ligação segura com a Plataforma...</p>
        </div>
      </div>
    );
  }

  if (firebaseUser && currentUserStatus === 'unverified_email') {
    return (
      <div className={`min-h-screen ${theme === 'light' ? 'bg-slate-50 text-zinc-900' : 'bg-zinc-950 text-zinc-100'} flex flex-col items-center justify-center font-sans p-6 relative overflow-hidden transition-colors duration-200`}>
        {/* Abstract blur background lights */}
        <div className={`absolute top-1/4 left-1/4 -translate-y-1/2 -translate-x-1/2 w-96 h-96 ${theme === 'light' ? 'bg-indigo-400/5' : 'bg-indigo-500/10'} rounded-full blur-[120px] pointer-events-none`}></div>
        <div className={`absolute bottom-1/4 right-1/4 translate-y-1/2 translate-x-1/2 w-96 h-96 ${theme === 'light' ? 'bg-emerald-400/5' : 'bg-emerald-500/10'} rounded-full blur-[120px] pointer-events-none`}></div>

        {/* Theme Switcher Floating */}
        <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-center shadow-md ${
              theme === 'light' 
                ? 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100' 
                : 'bg-zinc-900 border-white/10 text-white hover:bg-zinc-800'
            }`}
          >
            {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          </button>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-350 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Sair / Cancelar
          </button>
        </div>

        <div className={`w-full max-w-lg ${theme === 'light' ? 'bg-white border-zinc-200 shadow-xl text-zinc-900' : 'bg-zinc-900 border-white/5 text-zinc-100'} border rounded-3xl p-8 relative z-10 space-y-6 transition-all duration-200`}>
          <div className="text-center space-y-3">
            <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${theme === 'light' ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500/10 text-indigo-400'}`}>
              <Mail className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h1 className="text-[24px] font-bold tracking-tight font-display text-zinc-900 dark:text-zinc-100">Confirme o seu E-mail</h1>
              <p className={`text-[13px] ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'} max-w-sm mx-auto leading-relaxed`}>
                Enviámos um código de confirmação de 6 dígitos para o endereço de email <strong>{firebaseUser.email}</strong>. Introduza-o abaixo para entrar no sistema.
              </p>
            </div>
          </div>

          {verificationError && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-500 font-semibold text-center leading-relaxed">
              {verificationError}
            </div>
          )}

          {sendCodeSuccess && (
            <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xs text-indigo-500 dark:text-indigo-400 font-semibold text-center leading-relaxed">
              {sendCodeSuccess}
            </div>
          )}

          {verificationSuccess && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-500 font-semibold text-center leading-relaxed">
              {verificationSuccess}
            </div>
          )}

          <form onSubmit={handleVerifyVerificationCode} className="space-y-4">
            <div className="space-y-2">
              <label className={`text-[12px] font-bold uppercase tracking-wider ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} block text-center`}>
                Código de Verificação (6 Dígitos)
              </label>
              <input
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className={`w-full text-center tracking-[12px] font-mono text-2xl h-14 ${theme === 'light' ? 'bg-slate-50 border-zinc-200 text-zinc-900 focus:bg-white focus:border-indigo-500' : 'bg-zinc-950 border-white/5 text-zinc-100 focus:border-indigo-500'} border rounded-2xl outline-none transition-all`}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || verificationCode.length !== 6}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-sm font-semibold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  A validar código...
                </>
              ) : (
                'Confirmar Código e Entrar'
              )}
            </button>
          </form>

          {/* SIMULATION HELP BOX */}
          {debugCodeReceived && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2 text-center">
              <span className="text-xs font-bold text-amber-500 uppercase tracking-wide block">Ambiente de Demonstração / Testes</span>
              <p className="text-xs text-zinc-400 leading-normal">
                Como as credenciais de SMTP não estão ativas neste contentor, apresentamos o código de email gerado para facilitar os testes:
              </p>
              <div className="inline-block bg-zinc-950 border border-white/10 rounded-xl px-4 py-1.5 font-mono text-lg font-bold text-amber-400 tracking-wider">
                {debugCodeReceived}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 text-xs pt-2">
            <span className={theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}>Não recebeu o código?</span>
            <button
              type="button"
              disabled={isSendingCode}
              onClick={() => handleSendVerificationCode(true)}
              className="text-indigo-500 hover:text-indigo-400 font-semibold cursor-pointer flex items-center gap-1 hover:underline disabled:opacity-50"
            >
              {isSendingCode ? 'A reenviar...' : 'Reenviar Código'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (firebaseUser && currentUserStatus === 'pending') {
    return (
      <div className={`min-h-screen ${theme === 'light' ? 'bg-slate-50 text-zinc-900' : 'bg-zinc-950 text-zinc-100'} flex flex-col items-center justify-center font-sans p-6 relative overflow-hidden transition-colors duration-200`}>
        {/* Abstract blur background lights */}
        <div className={`absolute top-1/4 left-1/4 -translate-y-1/2 -translate-x-1/2 w-96 h-96 ${theme === 'light' ? 'bg-indigo-400/5' : 'bg-indigo-500/10'} rounded-full blur-[120px] pointer-events-none`}></div>
        <div className={`absolute bottom-1/4 right-1/4 translate-y-1/2 translate-x-1/2 w-96 h-96 ${theme === 'light' ? 'bg-emerald-400/5' : 'bg-emerald-500/10'} rounded-full blur-[120px] pointer-events-none`}></div>

        {/* Theme Switcher Floating */}
        <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-center shadow-md ${
              theme === 'light' 
                ? 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100' 
                : 'bg-zinc-900 border-white/10 text-white hover:bg-zinc-800'
            }`}
          >
            {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          </button>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl text-xs font-semibold"
          >
            Sair
          </button>
        </div>

        <div className={`w-full max-w-lg ${theme === 'light' ? 'bg-white border-zinc-200 shadow-xl text-zinc-900' : 'bg-zinc-900 border-white/5 text-zinc-100'} border rounded-3xl p-8 relative z-10 space-y-6 transition-all duration-200`}>
          <div className="text-center space-y-3">
            <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${theme === 'light' ? 'bg-amber-50 text-amber-600' : 'bg-amber-500/10 text-amber-400'}`}>
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h1 className="text-[24px] font-bold tracking-tight font-display text-zinc-900 dark:text-zinc-100">Acesso Pendente de Aprovação</h1>
              <p className={`text-[13px] ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'} max-w-sm mx-auto leading-relaxed`}>
                Olá, <strong>{firebaseUser.displayName || firebaseUser.email}</strong>. A sua conta real foi registada com sucesso, mas necessita de aprovação da Direção Escolar para aceder aos recursos da plataforma.
              </p>
            </div>
          </div>

          {requestAccessSuccess ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3"
            >
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <Check className="w-4 h-4" /> Solicitação de Acesso Enviada!
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                O seu pedido para o cargo de <strong>{requestedRole === 'teacher' ? 'Professor' : requestedRole === 'parent' ? 'Encarregado de Educação' : requestedRole === 'financial' ? 'Financeiro' : requestedRole === 'secretariat' ? 'Secretaria' : requestedRole === 'director' ? 'Diretor' : 'Aluno'}</strong> foi registado com sucesso no departamento de <strong>{requestedDepartment}</strong>.
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Por favor, aguarde que o administrador (carlossmiranda1914@gmail.com) ative a sua conta. Pode recarregar esta página para verificar o estado da sua conta.
              </p>
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={async () => {
                    // Refresh status
                    try {
                      const token = await firebaseUser.getIdToken();
                      const pRes = await fetch('/api/profile', {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      if (pRes.ok) {
                        const profile = await pRes.json();
                        setCurrentUserStatus(profile.status || 'active');
                        setCurrentUserRole(profile.role);
                      }
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Verificar Estado
                </button>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-zinc-500 hover:text-zinc-350 underline"
                >
                  Utilizar outra conta
                </button>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmittingRequest(true);
              setRequestAccessError('');
              try {
                const token = await firebaseUser.getIdToken();
                const res = await fetch('/api/profile/request-access', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    name: firebaseUser.displayName || authRegisterName || firebaseUser.email.split('@')[0],
                    phone: requestedPhone,
                    role: requestedRole,
                    department: requestedDepartment
                  })
                });

                if (res.ok) {
                  setRequestAccessSuccess(true);
                } else {
                  const data = await res.json();
                  setRequestAccessError(data.error || 'Falha ao submeter a solicitação de acesso.');
                }
              } catch (err: any) {
                setRequestAccessError(err.message || 'Erro de rede ao submeter o pedido.');
              } finally {
                setIsSubmittingRequest(false);
              }
            }} className="space-y-4">
              <div className="bg-zinc-950/40 p-4 border border-zinc-800/60 rounded-2xl space-y-2">
                <p className="text-xs font-semibold text-indigo-400">Dados do Registo:</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <div>Email: <span className="font-mono text-zinc-300">{firebaseUser.email}</span></div>
                  <div>Nome: <span className="font-mono text-zinc-300">{firebaseUser.displayName || 'Não definido'}</span></div>
                </div>
              </div>

              {requestAccessError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl font-medium">
                  {requestAccessError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300 block">Número de Telemóvel / Contacto</label>
                <input
                  type="text"
                  value={requestedPhone}
                  onChange={(e) => setRequestedPhone(e.target.value)}
                  placeholder="Ex: +351 912 345 678"
                  className={`w-full h-10 ${theme === 'light' ? 'bg-slate-50 border-zinc-200 text-zinc-900 focus:bg-white focus:border-indigo-500' : 'bg-zinc-950 border-white/5 text-zinc-100 focus:border-indigo-500'} border rounded-xl px-3 text-xs outline-none transition-all`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300 block">Cargo Solicitado</label>
                  <select
                    value={requestedRole}
                    onChange={(e) => {
                      setRequestedRole(e.target.value);
                      // Auto-select department
                      const mapping: Record<string, string> = {
                        student: 'Alunos',
                        parent: 'Acompanhamento',
                        teacher: 'Professorado',
                        financial: 'Financeiro',
                        secretariat: 'Secretaria',
                        director: 'Direção'
                      };
                      if (mapping[e.target.value]) {
                        setRequestedDepartment(mapping[e.target.value]);
                      }
                    }}
                    className={`w-full h-10 ${theme === 'light' ? 'bg-slate-50 border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-white/5 text-zinc-100'} border rounded-xl px-3 text-xs outline-none cursor-pointer`}
                  >
                    <option value="student">Aluno</option>
                    <option value="parent">Responsável (Encarregado)</option>
                    <option value="teacher">Professor</option>
                    <option value="financial">Colaborador Financeiro</option>
                    <option value="secretariat">Colaborador de Secretaria</option>
                    <option value="director">Diretor / Gestor</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300 block">Departamento</label>
                  <select
                    value={requestedDepartment}
                    onChange={(e) => setRequestedDepartment(e.target.value)}
                    className={`w-full h-10 ${theme === 'light' ? 'bg-slate-50 border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-white/5 text-zinc-100'} border rounded-xl px-3 text-xs outline-none cursor-pointer`}
                  >
                    <option value="Alunos">Alunos</option>
                    <option value="Acompanhamento">Acompanhamento</option>
                    <option value="Professorado">Professorado</option>
                    <option value="Financeiro">Financeiro</option>
                    <option value="Secretaria">Secretaria</option>
                    <option value="Direção">Direção</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingRequest}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-zinc-700 text-white rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer shadow-lg shadow-indigo-600/10 text-center flex items-center justify-center gap-2"
              >
                {isSubmittingRequest ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Enviando Pedido de Acesso...
                  </>
                ) : (
                  'Submeter Pedido de Acesso Real'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className={`min-h-screen ${theme === 'light' ? 'bg-slate-50 text-zinc-900' : 'bg-zinc-950 text-zinc-100'} flex flex-col items-center justify-center font-sans p-6 relative overflow-hidden transition-colors duration-200`}>
        {/* Abstract blur background lights */}
        <div className={`absolute top-1/4 left-1/4 -translate-y-1/2 -translate-x-1/2 w-96 h-96 ${theme === 'light' ? 'bg-indigo-400/5' : 'bg-indigo-500/10'} rounded-full blur-[120px] pointer-events-none`}></div>
        <div className={`absolute bottom-1/4 right-1/4 translate-y-1/2 translate-x-1/2 w-96 h-96 ${theme === 'light' ? 'bg-emerald-400/5' : 'bg-emerald-500/10'} rounded-full blur-[120px] pointer-events-none`}></div>

        {/* Theme Switcher Floating */}
        <div className="absolute top-6 right-6 z-50">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-center shadow-md ${
              theme === 'light' 
                ? 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100' 
                : 'bg-zinc-900 border-white/10 text-white hover:bg-zinc-800'
            }`}
          >
            {theme === 'dark' ? (
              <span className="flex items-center gap-2 text-xs font-semibold font-mono tracking-wide">
                <svg className="w-4 h-4 text-amber-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.344l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
                Modo Claro
              </span>
            ) : (
              <span className="flex items-center gap-2 text-xs font-semibold font-mono tracking-wide">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                Modo Escuro
              </span>
            )}
          </button>
        </div>

        <div className={`w-full max-w-md ${theme === 'light' ? 'bg-white border-zinc-200 shadow-xl text-zinc-900' : 'bg-zinc-900 border-white/5 text-zinc-100'} border rounded-3xl p-8 relative z-10 space-y-6 transition-all duration-200`}>
          <div className="text-center space-y-3">
            <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${theme === 'light' ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500/10 text-indigo-400'}`}>
              <GraduationCap className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h1 className="text-[28px] font-bold tracking-tight font-display text-zinc-900 dark:text-zinc-100">Nexus Edu AI</h1>
              <p className={`text-[14px] ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'} max-w-xs mx-auto`}>
                Plataforma Escolar Inteligente e Gestão Unificada
              </p>
            </div>
          </div>

          {/* REAL AUTHENTICATION SWITCHER */}
          <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(false);
                setLoginError('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                !isRegistering
                  ? (theme === 'light' ? 'bg-white shadow-sm text-indigo-600' : 'bg-zinc-900 text-indigo-400')
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              Iniciar Sessão
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegistering(true);
                setLoginError('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                isRegistering
                  ? (theme === 'light' ? 'bg-white shadow-sm text-indigo-600' : 'bg-zinc-900 text-indigo-400')
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              Criar Conta Real
            </button>
          </div>

          {loginError && (
            <div className="space-y-3">
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-500 font-semibold text-center leading-relaxed">
                {loginError}
              </div>
            </div>
          )}

          <form onSubmit={handleModularLogin} className="space-y-5">
            {isRegistering && (
              <div className="space-y-2 animate-fade-in">
                <label className={`text-[14px] font-semibold tracking-wide ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'} block`}>
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={authRegisterName}
                  onChange={(e) => setAuthRegisterName(e.target.value)}
                  placeholder="Insira o seu nome real completo"
                  className={`w-full h-11 ${theme === 'light' ? 'bg-slate-50 border-zinc-200 text-zinc-900 focus:bg-white focus:border-indigo-500' : 'bg-zinc-950 border-white/5 text-zinc-100 focus:border-indigo-500'} border rounded-xl px-4 text-base outline-none transition-all`}
                  required={isRegistering}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className={`text-[14px] font-semibold tracking-wide ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'} block`}>
                Endereço de Email
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="exemplo@nexus.edu"
                className={`w-full h-11 ${theme === 'light' ? 'bg-slate-50 border-zinc-200 text-zinc-900 focus:bg-white focus:border-indigo-500' : 'bg-zinc-950 border-white/5 text-zinc-100 focus:border-indigo-500'} border rounded-xl px-4 text-base outline-none transition-all`}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className={`text-[14px] font-semibold tracking-wide ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'} block`}>
                  Palavra-passe
                </label>
              </div>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Insira a sua senha"
                className={`w-full h-11 ${theme === 'light' ? 'bg-slate-50 border-zinc-200 text-zinc-900 focus:bg-white focus:border-indigo-500' : 'bg-zinc-950 border-white/5 text-zinc-100 focus:border-indigo-500'} border rounded-xl px-4 text-base outline-none transition-all`}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-[16px] tracking-wide transition-all cursor-pointer shadow-lg shadow-indigo-600/10 text-center flex items-center justify-center font-semibold"
            >
              {isRegistering ? 'Criar Nova Conta Real' : 'Entrar na Plataforma'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowRecoveryInfo(true)}
                className={`text-[13px] font-medium hover:underline cursor-pointer ${theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'}`}
              >
                Recuperar acesso
              </button>
            </div>
          </form>
        </div>

        {/* RECOVERY MODAL */}
        <AnimatePresence>
          {showRecoveryInfo && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[99999]">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`w-full max-w-md ${theme === 'light' ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-zinc-100'} p-6 rounded-2xl border ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'} space-y-4`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${theme === 'light' ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500/10 text-indigo-400'}`}>
                    <Mail className="w-6 h-6" />
                  </div>
                  <h3 className="text-[20px] font-bold font-display">Recuperação de Acesso</h3>
                </div>

                {recoverySuccess ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs leading-relaxed">
                      {recoverySuccess}
                    </div>
                    <p className="text-[12px] text-zinc-400">
                      Após redefinir a palavra-passe no link enviado, tente iniciar sessão novamente com as novas credenciais.
                    </p>
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => {
                          setShowRecoveryInfo(false);
                          setRecoverySuccess('');
                          setRecoveryEmail('');
                        }}
                        className="h-10 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm cursor-pointer transition-all"
                      >
                        Voltar ao Login
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setRecoveryError('');
                    setRecoverySuccess('');
                    setSendingRecovery(true);
                    try {
                      const emailToRecover = (recoveryEmail || loginEmail).trim().toLowerCase();
                      if (!emailToRecover) {
                        setRecoveryError('Por favor, introduza o seu endereço de email.');
                        return;
                      }
                      await sendPasswordResetEmail(auth, emailToRecover);
                      setRecoverySuccess(`E-mail de recuperação enviado com sucesso para: ${emailToRecover}`);
                    } catch (err: any) {
                      console.error('[RECOVERY-ERROR]', err);
                      let errorMsg = 'Erro ao enviar o email de recuperação. Verifique se o endereço está correto.';
                      if (err.code === 'auth/user-not-found') {
                        errorMsg = 'Nenhum utilizador registado com este endereço de email.';
                      } else if (err.code === 'auth/invalid-email') {
                        errorMsg = 'O endereço de email introduzido é inválido.';
                      }
                      setRecoveryError(errorMsg);
                    } finally {
                      setSendingRecovery(false);
                    }
                  }} className="space-y-4">
                    <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Introduza o seu email registado abaixo para receber um link oficial de redefinição de palavra-passe do Firebase Auth.
                    </p>

                    {recoveryError && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl font-medium">
                        {recoveryError}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-300 block">Endereço de Email</label>
                      <input
                        type="email"
                        value={recoveryEmail || loginEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="Ex: exemplo@nexus.edu"
                        className={`w-full h-10 ${theme === 'light' ? 'bg-slate-50 border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-white/5 text-zinc-100'} border rounded-xl px-3 text-xs outline-none`}
                        required
                      />
                    </div>

                    <div className="pt-2 flex justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowRecoveryInfo(false);
                          setRecoveryError('');
                          setRecoverySuccess('');
                        }}
                        className={`h-10 px-4 ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-zinc-750' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'} font-semibold rounded-xl text-xs cursor-pointer transition-all`}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={sendingRecovery}
                        className="h-10 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white font-semibold rounded-xl text-xs cursor-pointer transition-all flex items-center justify-center gap-2"
                      >
                        {sendingRecovery ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          'Enviar Link de Recuperação Real'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div ref={constraintsRef} id="nexus_container" className={`min-h-screen ${theme === 'light' ? 'bg-slate-50 text-zinc-800' : 'bg-zinc-950 text-zinc-105'} flex flex-col font-sans selection:bg-indigo-500/10 transition-colors duration-200`}>
      
      {/* HEADER PRINCIPAL (Sleek Minimalist Theme) */}
      <header className={`h-20 ${theme === 'light' ? 'bg-white border-b border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-b border-white/5 text-white'} flex items-center justify-between px-6 md:px-10 sticky top-0 z-50 backdrop-blur-md`}>
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            N
          </div>
          <div>
            <h1 className={`text-base font-bold font-display tracking-tight ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
              Nexus Edu
            </h1>
            <p className={`text-[11px] ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'} mt-0.5 leading-none`}>Portal Escolar</p>
          </div>
        </div>

        {/* FUZZY GLOBAL SEARCH BAR */}
        <div className="hidden lg:flex flex-1 max-w-sm mx-8">
          <GlobalSearch
            students={students}
            teachers={teachers}
            invoices={invoices}
            announcements={announcements}
            messages={messages}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            theme={theme}
            onUpdateStudent={(id, updatedFields) => {
              const std = students.find(s => s.id === id);
              if (std) {
                const updatedStd = { ...std, ...updatedFields };
                setStudents(prev => prev.map(s => s.id === id ? updatedStd : s));
                upsertLiveStudent(updatedStd);
              }
            }}
          />
        </div>

        {/* Minimalist Profile & Controls */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                theme === 'light'
                  ? 'bg-zinc-100 border-zinc-200 text-zinc-750 hover:bg-zinc-200'
                  : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-zinc-800'
              }`}
              title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.344l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <div className="flex flex-col items-end">
              <span className={`text-[12px] font-sans ${theme === 'light' ? 'text-zinc-650 font-medium' : 'text-zinc-300'} tracking-tight`}>
                {firebaseUser?.email || 'admin@nexus.edu'}
              </span>
              <div className={`flex items-center gap-1 text-[10px] font-sans ${theme === 'light' ? 'text-zinc-550' : 'text-white/40'} mt-0.5`}>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                <span className={`font-bold uppercase text-[10px] ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>{getFriendlyRoleName(currentUserRole)}</span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className={`px-3-5 py-2.0 ${theme === 'light' ? 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-rose-50 hover:text-rose-600' : 'bg-zinc-850 border-white/5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400'} rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer`}
            >
              Sair
            </button>
          </div>
        </div>

        {/* Hamburguer Mobile */}
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          className={`md:hidden p-1.5 rounded border ${theme === 'light' ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-700' : 'border-white/10 hover:bg-zinc-805 text-zinc-300 hover:text-white'} cursor-pointer`}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* CORE FRAME LAYOUT */}
      <div className="flex-1 flex relative">
        
        {/* SIDEBAR DESKTOP */}
        <aside className={`hidden md:flex flex-col w-64 ${theme === 'light' ? 'bg-white border-r border-zinc-200' : 'bg-zinc-900 border-r border-white/5'} p-4 select-none justify-between h-[calc(100vh-80px)] sticky top-[80px]`}>
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            {sidebarGroups.map(group => {
              const allowedItems = group.items.filter(item => {
                const allowedList = rolePermissions[currentUserRole] || [];
                return allowedList.includes(item.id);
              });

              if (allowedItems.length === 0) return null;

              return (
                <div key={group.title} className="space-y-1">
                  <span className={`text-[9px] font-bold tracking-[0.2em] ${theme === 'light' ? 'text-zinc-550' : 'text-white/40'} uppercase font-mono block px-2.5 mb-1.5`}>
                    {group.title}
                  </span>
                  {allowedItems.map(item => {
                    const IconComp = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                          isActive 
                            ? theme === 'light'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-sm'
                              : 'bg-white/5 text-white border border-white/10'
                            : theme === 'light'
                            ? 'text-zinc-650 hover:bg-zinc-100 hover:text-zinc-900'
                            : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <IconComp className={`w-4 h-4 shrink-0 ${
                          isActive
                            ? theme === 'light'
                              ? 'text-indigo-600'
                              : 'text-white'
                            : theme === 'light'
                              ? 'text-zinc-500'
                              : 'text-zinc-400'
                        }`} />
                        <span className="font-sans">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>

        {/* SIDEBAR MOBILE OVERLAY */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className={`md:hidden fixed top-[80px] bottom-0 left-0 w-64 ${
                theme === 'light' ? 'bg-white border-r border-zinc-200' : 'bg-zinc-900 border-r border-white/5'
              } z-40 p-4 flex flex-col justify-between shadow-2xl overflow-y-auto`}
            >
              <div className="space-y-4">
                {/* Mobile Fuzzy Search Input */}
                <div className="px-2.5 mb-2 relative">
                  <span className={`text-[10px] font-mono ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'} uppercase tracking-widest block mb-2`}>Procurar Global</span>
                  <GlobalSearch
                    students={students}
                    teachers={teachers}
                    invoices={invoices}
                    announcements={announcements}
                    messages={messages}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    theme={theme}
                    onUpdateStudent={(id, updatedFields) => {
                      const std = students.find(s => s.id === id);
                      if (std) {
                        const updatedStd = { ...std, ...updatedFields };
                        setStudents(prev => prev.map(s => s.id === id ? updatedStd : s));
                        upsertLiveStudent(updatedStd);
                      }
                    }}
                  />
                </div>

                <div className="space-y-4">
                  {sidebarGroups.map(group => {
                    const allowedItems = group.items.filter(item => {
                      const allowedList = rolePermissions[currentUserRole] || [];
                      return allowedList.includes(item.id);
                    });

                    if (allowedItems.length === 0) return null;

                    return (
                      <div key={group.title} className="space-y-1">
                        <span className={`text-[9.5px] font-bold tracking-wider ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'} uppercase font-mono block px-2.5 mb-1`}>
                          {group.title}
                        </span>
                        {allowedItems.map(item => {
                          const IconComp = item.icon;
                          const isActive = activeTab === item.id;

                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id);
                                setIsMobileMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                                isActive 
                                  ? theme === 'light'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : 'bg-zinc-800 text-zinc-100 border border-zinc-700/50'
                                  : theme === 'light'
                                  ? 'text-zinc-650 hover:bg-zinc-100'
                                  : 'text-zinc-400 hover:bg-zinc-850 hover:text-white'
                              }`}
                            >
                              <IconComp className="w-4 h-4 shrink-0" />
                              <span className="font-sans">{item.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={`p-3 rounded-lg border text-[9px] leading-relaxed space-y-0.5 ${
                theme === 'light' ? 'bg-slate-50 border-zinc-200 text-zinc-500' : 'bg-zinc-950 border-zinc-850 text-zinc-550'
              } mt-4`}>
                <p className="font-semibold">Tenant: lisboa_central_01</p>
                <p className="text-emerald-500 font-mono">● Online via Edge CDN</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* VISOR PRINCIPAL DE CONTEÚDO */}
        <main className={`flex-1 p-6 md:p-8 min-h-[calc(100vh-80px)] overflow-x-hidden ${theme === 'light' ? 'bg-slate-50' : 'bg-zinc-950'} relative`}>
          
          {/* Teacher-only sub-navigation. Alunos & Matrículas is now one operational workspace. */}
          {activeTab === 'teachers' && (
            <div className={`flex flex-wrap items-center gap-1.5 border-b pb-4 mb-6 ${theme === 'light' ? 'border-zinc-200' : 'border-white/5'}`}>
              <button
                onClick={() => setTeachersSubTab('list')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  teachersSubTab === 'list'
                    ? theme === 'light' ? 'bg-indigo-50 text-indigo-700' : 'bg-white/10 text-white'
                    : theme === 'light' ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                Lista de Professores
              </button>
              <button
                onClick={() => setTeachersSubTab('ai')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  teachersSubTab === 'ai'
                    ? theme === 'light' ? 'bg-indigo-50 text-indigo-700' : 'bg-white/10 text-white'
                    : theme === 'light' ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                IA Pedagógica (Planos & Provas)
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {!(rolePermissions[currentUserRole] || []).includes(activeTab) ? (
                <div className={`p-10 text-center space-y-6 max-w-lg mx-auto border rounded-2xl shadow-xl mt-12 animate-fadeIn ${
                  theme === 'light' 
                    ? 'bg-white border-red-200 text-zinc-800' 
                    : 'bg-zinc-900/80 border-red-500/10 text-zinc-200'
                }`}>
                  <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                    <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold font-display text-red-500">Módulo de Acesso Restrito</h3>
                    <p className={`text-[16px] leading-relaxed ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-300'}`}>
                      Desculpe, o perfil de utilizador <strong>{getFriendlyRoleName(currentUserRole)}</strong> não está autorizado para visualizar esta secção ou o seu privilégio foi suspenso pela administração escolar.
                    </p>
                  </div>
                  <div className={`text-[14px] p-4 rounded-xl border leading-relaxed text-left space-y-2 ${
                    theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-600' : 'bg-zinc-950 border-zinc-850 text-zinc-400'
                  }`}>
                    <p><strong>Estado:</strong> Acesso Bloqueado</p>
                    <p><strong>Secção de destino:</strong> {TAB_NAMES[activeTab] || activeTab}</p>
                    <p><strong>Data de tentativa:</strong> {new Date().toLocaleDateString('pt-PT')} às {new Date().toLocaleTimeString('pt-PT')}</p>
                    <p className="text-[12px] border-t pt-2 mt-2 border-zinc-200/50">Caso necessite de aceder a esta funcionalidade, por favor contacte o Administrador do agrupamento para atualizar as definições de privilégios.</p>
                  </div>
                </div>
              ) : (
                <Suspense fallback={
                  <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                    <p className={`text-xs font-semibold ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'} animate-pulse`}>Carregando módulo inteligente...</p>
                  </div>
                }>
                  <>
                    {activeTab === 'dashboard' && (
                    currentUserRole === 'parent' ? (
                      <FactualUnavailablePanel
                        title="Portal de encarregados indisponível"
                        detail="Este portal ainda não possui uma ligação institucional autorizada aos registos, mensagens ou documentos. Nenhum dado foi submetido ou alterado."
                      />
                    ) : (
                      <Dashboard 
                        students={visibleStudents} 
                        teachers={teachers} 
                        invoices={visibleInvoices} 
                        announcements={announcements}
                        setCurrentTab={setActiveTab}
                        onQuickAction={(type) => {
                          if (type === 'add-student') {
                            setActiveTab('students');
                          }
                        }}
                        approvals={approvals}
                        signatures={signatures}
                        schoolDocs={schoolDocs}
                        currentUserRole={currentUserRole}
                        theme={theme}
                      />
                    )
                  )}
                  
                  {activeTab === 'students' && (
                    <EnrollmentOperationsWorkspace theme={theme} />
                  )}

                  {activeTab === 'teachers' && (
                    <>
                      {teachersSubTab === 'list' && (
                        <FactualUnavailablePanel
                          title="Administração de docentes indisponível"
                          detail="A gestão legada de docentes não está ligada a uma autoridade institucional autorizada. Nenhum registo foi criado, atualizado ou eliminado."
                        />
                      )}
                      
                      {teachersSubTab === 'ai' && (
                        <TeacherAI 
                          students={visibleStudents}
                          teachers={teachers}
                        />
                      )}
                    </>
                  )}

                  {activeTab === 'financials' && (
                    <FinancialPanel 
                      invoices={visibleInvoices}
                      students={students}
                      onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
                      onAddInvoice={handleAddInvoice}
                      globalSearchTerm={globalSearchQuery}
                    />
                  )}

                  {activeTab === 'communications' && (
                    <CommunicationCenter 
                      announcements={announcements}
                      messages={messages}
                      currentUserRole={currentUserRole}
                      onAddAnnouncement={handleAddAnnouncement}
                      onAddMessage={handleAddMessage}
                      notificationPresets={notificationPresets}
                      onUpdateNotificationPresets={handleUpdateNotificationPresets}
                    />
                  )}

                  {activeTab === 'documents' && (
                    <FactualUnavailablePanel
                      title="Arquivo documental genérico indisponível"
                      detail="Este arquivo não possui uma autoridade institucional conjunta para metadata e armazenamento. Nenhum documento foi criado, alterado, descarregado ou eliminado. Os Documentos de Matrícula canónicos permanecem no fluxo de Matrículas."
                    />
                  )}

                  {activeTab === 'workflows' && (
                    <FactualUnavailablePanel
                      title="Automação e fluxos indisponíveis"
                      detail="Os fluxos apresentados não estão ligados a uma autoridade institucional de execução. Nenhuma mensagem foi enviada, conta criada, pagamento alterado ou processo iniciado."
                    />
                  )}

                  {activeTab === 'approvals' && (
                    <InstitutionalApprovals
                      currentUserRole={currentUserRole}
                      currentUserName={firebaseUser?.displayName || firebaseUser?.email || 'Administrador'}
                      approvals={approvals}
                      onCreateApproval={handleCreateApproval}
                      onTransitionApproval={handleTransitionApproval}
                      isLoading={approvalsLoading}
                    />
                  )}

                  {activeTab === 'signatures' && (
                    <FactualUnavailablePanel
                      title="Assinaturas digitais indisponíveis"
                      detail="Não existe uma autoridade institucional de assinatura, arquivo ou envio neste ambiente. Nenhuma assinatura, certificado ou pedido foi emitido."
                    />
                  )}

                  {activeTab === 'tasks' && (
                    <TasksCenter 
                      tasks={tasks}
                      setTasks={setTasks}
                      currentUserRole={currentUserRole}
                      theme={theme}
                    />
                  )}

                  {activeTab === 'sheets' && (
                    <GoogleSheetsCenter 
                      students={students}
                      setStudents={setStudents}
                      invoices={invoices}
                      theme={theme}
                    />
                  )}

                  {activeTab === 'config' && (
                    <SystemConfig 
                      currentRole={currentUserRole}
                      onRoleChange={handleSimulationRoleChange}
                      students={students}
                      teachers={teachers}
                      invoices={invoices}
                      announcements={announcements}
                      messages={messages}
                      automationFlows={automationFlows}
                      onImportLiveDatabase={handleImportLiveDatabase}
                      rolePermissions={rolePermissions}
                      onUpdatePermissions={handleUpdatePermissions}
                      auditLogs={auditLogs}
                      onClearAuditLogs={handleClearAuditLogs}
                      firebaseUser={firebaseUser}
                      onWipeSystem={handleWipeSystemSessions}
                    />
                  )}
                </>
                </Suspense>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* FLOATING DRAGGABLE COPILOT TOGGLE TRIGGER BUTTON */}
      <motion.button
        id="copilot_floating_trigger"
        drag
        dragConstraints={constraintsRef}
        dragElastic={0.15}
        dragMomentum={false}
        whileHover={{ scale: 1.1, rotate: 4 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsCopilotOpen(true)}
        className="fixed bottom-6 right-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-150 z-[9999] cursor-grab active:cursor-grabbing border border-indigo-400/30 w-12 h-12 md:w-13 md:h-13 shadow-indigo-900/50"
        title="Nexus Copilot IA (Arraste-me para qualquer lado!)"
      >
        <div className="relative flex items-center justify-center">
          <Bot className="w-5.5 h-5.5 text-white animate-pulse" />
          <span className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
          </span>
        </div>
      </motion.button>

      {/* FLOATING COPILOT SLIDE-OUT DRAWER OVERLAY */}
      <AnimatePresence>
        {isCopilotOpen && (
          <>
            {/* Dark glass backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCopilotOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]"
            />
            
            {/* Drawer Sliding container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className={`fixed top-0 right-0 bottom-0 w-full max-w-lg md:max-w-2xl ${
                theme === 'light' ? 'bg-white text-zinc-900 border-l border-zinc-200' : 'bg-zinc-900 text-white border-l border-white/5'
              } z-[10001] flex flex-col shadow-2xl`}
            >
              <div className={`p-4 border-b flex items-center justify-between ${theme === 'light' ? 'border-zinc-200 bg-slate-50' : 'border-white/5 bg-zinc-950/40'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold animate-pulse">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-display leading-tight">Nexus Copilot AI</h3>
                    <p className="text-[11px] text-zinc-400 font-sans leading-none mt-0.5">Assistente Digital Integrado • Gestão Escolar Inteligente</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCopilotOpen(false)}
                  className={`p-2 rounded-lg transition-all cursor-pointer ${
                    theme === 'light' ? 'hover:bg-zinc-200 text-zinc-650' : 'hover:bg-white/5 text-zinc-450 hover:text-white'
                  }`}
                  aria-label="Minimizar Copilot"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Actual Copilot interface */}
              <div className="flex-1 overflow-hidden relative">
                <AIAssistant 
                  students={students}
                  teachers={teachers}
                  invoices={invoices}
                  onRefreshData={loadLiveDb}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* REAL-TIME NOTIFICATION TOAST OVERLAY STACK */}
      <div className="fixed top-24 right-6 z-[99999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        <AnimatePresence>
          {realtimeNotifications.map((not) => {
            const colors = {
              success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/5',
              info: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 shadow-indigo-500/5',
              warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-amber-500/5',
              alert: 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-rose-500/5'
            };
            const icons = {
              success: (
                <div className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  ✓
                </div>
              ),
              info: (
                <div className="w-5 h-5 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  ℹ
                </div>
              ),
              warning: (
                <div className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  ⚠
                </div>
              ),
              alert: (
                <div className="w-5 h-5 rounded bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  ✖
                </div>
              )
            };

            return (
              <motion.div
                key={not.id}
                initial={{ opacity: 0, y: -20, scale: 0.95, x: 20 }}
                animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 30 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`pointer-events-auto border rounded-xl p-4 flex gap-3 backdrop-blur-md shadow-lg ${
                  colors[not.type] || colors.info
                }`}
              >
                {icons[not.type] || icons.info}
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold tracking-tight">{not.title}</span>
                    <span className="text-[9px] opacity-65 font-mono">{not.timestamp}</span>
                  </div>
                  <p className="text-[11px] opacity-90 mt-1 font-sans leading-relaxed">{not.message}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
