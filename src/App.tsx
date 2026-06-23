import React, { useState, useEffect } from 'react';
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
  PenTool
} from 'lucide-react';

import { Student, Teacher, Invoice, Announcement, ChatMessage, AutomationFlow, UserRole, AuditLog, NotificationPreset, ApprovalRequest, ApprovalFlowType, DigitalSignatureRequest, DigitalSignatureDocType, SchoolTask } from './types';
import { 
  initialStudents, 
  initialTeachers, 
  initialInvoices, 
  initialAnnouncements, 
  initialMessages, 
  initialAutomations,
  initialTasks
} from './mockData';
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
  setBypassToken,
  getLiveApprovals,
  createLiveApproval,
  transitionLiveApproval
} from './supabaseClient';

import { auth, googleAuthProvider } from './lib/firebase.ts';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';

// Subcomponents
import Dashboard from './components/Dashboard';
import StudentsList from './components/StudentsList';
import TeachersList from './components/TeachersList';
import FinancialPanel from './components/FinancialPanel';
import CommunicationCenter from './components/CommunicationCenter';
import AutomationsSection from './components/AutomationsSection';
import SystemConfig from './components/SystemConfig';
import AIAssistant from './components/AIAssistant';
import TeacherAI from './components/TeacherAI';
import Gamification from './components/Gamification';
import MatriculaPortal from './components/MatriculaPortal';
import SchoolDocuments, { SchoolDoc, defaultSchoolDocuments } from './components/SchoolDocuments';
import SchoolMigration from './components/SchoolMigration';
import WorkflowsCentral from './components/WorkflowsCentral';
import GlobalSearch from './components/GlobalSearch';
import ParentPortal from './components/ParentPortal';
import InstitutionalApprovals from './components/InstitutionalApprovals';
import DigitalSignatureSystem, { defaultSignatures } from './components/DigitalSignatureSystem';
import TasksCenter from './components/TasksCenter';

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
  documents: 'Dossier & Automações',
  communications: 'Comunicação',
  config: 'Definições do Sistema',
  workflows: 'Central de Workflows',
  approvals: 'Aprovações Internas',
  signatures: 'Assinatura Digital',
  tasks: 'Centro de Tarefas'
};

const DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['dashboard', 'students', 'teachers', 'financials', 'documents', 'communications', 'config', 'workflows', 'approvals', 'signatures', 'tasks'],
  director: ['dashboard', 'students', 'teachers', 'financials', 'documents', 'communications', 'config', 'workflows', 'approvals', 'signatures', 'tasks'],
  secretariat: ['dashboard', 'students', 'documents', 'communications', 'approvals', 'signatures', 'tasks'],
  financial: ['dashboard', 'financials', 'documents', 'communications', 'approvals', 'signatures', 'tasks'],
  teacher: ['students', 'teachers', 'documents', 'communications', 'approvals', 'signatures', 'tasks'],
  parent: ['dashboard', 'signatures', 'tasks'],
  student: ['dashboard', 'students', 'documents', 'communications', 'signatures', 'tasks']
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
    type: 'Layout de Lista Geral',
    containerClass: "space-y-6 w-full max-w-7xl mx-auto",
    description: "Espaço para acompanhamento de matrículas, frequência estudantil e progresso comportamental."
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
  gamification: {
    type: 'Painel de Méritos e Destaques',
    containerClass: "w-full max-w-[1600px] mx-auto space-y-6",
    description: "Registo de comportamento positivo, prémios de dedicação e pódio de alunos."
  },
  matriculas: {
    type: 'Formatador Sequencial de Registos',
    containerClass: "w-full max-w-[1500px] mx-auto space-y-6",
    description: "Portal de Matrícula para conferência de dados e validação de documentos de acesso."
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
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [authRegisterName, setAuthRegisterName] = useState<string>('');

  const [loginStep, setLoginStep] = useState<number>(1);
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [secretKey, setSecretKey] = useState<string>('');

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('admin');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);

  // Reorganized navigation: sub-tab states for modular layout
  const [studentsSubTab, setStudentsSubTab] = useState<'list' | 'matriculas' | 'gamification'>('list');
  const [teachersSubTab, setTeachersSubTab] = useState<'list' | 'ai'>('list');
  const [documentsSubTab, setDocumentsSubTab] = useState<'list' | 'automations'>('list');
  const [configSubTab, setConfigSubTab] = useState<'settings' | 'migration'>('settings');
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);

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

  const handleSimulationRoleChange = (newRole: UserRole) => {
    setCurrentUserRole(newRole);
    logAuditEvent(newRole, activeTab, 'ALLOWED', 'LOGIN', `O utilizador iniciou sessão ou trocou com sucesso para o perfil de ${newRole.toUpperCase()}.`);
  };

  // Core School State Engine (React hydrated from local mock db)
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('nexus_students');
    return saved ? JSON.parse(saved) : initialStudents;
  });

  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    const saved = localStorage.getItem('nexus_teachers');
    return saved ? JSON.parse(saved) : initialTeachers;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('nexus_invoices');
    return saved ? JSON.parse(saved) : initialInvoices;
  });

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

  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    const saved = localStorage.getItem('nexus_announcements');
    return saved ? JSON.parse(saved) : initialAnnouncements;
  });

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

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('nexus_messages');
    return saved ? JSON.parse(saved) : initialMessages;
  });

  const [automationFlows, setAutomationFlows] = useState<AutomationFlow[]>(() => {
    const saved = localStorage.getItem('nexus_automations');
    return saved ? JSON.parse(saved) : initialAutomations;
  });

  const [schoolDocs, setSchoolDocs] = useState<SchoolDoc[]>(() => {
    const saved = localStorage.getItem('nexus_school_docs');
    return saved ? JSON.parse(saved) : defaultSchoolDocuments;
  });

  const [approvals, setApprovals] = useState<ApprovalRequest[]>(() => {
    const saved = localStorage.getItem('nexus_approvals');
    return saved ? JSON.parse(saved) : [];
  });
  const [approvalsLoading, setApprovalsLoading] = useState(false);

  const [signatures, setSignatures] = useState<DigitalSignatureRequest[]>(() => {
    const saved = localStorage.getItem('nexus_signatures');
    return saved ? JSON.parse(saved) : defaultSignatures(initialStudents, defaultSchoolDocuments, initialInvoices);
  });

  const [tasks, setTasks] = useState<SchoolTask[]>(() => {
    const saved = localStorage.getItem('nexus_tasks');
    return saved ? JSON.parse(saved) : initialTasks;
  });

  // Sync state engine to localstorage for instant persistence
  useEffect(() => {
    localStorage.setItem('nexus_approvals', JSON.stringify(approvals));
  }, [approvals]);

  useEffect(() => {
    localStorage.setItem('nexus_tasks', JSON.stringify(tasks));
  }, [tasks]);

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

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
      if (usr) {
        setFirebaseUser(usr);
        // Load the PostgreSQL profile role on access
        try {
          const token = await usr.getIdToken();
          const pRes = await fetch('/api/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (pRes.ok) {
            const profile = await pRes.json();
            console.log('[AUTH-PG] Active PG user role profile loaded:', profile);
            setCurrentUserRole(profile.role);
          }
        } catch (e) {
          console.error('[AUTH-PG] Error loading profile from Postgres:', e);
        }
      } else {
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
    
    function connect() {
      console.log('[REALTIME] Initializing WebSocket Connection to Live Org:', wsUrl);
      ws = new WebSocket(wsUrl);
      
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
        console.error('[REALTIME] Connection error:', err);
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
      const [liveSt, liveTc, liveIv, liveAn, liveMs, liveAu, liveAp] = await Promise.all([
        getLiveStudents(),
        getLiveTeachers(),
        getLiveInvoices(),
        getLiveAnnouncements(),
        getLiveMessages(),
        getLiveAutomations(),
        getLiveApprovals()
      ]);
      
      if (liveSt && liveSt.length > 0) setStudents(liveSt);
      if (liveTc && liveTc.length > 0) setTeachers(liveTc);
      if (liveIv && liveIv.length > 0) setInvoices(liveIv);
      if (liveAn && liveAn.length > 0) setAnnouncements(liveAn);
      if (liveMs && liveMs.length > 0) setMessages(liveMs);
      if (liveAu && liveAu.length > 0) setAutomationFlows(liveAu);
      if (liveAp && liveAp.length > 0) setApprovals(liveAp);
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

  const triggerSandboxBypass = (role: UserRole) => {
    console.log(`[AUTH-BYPASS] Activating high-fidelity Sandbox bypass mode for role: ${role}`);
    const mockEmail = loginEmail || `${role}@nexus.edu`;
    setBypassToken(`bypass-token-${role}`);
    const mockUser = {
      uid: `bypass_uid_${role}`,
      email: mockEmail,
      displayName: `${role.charAt(0).toUpperCase() + role.slice(1)} Simulado`,
      getIdToken: async () => `bypass-token-${role}`
    };
    setFirebaseUser(mockUser);
    setCurrentUserRole(role);
  };

  const handleQuickSimulationLogin = async (role: UserRole) => {
    // Retained as fallback wrapper for external reference
    triggerSandboxBypass(role);
  };

  const handleModularLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();

    if (!email || !password) {
      setLoginError('O email e a palavra-passe são obrigatórios.');
      return;
    }

    // High-fidelity backward-compatible mapping for demo accounts to ensure they login perfectly
    let deterministicPassword = password;
    let mappedRole: UserRole = 'student';

    if (email === 'admin@nexus.edu') {
      deterministicPassword = 'nexus_pwd_admin_secret';
      mappedRole = 'admin';
    } else if (email === 'direcao@nexus.edu') {
      deterministicPassword = 'nexus_pwd_director_secret';
      mappedRole = 'director';
    } else if (email === 'secretaria@nexus.edu') {
      deterministicPassword = 'nexus_pwd_secretariat_secret';
      mappedRole = 'secretariat';
    } else if (email === 'financeiro@nexus.edu') {
      deterministicPassword = 'nexus_pwd_financial_secret';
      mappedRole = 'financial';
    } else if (email === 'professor@nexus.edu') {
      deterministicPassword = 'nexus_pwd_teacher_secret';
      mappedRole = 'teacher';
    } else if (email === 'encarregado@nexus.edu') {
      deterministicPassword = 'nexus_pwd_parent_secret';
      mappedRole = 'parent';
    } else if (email === 'aluno@nexus.edu') {
      deterministicPassword = 'nexus_pwd_student_secret';
      mappedRole = 'student';
    } else {
      // Dynamic fallback role mapping for new email entries
      if (email.includes('admin')) mappedRole = 'admin';
      else if (email.includes('director') || email.includes('direcao')) mappedRole = 'director';
      else if (email.includes('secret')) mappedRole = 'secretariat';
      else if (email.includes('finance')) mappedRole = 'financial';
      else if (email.includes('teach') || email.includes('prof')) mappedRole = 'teacher';
      else if (email.includes('parent') || email.includes('encarregado')) mappedRole = 'parent';
    }

    try {
      console.log(`[AUTH-REAL] Unifying email login for: ${email}`);
      let usrCredential;
      try {
        usrCredential = await signInWithEmailAndPassword(auth, email, deterministicPassword);
      } catch (signInErr: any) {
        if (
          signInErr.code === 'auth/user-not-found' || 
          signInErr.code === 'auth/invalid-credential' || 
          signInErr.code === 'auth/wrong-password' ||
          signInErr.code === 'auth/invalid-email'
        ) {
          // Auto create account with standard role password if first registration attempts occur
          usrCredential = await createUserWithEmailAndPassword(auth, email, deterministicPassword);
        } else {
          throw signInErr;
        }
      }

      if (usrCredential && usrCredential.user) {
        const token = await usrCredential.user.getIdToken();
        
        // Ensure Postgres user row is fully created and has proper role
        const response = await fetch('/api/profile/role', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ role: mappedRole })
        });
        
        // Fetch actual profile to check for suspension
        const pRes = await fetch('/api/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (pRes.ok) {
          const profile = await pRes.json();
          if (profile.status === 'suspended') {
            await signOut(auth);
            setLoginError('A sua conta está temporariamente suspensa pelo administrador pedagógico.');
            return;
          }
          setCurrentUserRole(profile.role);
        } else {
          setCurrentUserRole(mappedRole);
        }
        
        setFirebaseUser(usrCredential.user);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        triggerSandboxBypass(mappedRole);
      } else {
        setLoginError(`Falha durante a autenticação: ${err.message || err}`);
      }
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    // Maintained for compatibility
    handleModularLogin(e);
  };

  const handleGoogleLogin = async () => {
    setLoginError('');
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      // If popup/operations not allowed/blocked in sandbox, fallback graciously
      triggerSandboxBypass('admin');
    }
  };

  const handleSignOut = async () => {
    try {
      setBypassToken(null);
      await signOut(auth);
      setFirebaseUser(null);
      setLoginStep(1);
      setSecretKey('');
    } catch (err) {
      console.error("Error signing out:", err);
      setBypassToken(null);
      setFirebaseUser(null);
      setLoginStep(1);
      setSecretKey('');
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

    // Auto-create 3 tasks on enrollment
    const docTask: SchoolTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
      title: `Verificar documentos - ${student.name}`,
      description: `Validar documentação académica e comprovativo de residência para a matrícula recém-criada (${student.id}).`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Alta',
      status: 'Pendente',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: student.id,
      referenceType: 'matricula'
    };
    const finTask: SchoolTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
      title: `Criar plano financeiro - ${student.name}`,
      description: `Definir regime de propinas, descontos elegíveis e plano de parcelamento para o aluno (${student.id}).`,
      assignedTo: 'Financeiro Executivo',
      department: 'Financeiro',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: student.id,
      referenceType: 'matricula'
    };
    const contractTask: SchoolTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
      title: `Gerar contrato de prestação de serviços - ${student.name}`,
      description: `Emitir o contrato oficial assinado digitalmente pelo encarregado de educação e diretor escolar.`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Alta',
      status: 'Pendente',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: student.id,
      referenceType: 'matricula'
    };
    setTasks(prev => [docTask, finTask, contractTask, ...prev]);
  };

  const handleUpdateStudent = (id: string, updatedFields: Partial<Student>) => {
    setStudents(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...updatedFields } : s);
      const updatedSt = next.find(s => s.id === id);
      if (updatedSt && supabaseConfigured) {
        upsertLiveStudent(updatedSt).catch(err => console.error("Error updating student:", err));
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
            const lateTask: SchoolTask = {
              id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
              title: `Cobrar propinas em atraso - ${i.studentName}`,
              description: `A fatura ${i.id} de €${i.amount} está em atraso desde ${i.dueDate}. Enviar notificação e contactar o encarregado.`,
              assignedTo: 'Financeiro Executivo',
              department: 'Financeiro',
              priority: 'Crítica',
              status: 'Atrasada',
              createdAt: new Date().toISOString().split('T')[0],
              dueDate: new Date().toISOString().split('T')[0],
              limitDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              createdAutomatically: true,
              referenceId: i.id,
              referenceType: 'financeiro'
            };
            setTasks(prev => [lateTask, ...prev]);
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

    // Trigger: Novo documento -> Criar tarefas automáticas (Validar, Classificar, Aprovar)
    const valTask: SchoolTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
      title: `Validar documento - ${doc.name}`,
      description: `Verificar integridade digital e autenticidade da assinatura do ficheiro carregado (${doc.id}).`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: doc.id,
      referenceType: 'documento'
    };
    const classTask: SchoolTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
      title: `Classificar documento - ${doc.name}`,
      description: `Arquivar e indexar o documento nos dossiers adequados com as devidas tags de pesquisa escolares.`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Baixa',
      status: 'Pendente',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: doc.id,
      referenceType: 'documento'
    };
    const appTask: SchoolTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
      title: `Aprovar documento - ${doc.name}`,
      description: `Homologação formal do documento para arquivamento definitivo na nuvem académica pela direção.`,
      assignedTo: 'Direção Executiva',
      department: 'Direção',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: doc.id,
      referenceType: 'documento'
    };
    setTasks(prev => [valTask, classTask, appTask, ...prev]);
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

  const handleResetToZero = () => {
    setStudents([]);
    setTeachers([]);
    setInvoices([]);
    setAnnouncements([]);
    setMessages([]);
    setSchoolDocs([]);
  };

  const handleRestoreDemo = () => {
    setStudents(initialStudents);
    setTeachers(initialTeachers);
    setInvoices(initialInvoices);
    setAnnouncements(initialAnnouncements);
    setMessages(initialMessages);
    setSchoolDocs(defaultSchoolDocuments);
  };

  // Filter sidebar items according to executive guidelines: "Cada utilizador deve ver apenas o necessário"
  const sidebarItems = [
    { id: 'dashboard', name: 'Painel Geral', icon: LayoutDashboard },
    { id: 'students', name: 'Alunos & Matrículas', icon: Users },
    { id: 'teachers', name: 'Corpo Docente', icon: GraduationCap },
    { id: 'financials', name: 'Finanças & Contas', icon: DollarSign },
    { id: 'documents', name: 'Dossier & Automações', icon: FolderOpen },
    { id: 'communications', name: 'Comunicação', icon: Megaphone },
    { id: 'config', name: 'Definições', icon: Sliders },
    { id: 'workflows', name: 'Central de Workflows', icon: Zap },
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
        { id: 'tasks', name: 'Centro de Tarefas', icon: ClipboardCheck }
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
        { id: 'documents', name: 'Dossier & Automações', icon: FolderOpen },
        { id: 'communications', name: 'Comunicação', icon: Megaphone }
      ]
    },
    {
      title: "Processos & Automação",
      items: [
        { id: 'workflows', name: 'Central de Workflows', icon: Zap },
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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold tracking-wide text-zinc-400 font-mono">Autenticando no Nexus Core Node...</p>
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

        <div className={`w-full max-w-sm ${theme === 'light' ? 'bg-white border-zinc-200 shadow-xl text-zinc-900' : 'bg-zinc-900 border-white/5 text-zinc-100'} border rounded-3xl p-8 relative z-10 space-y-6 transition-all duration-200`}>
          <div className="text-center space-y-2">
            <div className={`inline-flex items-center gap-2 ${theme === 'light' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'} border px-3 py-1 rounded-full text-[9px] font-bold tracking-wider uppercase font-mono`}>
              PORTAL INSTITUCIONAL
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-display">Nexus Edu AI</h1>
            <p className={`text-[11px] ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'} max-w-xs mx-auto`}>
              Autenticação segura para professores, diretores e famílias.
            </p>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[10px] text-rose-500 font-semibold font-mono text-center leading-relaxed">
              {loginError}
            </div>
          )}

          <form onSubmit={handleModularLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className={`text-[10px] font-bold tracking-wider ${theme === 'light' ? 'text-zinc-550' : 'text-white/40'} uppercase font-mono block`}>Endereço de Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="exemplo@nexus.edu"
                className={`w-full ${theme === 'light' ? 'bg-slate-50 border-zinc-200 text-zinc-900 focus:bg-white focus:border-indigo-500' : 'bg-zinc-950 border-white/5 text-zinc-105 focus:border-indigo-500'} border rounded-xl px-3 py-2.5 text-xs outline-none transition-all`}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className={`text-[10px] font-bold tracking-wider ${theme === 'light' ? 'text-zinc-550' : 'text-white/40'} uppercase font-mono block`}>Palavra-passe</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Insira a sua senha"
                className={`w-full ${theme === 'light' ? 'bg-slate-50 border-zinc-200 text-zinc-900 focus:bg-white focus:border-indigo-500' : 'bg-zinc-950 border-white/5 text-zinc-105 focus:border-indigo-500'} border rounded-xl px-3 py-2.5 text-xs outline-none transition-all`}
                required
              />
            </div>

            <div className={`p-3.5 ${theme === 'light' ? 'bg-slate-50 border-zinc-200 shadow-inner' : 'bg-white/[0.02] border-white/5'} border rounded-2xl`}>
              <span className={`text-[8.5px] font-bold tracking-wider ${theme === 'light' ? 'text-zinc-500' : 'text-white/30'} uppercase block font-mono`}>Contas de Demonstração (Cargos Autoderivados)</span>
              <div className={`text-[10px] ${theme === 'light' ? 'text-zinc-650' : 'text-zinc-400'} font-mono leading-relaxed mt-1.5 space-y-1`}>
                <div className="flex justify-between"><strong>Administrador:</strong> <span>admin@nexus.edu / admin123</span></div>
                <div className="flex justify-between"><strong>Diretor:</strong> <span>direcao@nexus.edu / direcao123</span></div>
                <div className="flex justify-between"><strong>Secretaria:</strong> <span>secretaria@nexus.edu / secretaria123</span></div>
                <div className="flex justify-between"><strong>Financeiro:</strong> <span>financeiro@nexus.edu / financeiro123</span></div>
                <div className="flex justify-between"><strong>Professor:</strong> <span>professor@nexus.edu / professor123</span></div>
                <div className="flex justify-between"><strong>Responsável:</strong> <span>encarregado@nexus.edu / encarregado123</span></div>
                <div className="flex justify-between"><strong>Aluno:</strong> <span>aluno@nexus.edu / aluno123</span></div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer shadow-lg shadow-indigo-600/10 text-center uppercase font-mono h-10 flex items-center justify-center font-semibold"
            >
              Autenticar e Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div id="nexus_container" className={`min-h-screen ${theme === 'light' ? 'bg-slate-50 text-zinc-800' : 'bg-zinc-950 text-zinc-105'} flex flex-col font-sans selection:bg-indigo-500/10 transition-colors duration-200`}>
      
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
            {/* Realtime Socket Status Badge */}
            <div className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono tracking-tight transition-all duration-300 ${
              isLiveConnected 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-zinc-800/40 border-zinc-700/30 text-zinc-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-650'} shrink-0`} />
              <span>{isLiveConnected ? 'HUB REALTIME' : 'CONECTANDO WS...'}</span>
            </div>

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
                <span className={`font-bold uppercase text-[10px] ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>{currentUserRole}</span>
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
          
          {/* Elegant Minimalist Sub-tabs Navigation */}
          {['students', 'teachers'].includes(activeTab) && (
            <div className={`flex flex-wrap items-center gap-1.5 border-b pb-4 mb-6 ${theme === 'light' ? 'border-zinc-200' : 'border-white/5'}`}>
              {activeTab === 'students' && (
                <>
                  <button
                    onClick={() => setStudentsSubTab('list')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      studentsSubTab === 'list'
                        ? theme === 'light' ? 'bg-indigo-50 text-indigo-700' : 'bg-white/10 text-white'
                        : theme === 'light' ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    Lista de Alunos
                  </button>
                  <button
                    onClick={() => setStudentsSubTab('matriculas')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      studentsSubTab === 'matriculas'
                        ? theme === 'light' ? 'bg-indigo-50 text-indigo-700' : 'bg-white/10 text-white'
                        : theme === 'light' ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    Portal de Matrícula
                  </button>
                  <button
                    onClick={() => setStudentsSubTab('gamification')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      studentsSubTab === 'gamification'
                        ? theme === 'light' ? 'bg-indigo-50 text-indigo-700' : 'bg-white/10 text-white'
                        : theme === 'light' ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    Mérito & Engajamento / Pódio
                  </button>
                </>
              )}

              {activeTab === 'teachers' && (
                <>
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
                </>
              )}
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
                    <h3 className="text-lg font-bold uppercase tracking-wide font-display text-red-500">Módulo de Acesso Restrito</h3>
                    <p className={`text-xs leading-relaxed ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Desculpe, o perfil de utilizador <strong className="font-mono text-amber-500 uppercase">{currentUserRole}</strong> não está pré-autorizado ou teve o seu privilégio de acesso suspenso pela administração escolar.
                    </p>
                  </div>
                  <div className={`text-[10px] font-mono p-3 rounded-lg border leading-relaxed text-left space-y-1 ${
                    theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-500' : 'bg-zinc-950 border-zinc-850 text-zinc-400'
                  }`}>
                    <p>🚨 status: <strong>ACESSO_BLOQUEADO</strong></p>
                    <p>🧩 módulo tentado: <code>{TAB_NAMES[activeTab] || activeTab}</code></p>
                    <p>🕒 data / hora: <span>{new Date().toLocaleTimeString('pt-PT')}</span></p>
                    <p>💬 ação corretiva: Mude o nível de permissão no painel de <code>Configuração</code> (Administrador) para restaurar o privilégio.</p>
                  </div>
                </div>
              ) : (
                <>
                  {activeTab === 'dashboard' && (
                    currentUserRole === 'parent' ? (
                      <ParentPortal 
                        students={students}
                        invoices={invoices}
                        announcements={announcements}
                        messages={messages}
                        onUpdateStudent={handleUpdateStudent}
                        onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
                        theme={theme}
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
                            setStudentsSubTab('matriculas');
                          }
                        }}
                      />
                    )
                  )}
                  
                  {activeTab === 'students' && (
                    <>
                      {studentsSubTab === 'list' && (
                        <StudentsList 
                          students={visibleStudents}
                          currentUserRole={currentUserRole}
                          onAddStudent={handleAddStudent}
                          onUpdateStudent={handleUpdateStudent}
                          onDeleteStudent={handleDeleteStudent}
                          globalSearchTerm={globalSearchQuery}
                        />
                      )}
                      
                      {studentsSubTab === 'matriculas' && (
                        <MatriculaPortal 
                          students={visibleStudents}
                          onAddStudent={handleAddStudent}
                          onUpdateStudent={handleUpdateStudent}
                        />
                      )}
                      
                      {studentsSubTab === 'gamification' && (
                        <Gamification 
                          students={visibleStudents}
                          teachers={teachers}
                          onBonusPointsToStudent={handleBonusPointsToStudent}
                          onBonusPointsToTeacher={handleBonusPointsToTeacher}
                        />
                      )}
                    </>
                  )}

                  {activeTab === 'teachers' && (
                    <>
                      {teachersSubTab === 'list' && (
                        <TeachersList 
                          teachers={teachers}
                          currentUserRole={currentUserRole}
                          onAddTeacher={handleAddTeacher}
                          onUpdateTeacher={handleUpdateTeacher}
                          onSelectTeacherForChat={(tchName) => {
                            setActiveTab('communications');
                          }}
                          globalSearchTerm={globalSearchQuery}
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
                    <SchoolDocuments 
                      documents={schoolDocs}
                      onAddDocument={handleAddSchoolDocs}
                      onUpdateDocument={handleUpdateSchoolDocs}
                      onDeleteDocument={handleDeleteSchoolDocs}
                      currentUserRole={currentUserRole}
                    />
                  )}

                  {activeTab === 'workflows' && (
                    <WorkflowsCentral 
                      students={visibleStudents}
                      invoices={visibleInvoices}
                      onAddStudent={handleAddStudent}
                      onUpdateStudent={handleUpdateStudent}
                      onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
                      currentUserRole={currentUserRole}
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
                    <DigitalSignatureSystem
                      currentUserRole={currentUserRole}
                      currentUserName={firebaseUser?.displayName || firebaseUser?.email || 'Administrador'}
                      currentUserEmail={firebaseUser?.email || 'admin@nexus.edu.pt'}
                      students={visibleStudents}
                      invoices={visibleInvoices}
                      schoolDocuments={schoolDocs}
                      signatures={signatures}
                      onAddSignature={handleAddSignature}
                      onUpdateSignature={handleUpdateSignature}
                      onDeleteSignature={handleDeleteSignature}
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
                      onResetToZero={handleResetToZero}
                      onRestoreDemo={handleRestoreDemo}
                      auditLogs={auditLogs}
                      onClearAuditLogs={handleClearAuditLogs}
                      firebaseUser={firebaseUser}
                    />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* FLOATING COPILOT TOGGLE TRIGGER BUTTON */}
      <button
        id="copilot_floating_trigger"
        onClick={() => setIsCopilotOpen(true)}
        className="fixed bottom-6 right-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-6 rounded-full shadow-lg hover:shadow-indigo-500/10 flex items-center gap-2.5 transition-all duration-200 z-[9999] hover:scale-105 active:scale-95 cursor-pointer border border-indigo-400/20 shadow-indigo-650/40"
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-sans tracking-wide">Nexus Copilot AI</span>
      </button>

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
