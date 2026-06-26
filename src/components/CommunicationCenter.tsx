import React, { useState, useMemo } from 'react';
import { 
  Megaphone, MessageSquare, Plus, Send, Bell, Users, Search, 
  CheckCircle2, Shield, User, Clock, FileText, Mail, Calendar, 
  AlertTriangle, Play, Sparkles, Filter, Archive, Check, Layers,
  Trash2, ChevronRight, X, Volume2, UserCheck, Settings
} from 'lucide-react';
import { Announcement, ChatMessage, UserRole, NotificationPreset } from '../types';

interface CommunicationCenterProps {
  announcements: Announcement[];
  messages: ChatMessage[];
  currentUserRole: UserRole;
  onAddAnnouncement: (ann: Omit<Announcement, 'id' | 'date'>) => void;
  onAddMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  notificationPresets?: NotificationPreset[];
  onUpdateNotificationPresets?: (updated: NotificationPreset[]) => void;
}

interface CommsHistoryItem {
  id: string;
  type: 'email' | 'notification' | 'comunicado' | 'mensagem';
  subject: string;
  body: string;
  target: 'all' | 'teachers' | 'parents' | 'students' | 'class';
  targetDetail?: string;
  dateTime: string;
  status: 'sent' | 'scheduled' | 'draft';
  readStats: string; // "Lido por 14/15", "88% Aberto (Email)", etc.
  isAuto?: boolean;  // automatic trigger?
  autoTriggerType?: string; // "Pagamento atrasado", etc.
}

