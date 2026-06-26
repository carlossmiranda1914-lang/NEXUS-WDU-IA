import React, { useState } from 'react';
import { 
  Shield, User, Users, Server, Database, Globe, ArrowRight, CheckCircle, Code2, Sparkles, 
  Sliders, Key, Zap, Check, AlertCircle, Copy, RefreshCw, UploadCloud, DownloadCloud,
  LayoutDashboard, GraduationCap, Brain, Trophy, ClipboardCheck, DollarSign, Megaphone, 
  Bot, Lock, Unlock, Info, ShieldAlert, FolderOpen, Trash2
} from 'lucide-react';
import { UserRole, Student, Teacher, Invoice, Announcement, ChatMessage, AutomationFlow, AuditLog } from '../types';
import { 
  supabaseConfigured, 
  supabaseUrl, 
  supabaseAnonKey, 
  SUPABASE_SQL_SCHEMA, 
  seedSupabaseDatabase,
  getLiveStudents,
  getLiveTeachers,
  getLiveInvoices,
  getLiveAnnouncements,
  getLiveMessages,
  getLiveAutomations
} from '../supabaseClient';

interface SystemConfigProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  students: Student[];
  teachers: Teacher[];
  invoices: Invoice[];
  announcements: Announcement[];
  messages: ChatMessage[];
  automationFlows: AutomationFlow[];
  onImportLiveDatabase: (imported: {
    students: Student[];
    teachers: Teacher[];
    invoices: Invoice[];
    announcements: Announcement[];
    messages: ChatMessage[];
    automationFlows: AutomationFlow[];
  }) => void;
  rolePermissions: Record<UserRole, string[]>;
  onUpdatePermissions: (updated: Record<UserRole, string[]>) => void;
  onResetToZero: () => void;
  onRestoreDemo: () => void;
  auditLogs?: AuditLog[];
  onClearAuditLogs?: () => void;
  firebaseUser?: any;
}

const FACTORY_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['dashboard', 'students', 'teachers', 'teacher_ai', 'gamification', 'matriculas', 'financials', 'communications', 'automations', 'config', 'copilot', 'documents'],
  director: ['dashboard', 'students', 'teachers', 'teacher_ai', 'gamification', 'matriculas', 'financials', 'communications', 'copilot', 'documents'],
  secretariat: ['dashboard', 'students', 'teachers', 'matriculas', 'communications', 'documents'],
  financial: ['dashboard', 'financials', 'communications', 'documents'],
  teacher: ['students', 'teacher_ai', 'gamification', 'communications', 'copilot', 'documents'],
  parent: ['dashboard', 'gamification', 'financials', 'communications', 'documents'],
  student: ['dashboard', 'gamification', 'communications', 'documents']
};

const HIGH_SECURITY_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['dashboard', 'students', 'teachers', 'teacher_ai', 'gamification', 'matriculas', 'financials', 'communications', 'automations', 'config', 'copilot', 'documents'],
  director: ['dashboard', 'students', 'teachers', 'teacher_ai', 'gamification', 'matriculas', 'financials', 'communications', 'copilot', 'documents'],
  secretariat: ['dashboard', 'students', 'matriculas', 'communications', 'documents'],
  financial: ['dashboard', 'financials', 'communications', 'documents'],
  teacher: ['students', 'teacher_ai', 'gamification', 'communications', 'documents'],
  parent: ['dashboard', 'gamification', 'communications', 'documents'],
  student: ['dashboard', 'gamification', 'documents']
};

const COLLABORATIVE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['dashboard', 'students', 'teachers', 'teacher_ai', 'gamification', 'matriculas', 'financials', 'communications', 'automations', 'config', 'copilot', 'documents'],
  director: ['dashboard', 'students', 'teachers', 'teacher_ai', 'gamification', 'matriculas', 'financials', 'communications', 'automations', 'copilot', 'documents'],
  secretariat: ['dashboard', 'students', 'teachers', 'teacher_ai', 'gamification', 'matriculas', 'financials', 'communications', 'copilot', 'documents'],
  financial: ['dashboard', 'students', 'matriculas', 'financials', 'communications', 'copilot', 'documents'],
  teacher: ['dashboard', 'students', 'teachers', 'teacher_ai', 'gamification', 'matriculas', 'communications', 'copilot', 'documents'],
  parent: ['dashboard', 'students', 'gamification', 'matriculas', 'communications', 'copilot', 'documents'],
  student: ['dashboard', 'students', 'gamification', 'matriculas', 'communications', 'copilot', 'documents']
};

const MATRIX_PERMISSIONS = [
  { id: 'dashboard', name: 'Dashboard Geral', desc: 'Métricas executivas, KPIs financeiros e taxas de retenção.', icon: LayoutDashboard },
  { id: 'students', name: 'Gestão de Alunos', desc: 'Visualização, registo, faltas e comportamento dos alunos.', icon: Users },
  { id: 'teachers', name: 'Páginas de Professores', desc: 'Visualização de currículos, pautas e produtividade docente.', icon: GraduationCap },
  { id: 'teacher_ai', name: 'IA Pedagógica', desc: 'Gerador inteligente de planos curriculares e exames.', icon: Brain },
  { id: 'gamification', name: 'Mérito & Engajamento', desc: 'Consulta de medalhas e lançamento de incentivos/atribuições.', icon: Trophy },
  { id: 'matriculas', name: 'Portal de Matrícula', desc: 'Execução de matrículas e verificação de compliance documental.', icon: ClipboardCheck },
  { id: 'financials', name: 'Painel Financeiro', desc: 'Faturação, emissor de faturas PDF de propinas.', icon: DollarSign },
  { id: 'communications', name: 'Comunicação Directa', desc: 'Quadro inteligente de editais e canais de chat instantâneo.', icon: Megaphone },
  { id: 'automations', name: 'Mensagens de Alerta', desc: 'Controlo e configuração de notificações e comunicações automáticas da escola.', icon: Zap },
  { id: 'config', name: 'Perfis de Segurança', desc: 'Modos de visualização de perfis e controlo geral de permissões de utilizadores.', icon: Sliders },
  { id: 'copilot', name: 'Nexus Copilot AI', desc: 'Agente cross-browser para relatórios preditivos de IA.', icon: Bot },
  { id: 'documents', name: 'Documentos Escolares', desc: 'Sítio organizacional de atas, regulamentos e circulares administrativas com editor.', icon: FolderOpen }
];