export default function CommunicationCenter({ 
  announcements, 
  messages, 
  currentUserRole, 
  onAddAnnouncement, 
  onAddMessage,
  notificationPresets = [],
  onUpdateNotificationPresets
}: CommunicationCenterProps) {
  // Tabs for main workspace: New Message Dispatcher, Automation Trigger Rules, Shipping History, and Team Chat
  const [activeTab, setActiveTab] = useState<'dispatcher' | 'automations' | 'history' | 'chat' | 'notifications_config'>('dispatcher');
  const [activeChannel, setActiveChannel] = useState<'gral' | 'direction-teachers' | 'administration-secretariat'>('gral');

  // New message form states
  const [commsChannel, setCommsChannel] = useState<'email' | 'notification' | 'comunicado' | 'mensagem'>('comunicado');
  const [commsTarget, setCommsTarget] = useState<'all' | 'teachers' | 'parents' | 'students' | 'class'>('all');
  const [commsTargetClass, setCommsTargetClass] = useState('9º Ano A');
  const [commsSubject, setCommsSubject] = useState('');
  const [commsBody, setCommsBody] = useState('');
  
  // Scheduling controls
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('2026-06-22T09:30');

  // Search in History
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'email' | 'notification' | 'comunicado' | 'mensagem'>('all');

  // Success toast and action feedback
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Chat message Input
  const [chatInput, setChatInput] = useState('');

  // 1. STATE FOR SENT HISTORY LOGS (Seeded with realistic school institutional data)
  const [commsHistory, setCommsHistory] = useState<CommsHistoryItem[]>([
    {
      id: 'COM-101',
      type: 'comunicado',
      subject: 'Abertura de Matrículas para o Ano Letivo 2026/2027',
      body: 'Informamos a toda a comunidade escolar que a primeira fase de matrículas e renovações já se encontra aberta... via Portal de Secretaria.',
      target: 'all',
      dateTime: '2026-06-01 10:15',
      status: 'sent',
      readStats: 'Lido (98% da Escola)'
    },
    {
      id: 'COM-102',
      type: 'email',
      subject: 'CONVOCATÓRIA: Reunião Pedagógica de Planeamento das Turmas de 9º Ano',
      body: 'Na próxima sexta-feira às 15:30 daremos início à reunião de planificação pedagógica trimestral...',
      target: 'teachers',
      dateTime: '2026-06-09 14:00',
      status: 'sent',
      readStats: '100% Entregue (4/4 Professores)'
    },
    {
      id: 'COM-103',
      type: 'notification',
      subject: 'Campanha de Arrecadação Recreativa de Livros Escolares',
      body: 'A nossa biblioteca está a organizar uma campanha de recolha de livros de ficção literária novos...',
      target: 'all',
      dateTime: '2026-06-11 11:30',
      status: 'sent',
      readStats: 'Lido por 89 encarregados'
    },
    {
      id: 'COM-104',
      type: 'email',
      subject: 'Aviso Importante: Validação Cadastral de Vacinação Escolar Obrigatória',
      body: 'Solicitamos a todos os encarregados de educação o upload digital do Boletim de Vacinas...',
      target: 'parents',
      dateTime: '2026-06-15 09:12',
      status: 'sent',
      readStats: '76% Aberto (Email)'
    },
    {
      id: 'COM-105',
      type: 'email',
      subject: '[Auto-Trigger] Lembrete de Serviços Escolares: Propina Provisória em Atraso',
      body: 'Aviso de regularização em atraso emitido automaticamente para o aluno matriculado Bruno Medeiros...',
      target: 'parents',
      dateTime: '2026-06-18 10:30',
      status: 'sent',
      readStats: 'Lido pelo Encarregado (Margarida Couto)',
      isAuto: true,
      autoTriggerType: 'Pagamento atrasado'
    }
  ]);

  // 2. STATE FOR AUTOMATIONS AND TRIGGERS (The 5 scenarios requested by user)
  const [automations, setAutomations] = useState<Array<{
    id: string;
    name: string;
    scenario: 'pagamento_atrasado' | 'documento_expirado' | 'nova_matricula' | 'falta_excessiva' | 'reuniao_marcada';
    description: string;
    channel: 'email' | 'notification' | 'both';
    targetRole: string;
    active: boolean;
    lastExecuted?: string;
    executionCount: number;
  }>>([
    {
      id: 'AUTO-01',
      name: 'Cobrança Automatizada de Propinas Decorridas',
      scenario: 'pagamento_atrasado',
      description: 'Gatilha e-mail formal de alerta e notificação push passados 5 dias da data limite de vencimento da fatura escolar.',
      channel: 'both',
      targetRole: 'Responsáveis',
      active: true,
      lastExecuted: '2026-06-18 10:30',
      executionCount: 14
    },
    {
      id: 'AUTO-02',
      name: 'Sinalização Preventiva de Certidões e Documentos Expirados',
      scenario: 'documento_expirado',
      description: 'Dispara e-mail de aviso quando o Cartão de Cidadão ou Boletim Clínico de vacinas atinge o prazo legal de validade registado.',
      channel: 'email',
      targetRole: 'Responsáveis & Alunos',
      active: true,
      lastExecuted: '2026-06-12 11:15',
      executionCount: 8
    },
    {
      id: 'AUTO-03',
      name: 'Boas-vindas Automático a Aluno Registado (Nova Matrícula)',
      scenario: 'nova_matricula',
      description: 'Gera mensagem de boas-vindas nas credenciais e-learning, guias pedagógicos, manuais escolares e termos legais institucionais.',
      channel: 'both',
      targetRole: 'Alunos & Responsáveis',
      active: true,
      lastExecuted: '2026-06-20 16:45',
      executionCount: 22
    },
    {
      id: 'AUTO-04',
      name: 'Alerta Crítico de Absentismo e Faltas Excessivas',
      scenario: 'falta_excessiva',
      description: 'Gatilha alertas de segurança e solicitações presenciais na escola quando o rácio de pontualidade/presença letiva desce de 90%.',
      channel: 'both',
      targetRole: 'Responsáveis',
      active: true,
      lastExecuted: '2026-06-15 08:30',
      executionCount: 3
    },
    {
      id: 'AUTO-05',
      name: 'Lembrete Integrado de Reunião com Diretor de Turma',
      scenario: 'reuniao_marcada',
      description: 'Agenda SMS pedagógicos e convites digitais de agenda sempre que um conselho ou diretor marca um encontro formal com país.',
      channel: 'notification',
      targetRole: 'Responsáveis',
      active: false,
      lastExecuted: 'Pendente',
      executionCount: 0
    }
  ]);

  // Ready-made templates mapping
  const templates = [
    {
      id: 'tpl-1',
      badge: 'Mensalidade',
      title: 'Aviso de Pagamento em Atraso',
      subject: 'AVISO DE COBRANÇA: Mensalidade/Propina e Serviços de Secretaria Pendentes',
      body: 'Estimado Encarregado de Educação,\n\nInformamos que se encontra pendente de liquidação o saldo mensal escolar do seu educando relativo ao período atual. Solicitamos a regularização direta através do seu Portal do Responsável (Aba Mensalidades) para evitar coimas pedagógicas ou suspensões de compliance.\n\nCaso já tenha efetuado o pagamento, pedimos que envie o respetivo comprovativo digital de imediato.',
      channel: 'email',
      target: 'parents'
    },
    {
      id: 'tpl-2',
      badge: 'Secretaria',
      title: 'Notificação de Documento Expirado',
      subject: 'ALERTA REQUISITOS: Documentação Escolar em Falta ou Expirada - Nome Completo',
      body: 'Estimado Responsável,\n\nVerificámos que um ou mais documentos de registo do seu educando (Cartão de Cidadão ou Boletim Clínico de Vacinas) encontra-se expirado ou precisa de homologação na secretaria virtual do agrupamento.\n\nSolicitamos a submissão digital imediata de novos ficheiros válidos via aba de Documentos do seu portal de encarregado para devida conformidade.\n\nSecretaria Nexus Edu.',
      channel: 'notification',
      target: 'parents'
    },
    {
      id: 'tpl-3',
      badge: 'Matrícula',
      title: 'Manual de Boas-vindas a Nova Matrícula',
      subject: 'Processo Concluído com Sucesso: Bem-vindo à nossa Comunidade Académica!',
      body: 'Com enorme orgulho damos as boas-vindas ao aluno e à sua família neste novo percurso letivo. A matrícula foi deferida com sucesso.\n\nInformamos que já se encontram ativas as credenciais institucionais de e-learning, acesso a laboratórios digitais e ao Moodle. Recomendamos a consulta do regulamento interno anexado.\n\nGestão Académica Nexus Edu.',
      channel: 'email',
      target: 'students'
    },
    {
      id: 'tpl-4',
      badge: 'Presenças',
      title: 'Alerta Urgente de Falta Excessiva',
      subject: 'ALERTA DE SEGURANÇA PEDAGÓGICA: Excesso de Ausências / Risco de Exclusão de Aluno',
      body: 'Estimado Responsável por Educando,\n\nEntramos em contacto em caráter de urgência para reportar que a assiduidade global da sua educanda desceu abaixo de 90% (Limite legal regulamentar).\n\nA solicitamos o preenchimento e carregamento de comprovativo de diagnóstico ou atestado oficial para justificação das faltas via Portal do Responsável, sob pena de ação retentiva disciplinar imediata.',
      channel: 'both',
      target: 'parents'
    },
    {
      id: 'tpl-5',
      badge: 'Agenda',
      title: 'Convocatória para Reunião Geral de Turma',
      subject: 'CONSELHO ACADÉMICO: Convocatória para Reunião Geral com o Diretor de Turma',
      body: 'Estimados encarregados de educação,\n\nPelo presente convocamos todos os responsáveis pela turma para a Reunião Coordenadora do Terceiro Trimestre, a decorrer na próxima quinta-feira às 18:30 presenciais, no pavilhão de artes n.º 2.\n\nEstará em cima da mesa o balanço do aproveitamento final e orientações para os exames nacionais.\n\nDireção Pedagógica.',
      channel: 'email',
      target: 'parents'
    }
  ];

  // Load a ready template into the composer fields
  const handleLoadTemplate = (tpl: typeof templates[0]) => {
    setCommsSubject(tpl.subject);
    setCommsBody(tpl.body);
    if (tpl.channel === 'both') {
      setCommsChannel('email');
    } else {
      setCommsChannel(tpl.channel as any);
    }
    setCommsTarget(tpl.target as any);
    showNotificationToast(`Modelo "${tpl.title}" carregado e configurado!`);
  };

  const showNotificationToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Dispatch manual message & log sent action
  const handleDispatchComms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commsBody.trim()) return;

    const actualSubject = commsSubject.trim() || `Comunicação Interna - ${new Date().toLocaleDateString()}`;
    const authorName = currentUserRole === 'admin' ? 'Administrador Nexus' : 
                       currentUserRole === 'director' ? 'Dra. Leonor Antunes' : 'Secretaria Geral';

    // Create the history item
    const newItem: CommsHistoryItem = {
      id: `COM-${Date.now().toString().slice(-4)}`,
      type: commsChannel,
      subject: actualSubject,
      body: commsBody,
      target: commsTarget,
      targetDetail: commsTarget === 'class' ? commsTargetClass : undefined,
      dateTime: isScheduled ? scheduledDateTime.replace('T', ' ') : new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: isScheduled ? 'scheduled' : 'sent',
      readStats: isScheduled ? 'Agendado' : (
        commsChannel === 'email' ? 'Pendente de Abertura (0% Lido)' :
        commsChannel === 'notification' ? 'Entregue (A aguardar consulta)' : 'Lido por 1 encarregado'
      )
    };

    // If it's a "comunicado" (mural/announcement), propagate to main backend announcements states so it displays globally!
    if (commsChannel === 'comunicado' && !isScheduled) {
      onAddAnnouncement({
        title: actualSubject,
        content: commsBody,
        author: authorName,
        role: currentUserRole === 'admin' ? 'Controlo do Administrador' : 'Gestora Executiva',
        target: commsTarget === 'class' ? 'all' : (commsTarget as any)
      });
    }

    // Add to history
    setCommsHistory(prev => [newItem, ...prev]);

    // Reset fields
    setCommsSubject('');
    setCommsBody('');
    setIsScheduled(false);

    showNotificationToast(
      isScheduled 
        ? `Sucesso: Envio agendado com precisão para: ${scheduledDateTime.replace('T', ' ')}!`
        : `Sucesso: Mensagem disparada em tempo real e gravada no Histórico!`
    );
  };

  // Toggle state of an automation rule
  const handleToggleAutomation = (id: string) => {
    setAutomations(prev => prev.map(a => {
      if (a.id === id) {
        const nextState = !a.active;
        showNotificationToast(`Gatilho "${a.name}" foi ${nextState ? 'ATIVADO' : 'SUSPENSO'} de forma segura.`);
        return { ...a, active: nextState };
      }
      return a;
    }));
  };

  // Simulate triggering an automation rule immediately!
  const handleSimulateTrigger = (scenario: typeof automations[0]['scenario']) => {
    const matchedAuto = automations.find(a => a.scenario === scenario);
    if (!matchedAuto) return;

    let targetStudentName = 'Bruno Medeiros (ALU-102)';
    let actionDetail = 'Fatura FAT-9902 em atraso há 5 dias.';
    let generatedTitle = '';
    let generatedBody = '';

    if (scenario === 'pagamento_atrasado') {
      generatedTitle = `[AUTOMÁTICO] Alerta de Cobrança: Propina decorrida e não liquidada - ${targetStudentName}`;
      generatedBody = `Informamos o encarregado de Bruno Medeiros que a fatura FAT-9902 pendente de €450,00 excedeu o prazo seguro regulamentar.`;
    } else if (scenario === 'documento_expirado') {
      targetStudentName = 'Alice Siqueira (ALU-101)';
      actionDetail = 'Boletim de Vacinas em falta na ficha individual.';
      generatedTitle = `[AUTOMÁTICO] Requisitos Académicos em Falta: Boletim de Vacinas - ${targetStudentName}`;
      generatedBody = `Prezado Sr. Marcos Siqueira, a validação de ficha escolar indica que o Boletim de Vacinas da aluna Alice encontra-se em falta na base informática.`;
    } else if (scenario === 'nova_matricula') {
      targetStudentName = 'Diogo Fontes (ALU-104)';
      actionDetail = 'Nova matrícula deferida para o 10º Ano B.';
      generatedTitle = `[AUTOMÁTICO] Boas-vindas Académico: Guia de Ingresso de ${targetStudentName}`;
      generatedBody = `Bem-vindo à comunidade pedagógica. Confirmamos o deferimento total do ingresso letivo do aluno Diogo na disciplina correspondente de Matemática.`;
    } else if (scenario === 'falta_excessiva') {
      targetStudentName = 'Diogo Fontes (ALU-104)';
      actionDetail = 'Taxa de assiduidade letiva desceu para 87%.';
      generatedTitle = `[AUTOMÁTICO] Alerta Crítico: Limite de Faltas Escolas Atingido - ${targetStudentName}`;
      generatedBody = `Informamos que as ausências consecutivas e acumuladas do aluno Diogo atingiram os limites regulamentares de exclusão sumária das pautas letivas.`;
    } else if (scenario === 'reuniao_marcada') {
      targetStudentName = 'Alice Siqueira (ALU-101)';
      actionDetail = 'Reunião de Tutoria agendada no Calendário Escolar.';
      generatedTitle = `[AUTOMÁTICO] Confirmação de Agenda: Encontro de Tutoria Pedagógica - ${targetStudentName}`;
      generatedBody = `Seu encontro com o Diretor de Turma Ricardo Neves foi agendado para o dia 26 de Junho às 15:45 na Sala de Reuniões de Pais.`;
    }

    // Add generated automation record to the Sent History log!
    const autoSentItem: CommsHistoryItem = {
      id: `COM-AUTO-${Date.now().toString().slice(-3)}`,
      type: matchedAuto.channel === 'both' ? 'email' : (matchedAuto.channel as any),
      subject: generatedTitle,
      body: generatedBody,
      target: 'parents',
      dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'sent',
      readStats: 'Entregue (Confirmação Pendente)',
      isAuto: true,
      autoTriggerType: matchedAuto.name
    };

    setCommsHistory(prev => [autoSentItem, ...prev]);

    // Update automation last run timestamp and count
    setAutomations(prev => prev.map(a => {
      if (a.scenario === scenario) {
        return {
          ...a,
          executionCount: a.executionCount + 1,
          lastExecuted: new Date().toISOString().replace('T', ' ').slice(0, 16)
        };
      }
      return a;
    }));

    showNotificationToast(`Gatilho de IA Executado: Enviado Alerta para ${targetStudentName} (${actionDetail})!`);
  };

  // Filtered History list
  const filteredHistory = useMemo(() => {
    return commsHistory.filter(item => {
      const matchesSearch = item.subject.toLowerCase().includes(historySearch.toLowerCase()) || 
                            item.body.toLowerCase().includes(historySearch.toLowerCase());
      const matchesFilter = historyFilter === 'all' || item.type === historyFilter;
      return matchesSearch && matchesFilter;
    });
  }, [commsHistory, historySearch, historyFilter]);

  // Handles real-time general school operations chat message send
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    let authorName = 'Administrador Nexus';
    if (currentUserRole === 'teacher') authorName = 'Prof. Ricardo Neves';
    if (currentUserRole === 'secretariat') authorName = 'Clara Rodrigues';
    if (currentUserRole === 'director') authorName = 'Dra. Leonor Antunes';

    onAddMessage({
      sender: authorName,
      role: currentUserRole.toUpperCase(),
      content: chatInput,
      channel: activeChannel
    });

    setChatInput('');
  };

  const channelLabels = {
    'gral': 'canal-geral-escola',
    'direction-teachers': 'direcao-corpo-pedagogico (restrito)',
    'administration-secretariat': 'secretaria-e-administracao (restrito)'
  };

  const currentMessages = messages.filter(m => m.channel === activeChannel);

  return (
    <div id="nexus_comms_center_v2" className="flex flex-col gap-6 w-full text-left font-sans">
      
      {/* SUCCESS POPUP TOAST NOTIFIER */}
      {successToast && (
        <div className="fixed top-24 right-6 z-50 bg-indigo-650 text-white font-sans text-xs px-4 py-3 rounded-xl shadow-2xl border border-indigo-500/30 flex items-center gap-2.5 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span className="font-semibold">{successToast}</span>
        </div>
      )}

      {/* JUMBOTRON HEADER CARD */}
      <div style={{ backgroundColor: '#dfdff2' }} className="p-6 bg-zinc-900 border border-zinc-850 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Layers className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                Centro de Comunicação Escolar
              </span>
              <span className="text-[9.5px] text-zinc-500 font-mono">v3.4 Production</span>
            </div>
            <h1 className="text-lg font-bold text-zinc-100 font-display mt-1">Central de Comunicação Escolar</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Envio centralizado de e-mails, comunicados no mural, mensagens e notificações Push com automatizações de conformidade letiva.
            </p>
          </div>
        </div>

        {/* Action controls / quick view count */}
        <div className="flex items-center gap-3">
          <div style={{ backgroundColor: '#f4f4f8' }} className="p-2 bg-zinc-950 border border-zinc-850 rounded-lg text-center min-w-[70px]">
            <span className="text-[9px] font-mono text-zinc-500 uppercase block">Enviados</span>
            <span className="text-sm font-bold text-zinc-300 font-mono">{commsHistory.length}</span>
          </div>
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center min-w-[80px]">
            <span className="text-[9px] font-mono text-emerald-400 uppercase block">Regras Ativas</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {automations.filter(a => a.active).length} / {automations.length}
            </span>
          </div>
        </div>
      </div>

      {/* TOP NAVIGATION TABS */}
      <div className="flex items-center gap-1 overflow-x-auto py-1 border-b border-zinc-850 scrollbar-none">
        <button
          onClick={() => setActiveTab('dispatcher')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'dispatcher'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Disparadora (Wizard)
        </button>
        <button
          onClick={() => setActiveTab('automations')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'automations'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          Automações & Triggers ({automations.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          Histórico e Confirmação de Leitura
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'chat'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 animate-pulse" />
          Canais Operacionais (Equipa)
        </button>
        <button
          onClick={() => setActiveTab('notifications_config')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'notifications_config'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Settings className="w-3.5 h-3.5 text-indigo-400" />
          Personalização de Alertas Reais
        </button>
      </div>

      {/* WORKSPACE AREA OUTLETS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">

        {/* LEFT COMPILER OUTLET (9 COLS EXCEPT WHEN CHAT) */}
        <div className={`${activeTab === 'chat' ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-6`}>

          {/* TAB 1: NEW MESSAGE DISPATCHER WIZARD */}
          {activeTab === 'dispatcher' && (
            <div style={{ backgroundColor: '#dfdfe8' }} className="bg-zinc-950 border border-zinc-850 rounded-2xl p-6 space-y-6">
              
              <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
                <div>
                  <h2 className="text-sm font-bold text-zinc-200">Rascunhas e Disparos Multicanal</h2>
                  <p className="text-xs text-zinc-500 mt-1">Configure o canal, defina o público-alvo ou use um modelo oficial pronto.</p>
                </div>
                <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-indigo-500" /> Em conformidade RGPD
                </span>
              </div>

              <form onSubmit={handleDispatchComms} className="space-y-4">
                
                {/* Channel & Target settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  
                  <div className="space-y-1.5 text-left">
                    <label className="text-zinc-400 font-bold block">Canal Escolar de Comunicação</label>
                    <select
                      value={commsChannel}
                      onChange={(e: any) => {
                        setCommsChannel(e.target.value);
                        if (e.target.value === 'mensagem') {
                          setCommsTarget('teachers');
                        }
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                    >
                      <option value="comunicado">Comunicado Formal (Mural de Pautas)</option>
                      <option value="email">E-mail Institucional (Template Padronizado)</option>
                      <option value="notification">Notificação Push (Aplicações Móveis)</option>
                      <option value="mensagem">Mensagem de Chat Escolar Interno (Direto)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-zinc-400 font-bold block">Público-Alvo Destinatário</label>
                    <div className="flex gap-2">
                      <select
                        value={commsTarget}
                        onChange={(e: any) => setCommsTarget(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                      >
                        <option value="all">Público Geral (Alunos, Pais e Docentes)</option>
                        <option value="class">Turma Específica (Individualizada)</option>
                        <option value="teachers">Apenas Corpo Docente (Professores)</option>
                        <option value="parents">Apenas Encarregados de Educação (Responsáveis)</option>
                        <option value="students">Apenas Alunos Registados</option>
                      </select>

                      {commsTarget === 'class' && (
                        <select
                          value={commsTargetClass}
                          onChange={(e) => setCommsTargetClass(e.target.value)}
                          className="w-28 bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2 py-2 outline-none focus:border-indigo-500 font-mono text-xs"
                        >
                          <option value="9º Ano A">9º Ano A</option>
                          <option value="10º Ano A">10º Ano A</option>
                          <option value="8º Ano B">8º Ano B</option>
                        </select>
                      )}
                    </div>
                  </div>

                </div>

                {/* Subject / Title */}
                <div className="space-y-1.5 text-left text-xs">
                  <label className="text-zinc-400 font-bold block">Título ou Assunto da Mensagem</label>
                  <input
                    type="text"
                    required
                    value={commsSubject}
                    onChange={(e) => setCommsSubject(e.target.value)}
                    placeholder="Escreva um assunto explicativo e direto..."
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-250 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                {/* Body Textarea */}
                <div className="space-y-1.5 text-left text-xs">
                  <label className="text-zinc-400 font-bold block">Corpo da Mensagem (Rich Style)</label>
                  <textarea
                    required
                    rows={6}
                    value={commsBody}
                    onChange={(e) => setCommsBody(e.target.value)}
                    placeholder="Indique as diretrizes completas, links operacionais ou convocatórias em detalhe..."
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl p-3 outline-none focus:border-indigo-500 font-mono text-xs leading-relaxed"
                  />
                </div>

                {/* AGENDAMENTO CONTROLS */}
                <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-left">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="sched_cb" 
                        checked={isScheduled}
                        onChange={(e) => setIsScheduled(e.target.checked)}
                        className="w-4 h-4 text-indigo-500 bg-zinc-950 border-zinc-850 rounded"
                      />
                      <label htmlFor="sched_cb" className="text-zinc-300 font-bold cursor-pointer">
                        Ativar Agendamento de Disparo
                      </label>
                    </div>
                    <span className="text-[10px] text-zinc-500 block">Programe envios com antecipação automática para fuso horário de Lisboa.</span>
                  </div>

                  {isScheduled && (
                    <input 
                      type="datetime-local" 
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-indigo-400 font-mono font-semibold p-2 rounded-lg outline-none text-xs"
                    />
                  )}
                </div>

                {/* Submitting buttons */}
                <div className="flex justify-end gap-3 text-xs pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCommsSubject('');
                      setCommsBody('');
                      setIsScheduled(false);
                      showNotificationToast('Rascunho descartado com sucesso.');
                    }}
                    className="px-4 py-2 bg-zinc-900 text-zinc-400 font-semibold rounded-lg hover:bg-zinc-850 hover:text-zinc-300 cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-lg cursor-pointer flex items-center gap-2 shadow-lg"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isScheduled ? 'Agendar Envio Digital' : 'Disparar e Registar'}
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* TAB 2: AUTOMATION TRIGGER SCENARIOS */}
          {activeTab === 'automations' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
              
              <div className="text-left space-y-1 border-b border-zinc-850 pb-4">
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Regulamento de Automações Académicas
                </h2>
                <p className="text-xs text-zinc-400">
                  Garantia de conformidade em 5 cenários críticos. Ative ou desative as regras de processo ou efetue simulações de envio pela secretaria escolar.
                </p>
              </div>

              <div className="space-y-4">
                {automations.map((a) => {
                  return (
                    <div 
                      key={a.id} 
                      className={`p-5 rounded-2xl border transition-all ${
                        a.active 
                          ? 'bg-zinc-900/40 border-zinc-800' 
                          : 'bg-zinc-900/10 border-zinc-850 opacity-60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        
                        <div className="space-y-1 text-left flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/10">
                              {a.id}
                            </span>
                            <span className="text-xs font-bold text-zinc-200">{a.name}</span>
                            <span className="text-[10.5px] bg-zinc-950 text-zinc-405 border border-zinc-850 px-1.5 py-0.2 rounded font-mono">
                              Dst: {a.targetRole}
                            </span>
                          </div>
                          
                          <p className="text-xs text-zinc-400 font-sans leading-relaxed pt-1">{a.description}</p>
                          
                          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500 pt-1.5">
                            <span>Canal: <strong className="uppercase text-zinc-405">{a.channel}</strong></span>
                            <span>•</span>
                            <span>Último Disparo: <strong className="text-zinc-405">{a.lastExecuted}</strong></span>
                            <span>•</span>
                            <span>Disparos Acumulados: <strong className="text-indigo-400">{a.executionCount}</strong></span>
                          </div>
                        </div>

                        {/* Interactive toggle and simulation button */}
                        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                          
                          <button
                            onClick={() => handleSimulateTrigger(a.scenario)}
                            className="px-3.5 py-1.5 bg-zinc-950 hover:bg-zinc-900 text-indigo-400 border border-zinc-800 hover:border-zinc-700 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-all"
                          >
                            <Play className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            Simular Disparo
                          </button>

                          <button
                            onClick={() => handleToggleAutomation(a.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              a.active 
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                                : 'bg-zinc-800 text-zinc-450 border border-transparent'
                            }`}
                          >
                            {a.active ? 'Ativo' : 'Desabilitado'}
                          </button>

                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* TAB 3: COMPLETE SENT HISTORY & AUDIT LOG */}
          {activeTab === 'history' && (
            <div style={{ backgroundColor: '#dfdfe8' }} className="bg-zinc-950 border border-zinc-850 rounded-2xl p-6 space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
                <div className="text-left space-y-1">
                  <h2 className="text-sm font-bold text-zinc-200">Histórico de Disparos Registados</h2>
                  <p className="text-xs text-zinc-450">Auditoria integrada de canais e confirmação de visualização institucional.</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Filter tabs */}
                  {(['all', 'email', 'notification', 'comunicado', 'mensagem'] as const).map((cc) => (
                    <button
                      key={cc}
                      onClick={() => setHistoryFilter(cc)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono uppercase border cursor-pointer transition-colors ${
                        historyFilter === cc
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                          : 'bg-zinc-900 text-zinc-500 border-zinc-850 hover:text-zinc-300'
                      }`}
                    >
                      {cc === 'all' ? 'Ver Todos' : cc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search filter bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Pesquisar por assunto ou pauta de histórico..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-700"
                />
                {historySearch && (
                  <button onClick={() => setHistorySearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Table list */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300 min-w-[700px]">
                  <thead>
                    <tr className="bg-zinc-900 text-zinc-500 border-b border-zinc-850 uppercase font-mono text-[9px] tracking-wider">
                      <th className="p-3">Ref ID</th>
                      <th className="p-3">Canal</th>
                      <th className="p-3">Pauta / Assunto</th>
                      <th className="p-3">Alvo</th>
                      <th className="p-3">Data Envio</th>
                      <th className="p-3">Confirmação de Leitura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {filteredHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-900/30">
                        <td className="p-3 font-mono text-[10.5px] text-zinc-500">{item.id}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[9.5px] uppercase font-mono font-bold ${
                            item.type === 'email' ? 'bg-sky-500/10 text-sky-400' :
                            item.type === 'notification' ? 'bg-indigo-500/10 text-indigo-400' :
                            item.type === 'mensagem' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="p-3">
                          <div>
                            <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                              {item.isAuto && <span className="text-[8.5px] bg-red-500/10 text-red-400 font-mono px-1 rounded uppercase">Automático</span>}
                              {item.subject}
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-0.5 max-w-sm truncate">{item.body}</p>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-zinc-400">
                          {item.target === 'all' ? 'Geral (Todos)' : 
                           item.target === 'class' ? `Turma: ${item.targetDetail}` : item.target.toUpperCase()}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-zinc-500">{item.dateTime}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 font-mono text-[10.5px] ${
                            item.readStats.includes('100%') || item.readStats.includes('Lido') ? 'text-emerald-450 font-bold' : 'text-zinc-500'
                          }`}>
                            <CheckCircle2 className={`w-3.5 h-3.5 ${
                              item.readStats.includes('100%') || item.readStats.includes('Lido') ? 'text-emerald-400' : 'text-zinc-600'
                            }`} />
                            {item.readStats}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredHistory.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-zinc-500 italic">
                          Nenhum registo do histórico encaixa nos filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* TAB 4: REALTIME OPERATIONS CHAT FEED */}
          {activeTab === 'chat' && (
            <div id="comms_chat_workspace" style={{ backgroundColor: '#dfdfe8' }} className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden flex flex-col h-[520px]">
              
              {/* Header chat info */}
              <div className="px-6 py-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/50 shrink-0">
                <div className="space-y-0.5 text-left">
                  <span className="text-xs font-semibold font-mono text-zinc-200">{channelLabels[activeChannel]}</span>
                  <p className="text-[10px] text-zinc-500 leading-tight">Canal criptografado seguro de sincronização operacional de equipas e docentes.</p>
                </div>

                {/* Switch channels buttons */}
                <div className="flex gap-1.5">
                  {(Object.keys(channelLabels) as Array<keyof typeof channelLabels>).map((channelKey) => {
                    const isSecured = channelKey !== 'gral';
                    const hasLevel = currentUserRole === 'admin' || currentUserRole === 'director' || 
                                     (currentUserRole === 'teacher' && channelKey !== 'administration-secretariat') ||
                                     (currentUserRole === 'secretariat' && channelKey !== 'direction-teachers');

                    if (isSecured && !hasLevel) return null;

                    return (
                      <button
                        key={channelKey}
                        onClick={() => setActiveChannel(channelKey)}
                        className={`text-[10px] font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer block ${
                          activeChannel === channelKey 
                            ? 'bg-indigo-500/15 border-indigo-500/20 text-indigo-400' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-450 hover:bg-zinc-850 hover:text-zinc-350'
                        }`}
                      >
                        {channelKey === 'gral' ? 'Público Geral' : channelKey === 'direction-teachers' ? 'Coop. Pedagógica' : 'Administração'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message feed stream */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {currentMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-650 italic text-xs">
                    Nenhuma mensagem registada neste canal de trabalho.
                  </div>
                ) : (
                  currentMessages.map(msg => (
                    <div key={msg.id} className="flex gap-3 text-left">
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs text-indigo-400 shrink-0 font-bold uppercase">
                        {msg.sender.charAt(0)}
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-200">{msg.sender}</span>
                          <span className="text-[9px] uppercase font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
                            {msg.role}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">{msg.timestamp}</span>
                        </div>
                        <p className="text-zinc-300 bg-zinc-900/40 border border-zinc-850 p-2.5 rounded-xl leading-relaxed max-w-xl font-sans">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input field */}
              <div className="px-6 py-3 border-t border-zinc-850 bg-zinc-900/30 shrink-0">
                <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Enviar mensagem de trabalho em ${channelLabels[activeChannel]}...`}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 outline-none focus:border-zinc-700 font-sans"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="w-10 h-10 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl flex items-center justify-center cursor-pointer font-bold shrink-0 transition-colors disabled:bg-zinc-900 disabled:text-zinc-550 border border-indigo-400/20"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

            </div>
          )}

          {activeTab === 'notifications_config' && (
            <div style={{ backgroundColor: '#dfdfe8' }} className="bg-zinc-950 border border-zinc-850 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
                <div className="text-left space-y-1">
                  <h2 className="text-sm font-bold text-zinc-200">Personalização Integrada de Alertas Reais</h2>
                  <p className="text-xs text-zinc-450">Controle quais notificações o sistema emite em tempo real, mude títulos e decida quais grupos as visualizam.</p>
                </div>
                <button
                  onClick={() => {
                    if (onUpdateNotificationPresets) {
                      const fallbackPresets: NotificationPreset[] = [
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
                          name: 'Cobrança de Fatura Expirada (Processo Automático)',
                          description: 'Avisos preventivos automáticos de regularização financeira em atraso.',
                          enabled: true,
                          allowedRoles: ['admin', 'financial', 'parent'],
                          customTitle: 'Aviso de Pagamento'
                        },
                        {
                          category: 'automation_enrollment',
                          name: 'Provisionamento de Contas e-Learning (Processo Automático)',
                          description: 'Criação e ligação lógica de contas do aluno no LMS Moodle institucional.',
                          enabled: true,
                          allowedRoles: ['admin', 'secretariat'],
                          customTitle: 'Matrícula Sincronizada'
                        },
                        {
                          category: 'automation_grade',
                          name: 'Alerta Preventivo de Rendimento (Processo Automático)',
                          description: 'Sinalização sob risco de insucesso escolar quando a média é crítica.',
                          enabled: true,
                          allowedRoles: ['admin', 'director', 'teacher', 'parent'],
                          customTitle: 'Alerta Pedagógico Ativado'
                        }
                      ];
                      onUpdateNotificationPresets(fallbackPresets);
                    }
                  }}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white transition-colors text-xs font-semibold rounded-lg shrink-0 cursor-pointer"
                >
                  Restaurar Padrões
                </button>
              </div>

              {/* Preferences list */}
              <div className="space-y-4">
                {notificationPresets.map((preset) => {
                  return (
                    <div key={preset.category} className="p-4 bg-zinc-900/40 border border-zinc-850 rounded-xl space-y-4 text-left transition-all hover:border-zinc-800">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] uppercase font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/10">
                              {preset.category}
                            </span>
                            <h3 className="text-xs font-bold text-zinc-250">{preset.name}</h3>
                          </div>
                          <p className="text-[11px] text-zinc-400 font-sans leading-relaxed pt-0.5">{preset.description}</p>
                        </div>

                        {/* Enable/Disable Toggle */}
                        <button
                          onClick={() => {
                            if (onUpdateNotificationPresets) {
                              const updated = notificationPresets.map(p => 
                                p.category === preset.category ? { ...p, enabled: !p.enabled } : p
                              );
                              onUpdateNotificationPresets(updated);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            preset.enabled 
                              ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' 
                              : 'bg-zinc-800 text-zinc-500 border border-transparent hover:text-zinc-350'
                          }`}
                        >
                          {preset.enabled ? 'Emissão Ativa' : 'Mudo (Sem Avisos)'}
                        </button>
                      </div>

                      {preset.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-zinc-850/50">
                          {/* Title customization */}
                          <div className="space-y-1.5">
                            <label className="text-[10.5px] font-mono text-zinc-400 block font-bold">Título Customizado do Alerta:</label>
                            <input
                              type="text"
                              value={preset.customTitle}
                              onChange={(e) => {
                                if (onUpdateNotificationPresets) {
                                  const updated = notificationPresets.map(p => 
                                    p.category === preset.category ? { ...p, customTitle: e.target.value } : p
                                  );
                                  onUpdateNotificationPresets(updated);
                                }
                              }}
                              placeholder="Insira um título adaptado..."
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-700"
                            />
                          </div>

                          {/* Roles select */}
                          <div className="space-y-1.5">
                            <label className="text-[10.5px] font-mono text-zinc-400 block font-bold">Visualização por Módulo / Regra:</label>
                            <div className="flex flex-wrap gap-1.5">
                              {(['admin', 'director', 'secretariat', 'teacher', 'parent', 'student', 'financial'] as UserRole[]).map((role) => {
                                const isPermitted = preset.allowedRoles.includes(role);
                                return (
                                  <button
                                    key={role}
                                    onClick={() => {
                                      if (onUpdateNotificationPresets) {
                                        const originalRoles = preset.allowedRoles;
                                        const nextRoles = originalRoles.includes(role)
                                          ? originalRoles.filter(r => r !== role)
                                          : [...originalRoles, role];
                                        const updated = notificationPresets.map(p => 
                                          p.category === preset.category ? { ...p, allowedRoles: nextRoles } : p
                                        );
                                        onUpdateNotificationPresets(updated);
                                      }
                                    }}
                                    className={`px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                                      isPermitted
                                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                        : 'bg-zinc-950 text-zinc-550 border-zinc-850 hover:border-zinc-700'
                                    }`}
                                  >
                                    {role === 'admin' ? 'Secretaria/Admin' : 
                                     role === 'director' ? 'Diretor' : 
                                     role === 'secretariat' ? 'Apoio' : 
                                     role === 'teacher' ? 'Docente' : 
                                     role === 'parent' ? 'Resp.' : 
                                     role === 'student' ? 'Estudante' : 'Financeiro'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT METRIC SIDEBAR WITH PRE-CONSTRUCTED MODELS (3 COLS) */}
        {activeTab !== 'chat' && (
          <div className="lg:col-span-4 space-y-6 text-left">
            
            {/* Quick Templates Panel (Macro actions) */}
            <div style={{ backgroundColor: '#d9d9e3' }} className="bg-zinc-950 border border-zinc-850 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">Modelos Académicos Prontos</h3>
                <p className="text-[11px] text-zinc-500">Selecione e carregue modelos de comunicação oficiais para acelerar a redação e compliance municipal.</p>
              </div>

              <div className="space-y-2.5">
                {templates.map((tpl) => {
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => handleLoadTemplate(tpl)}
                      className="w-full text-left p-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-750 transition-all cursor-pointer flex flex-col gap-1 text-xs group"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono select-none">
                        <span className="font-bold text-indigo-450 uppercase">{tpl.badge}</span>
                        <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">Carregar →</span>
                      </div>
                      <h4 className="font-bold text-zinc-250 group-hover:text-white transition-colors">{tpl.title}</h4>
                      <p className="text-[10px] text-zinc-500 leading-normal line-clamp-2 mt-0.5">{tpl.body}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick analytics card / info */}
            <div style={{ backgroundColor: '#f0f0fb' }} className="bg-zinc-950 border border-zinc-850 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">Dicas de Comunicação</h3>
              <ul className="text-xs text-zinc-400 space-y-2.5 leading-relaxed font-sans">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                  <span>Use e-mails formais e explicativos para assuntos que envolvem faturas ou suspensões letivas.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                  <span>Notificações digitais (app) produzem maior taxa de abertura em tempo real (~82% nas primeiras 2h).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                  <span>Preencha sempre um fuso horário e agende com devida prudência (horas úteis) para pais.</span>
                </li>
              </ul>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