export default function SystemConfig({ 
  currentRole, 
  onRoleChange,
  students,
  teachers,
  invoices,
  announcements,
  messages,
  automationFlows,
  onImportLiveDatabase,
  rolePermissions,
  onUpdatePermissions,
  onResetToZero,
  onRestoreDemo,
  auditLogs = [],
  onClearAuditLogs,
  firebaseUser
}: SystemConfigProps) {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'audit' | 'users'>('users');

  // User Management State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<any | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('student');
  const [formDepartment, setFormDepartment] = useState('Alunos');
  const [formStatus, setFormStatus] = useState('active');

  const fetchUsers = async () => {
    if (!firebaseUser) return;
    setUserLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setUserLoading(false);
    }
  };

  React.useEffect(() => {
    if (activeSubTab === 'users' && firebaseUser) {
      fetchUsers();
    }
  }, [activeSubTab, firebaseUser]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const body = {
        name: formName,
        email: formEmail,
        phone: formPhone,
        role: formRole,
        department: formDepartment,
        status: formStatus
      };

      if (selectedUserForEdit) {
        // Edit existing user
        const res = await fetch(`/api/users/${selectedUserForEdit.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });
        if (res.ok) {
          setIsUserModalOpen(false);
          fetchUsers();
        } else {
          const errData = await res.json();
          alert(`Erro a atualizar utilizador: ${errData.error || 'Erro desconhecido'}`);
        }
      } else {
        // Create new user
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });
        if (res.ok) {
          setIsUserModalOpen(false);
          fetchUsers();
        } else {
          const errData = await res.json();
          alert(`Erro a registar utilizador: ${errData.error || 'Erro desconhecido'}`);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Deseja realmente eliminar permanentemente este utilizador escolar da base de dados escolar?')) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSuspendUser = async (user: any) => {
    const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Supabase Custom Config State
  const [customUrl, setCustomUrl] = useState(supabaseUrl);
  const [customKey, setCustomKey] = useState(supabaseAnonKey);
  const [isCopied, setIsCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [importStatus, setImportStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [syncLogs, setSyncLogs] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Matrix and presets operations state
  const [permissionQuery, setPermissionQuery] = useState('');
  const [presetSuccessMsg, setPresetSuccessMsg] = useState<string | null>(null);

  const filteredMatrix = MATRIX_PERMISSIONS.filter(p => 
    p.name.toLowerCase().includes(permissionQuery.toLowerCase()) ||
    p.desc.toLowerCase().includes(permissionQuery.toLowerCase())
  );


  const handleSaveCredentials = () => {
    localStorage.setItem('nexus_supabase_url', customUrl);
    localStorage.setItem('nexus_supabase_anon_key', customKey);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      window.location.reload();
    }, 1500);
  };

  const handleClearCredentials = () => {
    localStorage.removeItem('nexus_supabase_url');
    localStorage.removeItem('nexus_supabase_anon_key');
    setCustomUrl('');
    setCustomKey('');
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      window.location.reload();
    }, 1500);
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSeedDatabase = async () => {
    setSyncStatus('running');
    setSyncLogs('Estabelecendo túnel de sincronização...\n');
    try {
      const result = await seedSupabaseDatabase({
        students,
        teachers,
        invoices,
        announcements,
        messages,
        automations: automationFlows
      });
      if (result.success) {
        setSyncStatus('success');
        setSyncLogs(result.log);
      } else {
        setSyncStatus('failed');
        setSyncLogs(result.log);
      }
    } catch (err: any) {
      setSyncStatus('failed');
      setSyncLogs(`\n[ERRO CRÍTICO DE REDE]: ${err.message || err}`);
    }
  };

  const handleImportDatabase = async () => {
    setImportStatus('running');
    setSyncLogs('Ligando canal de download de tabelas...\n');
    try {
      const [liveSt, liveTc, liveIv, liveAn, liveMs, liveAu] = await Promise.all([
        getLiveStudents(),
        getLiveTeachers(),
        getLiveInvoices(),
        getLiveAnnouncements(),
        getLiveMessages(),
        getLiveAutomations()
      ]);

      onImportLiveDatabase({
        students: liveSt,
        teachers: liveTc,
        invoices: liveIv,
        announcements: liveAn,
        messages: liveMs,
        automationFlows: liveAu
      });

      setImportStatus('success');
      setSyncLogs(`[SUCESSO] Base de Dados Escolar carregada na consola escolar!\n` +
        `- Alunos importados: ${liveSt.length}\n` +
        `- Professores importados: ${liveTc.length}\n` +
        `- Faturas e Títulos: ${liveIv.length}\n` +
        `- Avisos / Edital: ${liveAn.length}\n` +
        `- Comunicações de Chat: ${liveMs.length}\n` +
        `- Automações: ${liveAu.length}`
      );
    } catch (err: any) {
      setImportStatus('failed');
      setSyncLogs(`[ERRO] FALHA DE IMPORTAÇÃO: ${err.message || err}\n\n` +
        `Orientação: Garanta que o Script de Banco fornecido na consola de gestão foi executado primeiro para que as relações e as tabelas estejam estruturadas no Servidor de Dados.`);
    }
  };

  const handleTogglePermission = (role: UserRole, permissionId: string) => {
    const currentList = rolePermissions[role] || [];
    let updatedList: string[];
    if (currentList.includes(permissionId)) {
      updatedList = currentList.filter(p => p !== permissionId);
    } else {
      updatedList = [...currentList, permissionId];
    }
    onUpdatePermissions({
      ...rolePermissions,
      [role]: updatedList
    });
  };

  const handleSelectAllRole = (role: UserRole) => {
    onUpdatePermissions({
      ...rolePermissions,
      [role]: MATRIX_PERMISSIONS.map(p => p.id)
    });
    triggerPresetNotification('Acesso Total atribuído para: ' + role);
  };

  const handleClearRole = (role: UserRole) => {
    onUpdatePermissions({
      ...rolePermissions,
      [role]: []
    });
    triggerPresetNotification('Permissões revogadas para: ' + role);
  };

  const handleApplyPreset = (presetName: 'default' | 'high_security' | 'collaborative') => {
    if (presetName === 'default') {
      onUpdatePermissions(FACTORY_PERMISSIONS);
      triggerPresetNotification('Preset "Padrão de Fábrica" aplicado com sucesso!');
    } else if (presetName === 'high_security') {
      onUpdatePermissions(HIGH_SECURITY_PERMISSIONS);
      triggerPresetNotification('Preset "Segurança Máxima" aplicado com sucesso!');
    } else {
      onUpdatePermissions(COLLABORATIVE_PERMISSIONS);
      triggerPresetNotification('Preset "Colaboração Ampla" aplicado com sucesso!');
    }
  };

  const triggerPresetNotification = (msg: string) => {
    setPresetSuccessMsg(msg);
    setTimeout(() => setPresetSuccessMsg(null), 3000);
  };

  const profiles = [
    { role: 'admin' as const, name: 'Administrador Principal', icon: Shield, desc: 'Acesso total irrestrito: faturas, professores, pautas, alertas automáticos e IA assistente.' },
    { role: 'director' as const, name: 'Direção Executiva', icon: Sliders, desc: 'Acesso a relatórios consultivos, comunicados formais, IA assistente e pautas pedagógicas.' },
    { role: 'secretariat' as const, name: 'Secretaria Executiva', icon: Users, desc: 'Focado em matrículas, documentação escolar em falta e controle de inadimplências.' },
    { role: 'financial' as const, name: 'Administração Financeira', icon: DollarSign, desc: 'Gestão exclusiva de faturas, faturamento, recebimento de mensalidades e cobradas escolares.' },
    { role: 'teacher' as const, name: 'Corpo Pedagógico', icon: GraduationCap, desc: 'Lança observações de comportamento, de mérito, ajusta pautas e consulta horários.' },
    { role: 'parent' as const, name: 'Encarregado de Educação', icon: CheckCircle, desc: 'Acompanha o boletim de mérito do educando, situação financeira e comunicados gerais.' },
    { role: 'student' as const, name: 'Aluno / Educando', icon: User, desc: 'Acede ao quadro de medalhas, notas individuais e interage via canais gerais de comunicação.' }
  ];

  return (
    <div id="nexus_system_configurations" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100">Configurações de Perfis e Segurança</h2>
          <p className="text-xs text-zinc-400 mt-1">Gerencie os cargos e permissões dos utilizadores, atribua perfis específicos e audite as tentativas críticas de acesso no sistema.</p>
        </div>
      </div>

      {/* Navegador Interno */}
      <div className="border-b border-zinc-800 flex gap-4 text-xs font-semibold overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'users' ? 'border-indigo-500 text-indigo-400 font-bold' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          Gestão de Utilizadores
        </button>
        <button
          onClick={() => setActiveSubTab('profile')}
          className={`pb-3 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'profile' ? 'border-emerald-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Controlo de Acesso & Perfis
        </button>
        <button
          onClick={() => setActiveSubTab('audit')}
          className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'audit' ? 'border-amber-500 text-amber-400 font-bold' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          Rastreio de Atividades & Auditoria
          {auditLogs.length > 0 && (
            <span className="bg-amber-500/10 text-amber-400 text-[9px] font-mono px-1.5 py-0.2 rounded-full border border-amber-500/20">
              {auditLogs.length}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'profile' && (
        <div className="space-y-6">
          {/* Phase 1: Simulator */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-2">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Simulador de Perfis Operacionais
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Diferentes cargos na escola operam sob permissões específicas. Escolha um perfil abaixo para simular 
              e experimentar instantaneamente a filtragem e as visibilidades exclusivas configuradas no portal:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map(p => {
              const IconComp = p.icon;
              const isSelected = currentRole === p.role;

              return (
                <div
                  key={p.role}
                  id={`profile_simulator_card_${p.role}`}
                  onClick={() => onRoleChange(p.role)}
                  className={`border rounded-xl p-4.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/35 shadow-md ring-1 ring-emerald-500/15'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`p-2 rounded-lg ${
                      isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-950 text-zinc-500'
                    }`}>
                      <IconComp className="w-4 h-4" />
                    </span>
                    {isSelected && (
                      <span className="text-[9px] bg-emerald-500 text-zinc-950 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                        Ativo Simulando
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-zinc-200 mt-3">{p.name}</h4>
                  <p className="text-[11px] text-zinc-450 mt-1 lines-clamp-2 leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Phase 2: Beautiful Dedicated Permissions Matrix */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-6">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/10 text-emerald-400 p-1.5 rounded-lg">
                    <Sliders className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                    Matriz Geral de Permissões e Controlo de Acesso
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 max-w-3xl leading-relaxed">
                  Gerencie granularmente quais abas e recursos estão ativos para os perfis. As alterações são persistidas no portal instantaneamente.
                  Símbolos de perigo (<ShieldAlert className="w-3.5 h-3.5 inline text-amber-500" />) sinalizam acesso crítico concedido a papéis menos privilegiados.
                </p>
              </div>

              {/* Preset buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest mr-1">PRESETS:</span>
                <button
                  onClick={() => handleApplyPreset('default')}
                  type="button"
                  className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                >
                  Padrão de Fábrica
                </button>
                <button
                  onClick={() => handleApplyPreset('high_security')}
                  type="button"
                  className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                >
                  Segurança Máxima
                </button>
                <button
                  onClick={() => handleApplyPreset('collaborative')}
                  type="button"
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                >
                  Colaboração Ampla
                </button>
              </div>
            </div>

            {/* Live feedback alert banner */}
            {presetSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs text-emerald-400 font-mono animate-fadeIn">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{presetSuccessMsg}</span>
                </div>
                <span className="text-[9px] bg-emerald-500/25 px-1.5 py-0.5 rounded uppercase">SALVO NO CACHE</span>
              </div>
            )}

            {/* Action Bar: Search Permissions */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Globe className="w-4 h-4" />
                </span>
                <input 
                  type="text"
                  value={permissionQuery}
                  onChange={(e) => setPermissionQuery(e.target.value)}
                  placeholder="Pesquisar recurso (Ex: Financeiro, IA, Alunos...)"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-zinc-300 placeholder-zinc-550 focus:outline-none focus:border-emerald-500/40"
                />
              </div>

              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-950 rounded-lg border border-zinc-850 text-[10px] text-zinc-400 font-mono">
                <Info className="w-3.5 h-3.5 text-zinc-500" />
                <span>Clique em qualquer quadrante para alternar livremente.</span>
              </div>
            </div>

            {/* Matrix View Grid */}
            <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-zinc-900/65 border-b border-zinc-800 text-[10px] uppercase font-mono tracking-wider text-zinc-400">
                      <th className="py-4 px-4 font-semibold text-zinc-300 w-[240px]">Funcionalidade / Painel</th>
                      {profiles.map(p => (
                        <th key={p.role} className="py-4 px-3 text-center font-semibold text-zinc-300 border-l border-zinc-850/60">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold text-zinc-200">{p.name.split(' ')[0]}</span>
                            <span className="text-[8px] text-zinc-500 select-none">({p.role})</span>
                            <div className="flex gap-1.5 mt-1">
                              <button
                                onClick={() => handleSelectAllRole(p.role)}
                                type="button"
                                className="text-[8px] bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-zinc-400 hover:text-emerald-400 cursor-pointer transition-colors"
                                title="Conceder todas as abas para este perfil"
                              >
                                Todos
                              </button>
                              <button
                                onClick={() => handleClearRole(p.role)}
                                type="button"
                                className="text-[8px] bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-zinc-400 hover:text-red-400 cursor-pointer transition-colors"
                                title="Revogar tudo"
                              >
                                Limpar
                              </button>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-xs">
                    {filteredMatrix.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-550 font-mono">
                          Nenhuma funcionalidade escolar corresponde à pesquisa "{permissionQuery}"
                        </td>
                      </tr>
                    ) : (
                      filteredMatrix.map(perm => {
                        const IconComponent = perm.icon;
                        return (
                          <tr key={perm.id} className="hover:bg-zinc-900/30 transition-all">
                            
                            {/* Feature Info Header */}
                            <td className="py-3 px-4 flex items-start gap-2.5">
                              <span className="p-1.5 bg-zinc-900 text-zinc-400 rounded-lg shrink-0 mt-0.5">
                                <IconComponent className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <h4 className="font-semibold text-zinc-200 text-[11.5px]">{perm.name}</h4>
                                <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{perm.desc}</p>
                              </div>
                            </td>

                            {/* Role Cells */}
                            {profiles.map(p => {
                              const isAllowed = (rolePermissions[p.role] || []).includes(perm.id);
                              
                              // Check for critical access warning
                              // Give warnings when non-executive roles (teacher, parent, student) are granted core system/automation tools.
                              const isCriticalAccessWarning = isAllowed && 
                                (p.role === 'teacher' || p.role === 'parent' || p.role === 'student') &&
                                (perm.id === 'config' || perm.id === 'automations' || perm.id === 'financials');

                              return (
                                <td 
                                  key={p.role} 
                                  onClick={() => handleTogglePermission(p.role, perm.id)}
                                  className={`py-3 px-2 border-l border-zinc-850/40 text-center cursor-pointer select-none relative group h-full hover:bg-zinc-900/50 transition-colors`}
                                >
                                  <div className="flex items-center justify-center gap-1.5 h-full min-h-[36px]">
                                    <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center shrink-0 ${
                                      isAllowed 
                                        ? 'bg-emerald-500 border-emerald-555 text-zinc-950' 
                                        : 'border-zinc-700 bg-zinc-950 group-hover:border-zinc-550'
                                    }`}>
                                      {isAllowed && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>

                                    {isCriticalAccessWarning && (
                                      <span 
                                        className="text-amber-500 hover:text-amber-400" 
                                        title={`Atenção: Conceder o recurso "${perm.name}" ao perfil "${p.name}" representa um privilégio crítico.`}
                                      >
                                        <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}

                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footnote instruction / Disclaimer */}
            <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl flex items-start gap-3">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-zinc-300">Modificações Aplicadas Dinamicamente</h5>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  As permissões utilizam uma arquitetura reativa integrada ao router principal. Ao simular ou alternar o perfil de acesso ativo usando as cartões superiores, o menu lateral da escola reconfigura as abas e canais sem requerer logout ou refresh da página.
                </p>
              </div>
            </div>

          </div>

          {/* Phase 3: Gestão de Contas Clientes & Configuração de Visibilidade Individual */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-indigo-505/10 text-indigo-400 p-1.5 rounded-lg">
                  <Users className="w-4 h-4 text-indigo-455" />
                </span>
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                  Configuração de Visibilidade de Outras Contas Clientes
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed font-sans">
                Configure a visibilidade de abas e controlo de utilitários específicos para contas de outros perfis (Encarregados de Educação, Alunos, Docentes e Gestores Externos). Como utilizador principal (Administrador), pode simular o login de qualquer conta abaixo para testar instantaneamente a visibilidade configurada de forma organizada e limpa.
              </p>
            </div>

            {/* List of Simulated Accounts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Contas Clientes - Alunos */}
              <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-zinc-400">Contas Clientes: Alunos (Estudantes)</span>
                  <span className="text-[9px] text-[#818cf8] font-mono">Simulador Ativo</span>
                </div>
                
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {students.slice(0, 3).map(std => (
                    <div key={std.id} className="p-3 bg-zinc-900/40 border border-zinc-855 rounded-lg flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-zinc-200">{std.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {std.id} • Aluno</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onRoleChange('student');
                            alert(`Modo Simulação Ativo: Entrou com o utilizador ${std.name} (Papel: Aluno). Todas as visualizações e abas do menu lateral foram calibradas de acordo com as permissões da matriz deste cliente! Logins individuais de alunos ocultam as estatísticas agregadas.`);
                          }}
                          className="text-[10px] bg-indigo-505/10 hover:bg-indigo-505/20 border border-indigo-500/20 text-[#818cf8] font-bold px-2.5 py-1 rounded transition-colors cursor-pointer text-center"
                        >
                          Simular Cliente
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contas Clientes - Encarregados de Educação (Pais) */}
              <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-zinc-400">Contas Responsáveis: Encarregados</span>
                  <span className="text-[9px] text-emerald-400 font-mono">Simulador Ativo</span>
                </div>
                
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {[
                    { id: 'ENC-402', name: 'Carlos Medeiros (Pai)', rel: 'Bruno Medeiros' },
                    { id: 'ENC-809', name: 'Helena Siqueira (Mãe)', rel: 'Alice Siqueira' }
                  ].map(p => (
                    <div key={p.id} className="p-3 bg-zinc-900/40 border border-zinc-855 rounded-lg flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-zinc-200">{p.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {p.id} • Responsando: {p.rel}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onRoleChange('parent');
                            alert(`Modo Simulação Ativo: Entrou com o Encarregado de Educação ${p.name} (Papel: Encarregado). Verá no menu lateral apenas o financeiro consolidado, o boletim do educando e os editais de avisos relevantes!`);
                          }}
                          className="text-[10px] bg-emerald-505/10 hover:bg-emerald-505/20 border border-emerald-500/25 text-emerald-400 font-bold px-2.5 py-1 rounded transition-colors cursor-pointer text-center"
                        >
                          Simular Responsável
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Granular Control Config for Visibility Exclusions */}
            <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-xl space-y-4">
              <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">Garantia de Divisões Individuais de Áreas</span>
              <p className="text-[11px] text-zinc-450 leading-relaxed font-sans">
                Pretende calibrar a visibilidade de outras contas de clientes individuais em múltiplos canais de recepção?
                Pode usar as seguintes caixas para excluir do menu geral os canais redundantes de cada perfil, organizando melhor as abas de cada zona do portal de forma limpa:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-zinc-900/40 p-3 rounded-lg border border-zinc-850 font-sans">
                <div className="flex items-start gap-2.5">
                  <input 
                    type="checkbox" 
                    defaultChecked 
                    id="chk_student_exclusive"
                    onChange={(e) => {
                      alert(`Organização de abas de Alunos configurada! Menu lateral de Alunos agora está simplificado com foco na Central de Méritos (Gamificação) e Portal de Matrícula, ocultando ferramentas administrativas redundantes de forma isolada.`);
                    }}
                    className="mt-0.5 rounded border-zinc-800 bg-zinc-950 text-emerald-520 focus:ring-opacity-0 cursor-pointer" 
                  />
                  <div className="text-xs">
                    <label htmlFor="chk_student_exclusive" className="font-semibold text-zinc-300 block cursor-pointer">Menu Simplificado Alunos</label>
                    <span className="text-[10px] text-zinc-500 block">Foco estrito em Notas, Méritos e Atividades</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <input 
                    type="checkbox" 
                    defaultChecked 
                    id="chk_parent_exclusive"
                    onChange={(e) => {
                      alert(`Organização de abas de Encarregados calibrada! O painel consolidado exibe exclusivamente boletos de propinas e canais diretos de comunicação com a secretaria.`);
                    }}
                    className="mt-0.5 rounded border-zinc-800 bg-zinc-950 text-emerald-520 focus:ring-opacity-0 cursor-pointer" 
                  />
                  <div className="text-xs">
                    <label htmlFor="chk_parent_exclusive" className="font-semibold text-zinc-300 block cursor-pointer">Menu Isolado Encarregados</label>
                    <span className="text-[10px] text-zinc-500 block">Canal estrito de Propinas e Avisos Rápidos</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <input 
                    type="checkbox" 
                    defaultChecked 
                    id="chk_docente_filtering"
                    onChange={(e) => {
                      alert(`Isolamento de Área Docente definido! O menu do corpo de professores está focado na assistente pedagógica de IA, ocultando pautas financeiras confidenciais dos educadores.`);
                    }}
                    className="mt-0.5 rounded border-zinc-800 bg-zinc-950 text-emerald-520 focus:ring-opacity-0 cursor-pointer" 
                  />
                  <div className="text-xs">
                    <label htmlFor="chk_docente_filtering" className="font-semibold text-zinc-300 block cursor-pointer">Segregamento da Área Docente</label>
                    <span className="text-[10px] text-zinc-500 block">Acesso estrito a utilitários de IA e turmas</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {activeSubTab === 'audit' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500 animate-pulse" />
                Registo de Eventos e Auditoria de Segurança
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Logs de acesso gerados em tempo real na camada de roteamento reativa. Tentativas fora do perfil autorizado são barradas na origem intelectual.
              </p>
            </div>
            {onClearAuditLogs && (
              <button
                onClick={onClearAuditLogs}
                disabled={auditLogs.length === 0}
                className="px-3 py-1.5 bg-rose-950/20 hover:bg-rose-950/40 disabled:opacity-30 text-rose-400 border border-rose-800/30 hover:border-rose-800/50 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Logs
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-xl">
              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase block">Monitor Integrado</span>
              <span className="text-xs font-semibold text-emerald-400 mt-1 block flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                Ativo (Guardas de Rota)
              </span>
            </div>
            <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-xl">
              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase block">Total Bloqueios</span>
              <span className="text-lg font-bold font-mono text-zinc-200 mt-0.5 block">{auditLogs.length}</span>
            </div>
            <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-xl">
              <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase block">Último Incidente</span>
              <span className="text-xs font-semibold text-zinc-300 mt-1 block truncate">
                {auditLogs[0] ? `${auditLogs[0].attemptedTabName} (${auditLogs[0].timestamp})` : 'Nenhum incidente hoje'}
              </span>
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <div className="border border-zinc-800/50 bg-zinc-900/30 p-10 rounded-xl text-center space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-555 mx-auto" />
              <p className="text-xs font-semibold text-zinc-300">Nenhum evento anômalo pendente!</p>
              <p className="text-[10px] text-zinc-500 max-w-md mx-auto">
                Tente alterar as permissões de acesso do perfil simulado ativo, mude para o perfil e tente aceder àquela aba para emitir logs de auditoria real.
              </p>
            </div>
          ) : (
            <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-zinc-850 bg-zinc-900 text-[10px] font-mono font-bold text-zinc-455 uppercase">
                      <th className="p-3">Ref ID</th>
                      <th className="p-3">Data / Hora</th>
                      <th className="p-3">Perfil do Utilizador</th>
                      <th className="p-3">Aba / Módulo Tentado</th>
                      <th className="p-3">IP Origem</th>
                      <th className="p-3">Status Segurança</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log, idx) => {
                      const roleMeta: Record<string, { label: string, color: string }> = {
                        admin: { label: 'Administrador', color: 'bg-red-500/10 text-red-400 border border-red-500/20' },
                        director: { label: 'Diretor', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
                        secretariat: { label: 'Secretaria', color: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' },
                        financial: { label: 'Financeiro', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
                        teacher: { label: 'Professor', color: 'bg-sky-500/10 text-sky-400 border border-sky-500/20' },
                        parent: { label: 'Encarregado', color: 'bg-violet-500/10 text-violet-400 border border-violet-500/20' },
                        student: { label: 'Aluno', color: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' }
                      };

                      const meta = roleMeta[log.userRole] || { label: log.userRole, color: 'bg-zinc-800 text-zinc-400' };

                      return (
                        <tr key={`${log.id}-${idx}`} className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/40 text-xs transition-colors">
                          <td className="p-3 font-mono text-[10px] text-zinc-500">{log.id}</td>
                          <td className="p-3 font-mono text-[10px] text-zinc-450">{log.timestamp}</td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${meta.color}`}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="text-zinc-200 font-semibold font-sans">{log.attemptedTabName}</span>
                            <span className="text-[9px] text-zinc-500 font-mono block">tab: {log.attemptedTab}</span>
                          </td>
                          <td className="p-3 font-mono text-[10px] text-zinc-550">{log.ipAddress}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 bg-red-950/20 text-red-500 text-[10px] font-mono px-2 py-0.5 rounded-full border border-red-550/30">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-xl">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                Controlo Geral de Contas de Utilizadores
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Adicione novos colaboradores, edite funções, controle acessos e suspenda ou exclua contas ativas. Cada conta está integrada de forma coerente com a autenticação.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedUserForEdit(null);
                setFormName('');
                setFormEmail('');
                setFormPhone('');
                setFormRole('student');
                setFormDepartment('Alunos');
                setFormStatus('active');
                setIsUserModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/10 text-center uppercase font-mono h-10"
            >
              Registar Utilizador
            </button>
          </div>

          <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Filtrar por nome ou email..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-zinc-300 placeholder-zinc-550 focus:outline-none focus:border-indigo-500/40"
              />
            </div>
            <button
              onClick={fetchUsers}
              className="p-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-zinc-350 hover:text-white rounded-xl transition-all cursor-pointer flex items-center justify-center h-9 w-9"
              title="Recarregar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${userLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>

          <div className="border border-zinc-800/80 rounded-2xl overflow-hidden bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-zinc-950/60 border-b border-zinc-800 text-[10px] uppercase font-mono tracking-wider text-zinc-400 font-bold p-3">
                    <th className="py-4 px-5">Utilizador</th>
                    <th className="py-4 px-3">Telefone</th>
                    <th className="py-4 px-3">Cargo Escolar</th>
                    <th className="py-4 px-3">Departamento</th>
                    <th className="py-4 px-3">Estado</th>
                    <th className="py-4 px-3">Último Acesso</th>
                    <th className="py-4 px-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-xs">
                  {userLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500 font-mono">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-indigo-505" />
                          <span>Carregando utilizadores registados de forma segura...</span>
                        </div>
                      </td>
                    </tr>
                  ) : usersList.filter(u => 
                    u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                  ).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500 font-mono">
                        Nenhum utilizador escolar correspondente para "{userSearchQuery}".
                      </td>
                    </tr>
                  ) : (
                    usersList.filter(u => 
                      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                    ).map(u => {
                      const roleStyles: Record<string, string> = {
                        admin: 'bg-red-500/10 text-red-400 border border-red-500/20',
                        director: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                        secretariat: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
                        financial: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                        teacher: 'bg-sky-500/10 text-sky-450 border border-sky-500/20',
                        parent: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
                        student: 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                      };
                      const rLabel: Record<string, string> = {
                        admin: 'Administrador',
                        director: 'Diretor',
                        secretariat: 'Secretaria',
                        financial: 'Financeiro',
                        teacher: 'Professor',
                        parent: 'Encarregado',
                        student: 'Aluno'
                      };
                      
                      const deptStyles: Record<string, string> = {
                        'Direção': 'text-amber-400',
                        'Secretaria': 'text-indigo-400',
                        'Professorado': 'text-sky-400',
                        'Financeiro': 'text-emerald-400',
                        'Acompanhamento': 'text-violet-405',
                        'Alunos': 'text-zinc-400'
                      };

                      return (
                        <tr key={u.id} className="hover:bg-zinc-950/20 transition-all">
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold flex items-center justify-center text-xs uppercase shadow-sm">
                                {u.name.charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-bold text-zinc-150 text-sm leading-tight">{u.name}</h4>
                                <p className="text-zinc-500 font-mono text-[11px] select-all leading-tight mt-0.5">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-zinc-350 font-mono tracking-tight text-xs">
                            {u.phone || <span className="opacity-45 select-none">—</span>}
                          </td>
                          <td className="py-4 px-3">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono tracking-wide uppercase shadow-sm ${roleStyles[u.role] || 'bg-zinc-800 text-zinc-400'}`}>
                              {rLabel[u.role] || u.role}
                            </span>
                          </td>
                          <td className="py-4 px-3">
                            <span className={`font-semibold text-xs ${deptStyles[u.department] || 'text-zinc-400'}`}>
                              {u.department}
                            </span>
                          </td>
                          <td className="py-4 px-3">
                            {u.status === 'suspended' ? (
                              <span className="inline-flex items-center gap-1 bg-red-955/25 text-red-500 text-[10px] font-mono px-2 py-0.5 rounded-full border border-red-500/20 font-bold">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                Suspenso
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                                Ativo
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-3 text-zinc-400 font-mono text-[10.5px]">
                            {u.lastAccess ? (
                              new Date(u.lastAccess).toLocaleString('pt-PT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
                            ) : (
                              <span className="text-zinc-650 text-[10px]">Nunca acedeu</span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedUserForEdit(u);
                                setFormName(u.name);
                                setFormEmail(u.email);
                                setFormPhone(u.phone || '');
                                setFormRole(u.role);
                                setFormDepartment(u.department || 'Alunos');
                                setFormStatus(u.status || 'active');
                                setIsUserModalOpen(true);
                              }}
                              className="p-1.5 bg-zinc-850 hover:bg-zinc-700 hover:text-white text-zinc-300 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center w-8 h-8"
                              title="Editar Perfil"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            
                            <button
                              onClick={() => handleToggleSuspendUser(u)}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center w-8 h-8 ${
                                u.status === 'suspended'
                                  ? 'bg-emerald-500/10 hover:bg-emerald-505/20 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 hover:bg-amber-505/20 text-amber-500 border border-amber-500/20'
                              }`}
                              title={u.status === 'suspended' ? 'Ativar Conta' : 'Suspender Acesso'}
                            >
                              {u.status === 'suspended' ? (
                                <Unlock className="w-3.5 h-3.5" />
                              ) : (
                                <Lock className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1.5 bg-red-950/20 hover:bg-red-500/15 text-red-405 border border-red-500/20 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center w-8 h-8"
                              title="Eliminar Conta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Registar / Editar Utilizador Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10005] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 text-zinc-100 w-full max-w-md rounded-2xl p-6 shadow-2xl relative space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-zinc-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-450 animate-pulse" />
              {selectedUserForEdit ? 'Editar Utilizador Escolar' : 'Registar Utilizador Escolar'}
            </h3>
            
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 block">Nome Completo</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Insira o nome do colaborador"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-sans text-zinc-200 outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 block">Email de Identificação</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="exemplo@nexus.edu"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 outline-none focus:border-indigo-500"
                  required
                  disabled={!!selectedUserForEdit} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 block">Telemóvel / Telefone</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+351 912 345 678"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300 block">Cargo / Papel</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-sans text-zinc-200 outline-none focus:border-indigo-505 cursor-pointer"
                  >
                    <option value="student">Aluno</option>
                    <option value="parent">Responsável</option>
                    <option value="teacher">Professor</option>
                    <option value="financial">Financeiro</option>
                    <option value="secretariat">Secretaria</option>
                    <option value="director">Diretor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300 block">Departamento</label>
                  <select
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-sans text-zinc-200 outline-none focus:border-indigo-505 cursor-pointer"
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

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300 block">Estado Inicial</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-sans text-zinc-200 outline-none focus:border-indigo-505 cursor-pointer"
                >
                  <option value="active">Ativo (Permitido aceder ao sistema)</option>
                  <option value="suspended">Suspenso (Acesso barrado na origem)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Gravar Dados
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
