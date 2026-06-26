import React, { useState, useEffect } from 'react';
import { 
  ToggleLeft, ToggleRight, Play, Server, Zap, CheckCircle, ArrowRight, 
  ShieldCheck, Cpu, RefreshCw, Layers, Plus, Trash2, Mail, MessageSquare, 
  AlertTriangle, FileCheck, CheckCircle2, FileText, Database, Clock, Eye, 
  Send, Sparkles, Sliders, Settings, Check, UserPlus, FileUp, ShieldAlert,
  ChevronRight, Laptop, Terminal, UserCheck
} from 'lucide-react';
import { AutomationFlow, Student, Invoice } from '../types';
import { getHeaders } from '../supabaseClient';

interface AutomationsSectionProps {
  flows: AutomationFlow[];
  onToggleFlow: (id: string) => void;
  onSimulateFlow: (id: string) => void;
}

interface AutomationLog {
  id: string;
  time: string;
  flowTitle: string;
  trigger: string;
  status: 'success' | 'warn' | 'info';
  detail: string;
  elapsedMs: number;
  timeSavedMins: number;
}

interface SimulatedNotification {
  type: 'whatsapp' | 'email' | 'system' | 'sms';
  recipient: string;
  title: string;
  body: string;
  timestamp: string;
  details?: Record<string, string>;
}

export default function AutomationsSection({ flows, onToggleFlow, onSimulateFlow }: AutomationsSectionProps) {
  // We can maintain a local list of flows that we can add to, initialized by the props
  const [localFlows, setLocalFlows] = useState<AutomationFlow[]>(flows);
  
  // Sync if props change
  useEffect(() => {
    setLocalFlows(flows);
  }, [flows]);

  // Read mock lists from localStorage if available to populate interactive helper selectors
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [invoicesList, setInvoicesList] = useState<Invoice[]>([]);

  useEffect(() => {
    try {
      const storedSt = localStorage.getItem('nexus_students');
      const storedIv = localStorage.getItem('nexus_invoices');
      if (storedSt) setStudentsList(JSON.parse(storedSt));
      if (storedIv) setInvoicesList(JSON.parse(storedIv));
    } catch (e) {
      console.warn("Failed to load select contexts", e);
    }
  }, []);

  // Detailed Log History
  const [logs, setLogs] = useState<AutomationLog[]>([
    { 
      id: 'L-101', 
      time: '09:30:15', 
      flowTitle: 'Alerta Automático de Ausência Diária', 
      trigger: 'Ausência do Aluno Registada', 
      status: 'success', 
      detail: 'Falta do aluno Bruno Medeiros captada pelo módulo da secretaria. WhatsApp emitido para a Encarregada (Sandra Medeiros: +351 912 345 678). Link de justificação anexado.',
      elapsedMs: 340,
      timeSavedMins: 15
    },
    { 
      id: 'L-102', 
      time: '10:00:22', 
      flowTitle: 'Cobrança Preventiva de Tuition', 
      trigger: 'Fatura Overdue Detetada', 
      status: 'success', 
      detail: 'Varredura automática localizou 3 faturas overdue. Notificações de cobrança e circulares geradas e enviadas por E-mail customizado.',
      elapsedMs: 512,
      timeSavedMins: 30
    }
  ]);

  // Simulated Notification popup showcase state
  const [activeNotification, setActiveNotification] = useState<SimulatedNotification | null>({
    type: 'whatsapp',
    recipient: 'Sandra Medeiros (+351 912 345 678)',
    title: 'Aviso de Ausência: Bruno Medeiros',
    body: 'Bom dia Sra. Sandra Medeiros. Informamos que o seu educando Bruno Medeiros não se encontra registado na chamada de presença letiva de hoje (15/06). Por favor responda carregando no link ou envie justificação em https://nexus.edu/j/FL401.',
    timestamp: '09:30',
  });

  // State handles for the 4 interactive scenario simulators
  const [simulatorTab, setSimulatorTab] = useState<'absence' | 'payment' | 'matricula' | 'ocr'>('absence');
  const [isSimulatingRun, setIsSimulatingRun] = useState(false);

  // Absence simulator options
  const [absenceStudentId, setAbsenceStudentId] = useState('');
  const [absenceReason, setAbsenceReason] = useState('Injustificada');

  // Payment simulator options
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('');
  const [paymentUrgency, setPaymentUrgency] = useState<'normal' | 'alta' | 'critica'>('normal');

  // Matricula simulator options
  const [newMatriculaName, setNewMatriculaName] = useState('');
  const [newMatriculaClass, setNewMatriculaClass] = useState('8º Ano A');
  const [newMatriculaCourse, setNewMatriculaCourse] = useState('Ensino Regular Básico');

  // OCR document simulator options
  const [ocrDocStudentId, setOcrDocStudentId] = useState('');
  const [ocrDocType, setOcrDocType] = useState('Documento de Identificação (CC)');
  const [ocrScanQuality, setOcrScanQuality] = useState('98.4% Accuracy');

  // Custom Flow creation state
  const [isCreatingFlow, setIsCreatingFlow] = useState(false);
  const [newFlowTitle, setNewFlowTitle] = useState('');
  const [newFlowDesc, setNewFlowDesc] = useState('');
  const [newFlowTrigger, setNewFlowTrigger] = useState('Falta injustificada registada');
  const [newFlowAction, setNewFlowAction] = useState('Disparar aviso instantâneo via WhatsApp');
  const [newFlowChannel, setNewFlowChannel] = useState<'sms' | 'email' | 'system' | 'whatsapp'>('whatsapp');

  // Helper defaults
  useEffect(() => {
    // Select first student and invoice by default
    if (studentsList.length > 0) {
      setAbsenceStudentId(studentsList[0].id);
      setOcrDocStudentId(studentsList[0].id);
    }
    const overdueOrPending = invoicesList.find(i => i.status !== 'paid');
    if (overdueOrPending) {
      setPaymentInvoiceId(overdueOrPending.id);
    } else if (invoicesList.length > 0) {
      setPaymentInvoiceId(invoicesList[0].id);
    }
  }, [studentsList, invoicesList]);

  // Simulation execution handlers
  const handleExecuteAbsenceSimulation = () => {
    const student = studentsList.find(s => s.id === absenceStudentId);
    if (!student) return;

    setIsSimulatingRun(true);
    // Find the absence flow to increment executions
    const flowId = 'FLUX-01'; 
    onSimulateFlow(flowId);

    // Refresh local execution counts on list
    setLocalFlows(prev => prev.map(f => f.id === flowId ? { ...f, executions: f.executions + 1 } : f));

    setTimeout(async () => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      
      const newLog: AutomationLog = {
        id: `L-${Date.now().toString().slice(-4)}`,
        time: timeStr,
        flowTitle: 'Alerta Automático de Ausência Diária',
        trigger: 'Ausência do Aluno Registada',
        status: 'success',
        detail: `Fluxo n8n despoletado. Registro de ausência do aluno: ${student.name} (${student.class}) efetuado. Notificação de ausência enviada para o responsável legal: ${student.guardiansName} (${student.guardiansContact}).`,
        elapsedMs: Math.floor(200 + Math.random() * 200),
        timeSavedMins: 15
      };

      setLogs(prev => [newLog, ...prev]);
      setIsSimulatingRun(false);

      // Create WhatsApp notifications preview
      setActiveNotification({
        type: 'whatsapp',
        recipient: `${student.guardiansName} (${student.guardiansContact})`,
        title: `Notificação de Falta: ${student.name}`,
        body: `Olá ${student.guardiansName}, informamos que o seu educando ${student.name} registou uma ausência às aulas agendadas hoje (${now.toLocaleDateString('pt-PT')}). Por favor, aceda a https://nexus.edu/j/${student.id} para justificar online de imediato.`,
        timestamp: now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
      });
      
      // Registar registo de operação do sistema em segundo plano
      fetch('/api/chat', {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ prompt: `Gere um log na base escolar de que o módulo de automação realizou o envio de aviso de ausência do aluno ${student.name} para o responsável ${student.guardiansName}.` })
      }).catch(err => console.log('silent log entry complete'));

    }, 1200);
  };

  const handleExecutePaymentSimulation = () => {
    const invoice = invoicesList.find(i => i.id === paymentInvoiceId);
    if (!invoice) return;

    setIsSimulatingRun(true);
    const flowId = 'FLUX-02';
    onSimulateFlow(flowId);

    setLocalFlows(prev => prev.map(f => f.id === flowId ? { ...f, executions: f.executions + 1 } : f));

    setTimeout(async () => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      
      const newLog: AutomationLog = {
        id: `L-${Date.now().toString().slice(-4)}`,
        time: timeStr,
        flowTitle: 'Cobrança Preventiva de Tuition',
        trigger: 'Fatura Overdue Detetada',
        status: 'success',
        detail: `Análise periódica detetou fatura atrasada/atenuante: ${invoice.id} do aluno ${invoice.studentName} [Valor: €${invoice.amount}]. E-mail corporativo enviado e aviso push agendado para o agregado financeiro.`,
        elapsedMs: Math.floor(300 + Math.random() * 250),
        timeSavedMins: 20
      };

      setLogs(prev => [newLog, ...prev]);
      setIsSimulatingRun(false);

      setActiveNotification({
        type: 'email',
        recipient: `financeiro@nexus.edu / encarregado_${invoice.studentName.toLowerCase().replace(' ', '_')}@gmail.com`,
        title: `Lembrete de Cobrança: Fatura Escolar Vencida ${invoice.id}`,
        body: `Prezado encarregado de educação de ${invoice.studentName}. Contactamo-lo para recordar que a fatura número ${invoice.id} no montante de €${invoice.amount}, correspondente a ${invoice.category === 'tuition' ? 'Mensalidade Escolar' : invoice.category}, encontra-se vencida desde a data limite ${invoice.dueDate}. Agradecemos a regularização via Multibanco ou Transferência disponível na sua área financeira de aluno.`,
        timestamp: now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        details: {
          'Fatura ID': invoice.id,
          'Aluno': invoice.studentName,
          'Valor Total': `€${invoice.amount}`,
          'Estado Atual': invoice.status.toUpperCase()
        }
      });
      
      // Sync log to database in background
      fetch('/api/chat', {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ prompt: `Gere um log na base de dados referindo que a automação disparou aviso e-mail de cobrança vencida para o encarregado do aluno ${invoice.studentName}.` })
      }).catch(err => console.log('silent pg log complete'));

    }, 1200);
  };

  const handleExecuteMatriculaSimulation = () => {
    if (!newMatriculaName.trim()) return;

    setIsSimulatingRun(true);
    const flowId = 'FLUX-03';
    onSimulateFlow(flowId);

    setLocalFlows(prev => prev.map(f => f.id === flowId ? { ...f, executions: f.executions + 1 } : f));

    setTimeout(async () => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const normalizedName = newMatriculaName.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const emailUsername = normalizedName.replace(/\s+/g, '.');
      const mockEmail = `${emailUsername}@nexus.edu`;
      const tempPass = `Nexus@${Math.floor(1000 + Math.random() * 9000)}`;

      const newLog: AutomationLog = {
        id: `L-${Date.now().toString().slice(-4)}`,
        time: timeStr,
        flowTitle: 'Sincronização de Nova de Matrícula',
        trigger: 'Nova Matrícula Validada',
        status: 'success',
        detail: `Onboarding de matrícula executado para ${newMatriculaName}. Provisionamento efetuado: perfil institucional Google Workspace [${mockEmail}] e matrícula na sala do Moodle para ${newMatriculaClass}.`,
        elapsedMs: Math.floor(650 + Math.random() * 300),
        timeSavedMins: 45
      };

      setLogs(prev => [newLog, ...prev]);
      setIsSimulatingRun(false);

      // Create corporate credentials output notification
      setActiveNotification({
        type: 'system',
        recipient: `${newMatriculaName} (Diretório Escolar)`,
        title: 'Provisionamento de Acessos SaaS Concluído',
        body: `Perfil escolar e credenciais integradas criadas com sucesso por processo em lote.`,
        timestamp: now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        details: {
          'Estudante': newMatriculaName,
          'Turma': newMatriculaClass,
          'E-mail Escolar': mockEmail,
          'Senha Provisória': tempPass,
          'Plataformas': 'Google Suite, Classroom, Moodle LMS, Active Directory',
          'Status Acessos': 'ATIVO'
        }
      });

      // Registar registo no sistema central
      fetch('/api/chat', {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ prompt: `Registe log no Diário de Operações: Matrícula de ${newMatriculaName} ativou o motor de automação que criou e-mail ${mockEmail} e acessos Moodle.` })
      }).catch(err => console.log('silent log complete'));
      
      setNewMatriculaName('');
    }, 1500);
  };

  const handleExecuteOcrSimulation = () => {
    const student = studentsList.find(s => s.id === ocrDocStudentId);
    if (!student) return;

    setIsSimulatingRun(true);
    const flowId = 'FLUX-04';
    // If it exists in initial flow logs, increment it
    setLocalFlows(prev => prev.map(f => f.id === flowId ? { ...f, executions: f.executions + 1 } : f));

    setTimeout(async () => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const docSlug = ocrDocType.toLowerCase().replace(/[\s\(\)]+/g, '_');
      const mockStoragePath = `/Documentos/Dossies_Alunos/${student.class.replace(/\s+/g, '_')}/${student.id}_${student.name.replace(/\s+/g, '_')}/${docSlug}.pdf`;

      const newLog: AutomationLog = {
        id: `L-${Date.now().toString().slice(-4)}`,
        time: timeStr,
        flowTitle: 'Organização Automática de Ficheiros OCR',
        trigger: 'Documento Recebido no Dossier',
        status: 'success',
        detail: `Leitor OCR processou ficheiro PDF enviado por Encarregado de ${student.name}. Tipo de documento classificado: "${ocrDocType}". Arquivado no Cloud Drive organizado em: "${mockStoragePath}".`,
        elapsedMs: Math.floor(450 + Math.random() * 200),
        timeSavedMins: 10
      };

      setLogs(prev => [newLog, ...prev]);
      setIsSimulatingRun(false);

      setActiveNotification({
        type: 'whatsapp',
        recipient: `${student.guardiansName} (${student.guardiansContact})`,
        title: 'Verificação de Documento Concluída',
        body: `Olá ${student.guardiansName}. Recebemos e processamos automaticamente com sucesso o documento "${ocrDocType}" de ${student.name}. O seu dossiê administrativo foi updated para verificado e conforme. Obrigado.`,
        timestamp: now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
      });
      
      // Registar registo no sistema central
      fetch('/api/chat', {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ prompt: `Registe log no Diário de Operações: Documento OCR do tipo ${ocrDocType} classificado e enviado de forma automática na pasta cloud de ${student.name}.` })
      }).catch(err => console.log('silent log complete'));

    }, 1200);
  };

  // Add custom flow trigger action
  const handleCreateCustomFlow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlowTitle.trim()) return;

    const newFlow: AutomationFlow = {
      id: `FLUX-${Math.floor(10 + Math.random() * 90)}`,
      title: newFlowTitle,
      description: newFlowDesc || 'Fluxo customizado configurado pelo administrador da instituição.',
      trigger: newFlowTrigger,
      action: newFlowAction,
      active: true,
      type: newFlowChannel,
      executions: 0
    };

    setLocalFlows(prev => [...prev, newFlow]);
    setIsCreatingFlow(false);

    // Register log
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const createdLog: AutomationLog = {
      id: `L-${Date.now().toString().slice(-4)}`,
      time: timeStr,
      flowTitle: 'Processo Customizado Criado',
      trigger: 'Definição de Nova Regra',
      status: 'info',
      detail: `Criado novo processo automatizado: "${newFlow.title}". Trigger: [${newFlow.trigger}] -> Ação: [${newFlow.action}].`,
      elapsedMs: 45,
      timeSavedMins: 0
    };
    setLogs(prev => [createdLog, ...prev]);

    // Reset fields
    setNewFlowTitle('');
    setNewFlowDesc('');
  };

  // Toggle state
  const handleToggle = (id: string) => {
    onToggleFlow(id);
    setLocalFlows(prev => prev.map(f => f.id === id ? { ...f, active: !f.active } : f));
    
    const target = localFlows.find(f => f.id === id);
    if (!target) return;

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const toggleLog: AutomationLog = {
      id: `L-${Date.now().toString().slice(-4)}`,
      time: timeStr,
      flowTitle: target.title,
      trigger: 'Intervenção Administrativa',
      status: 'info',
      detail: `O fluxo de automação foi ${!target.active ? 'HABILITADO' : 'SUSPENSO'} no nó central de n8n do sistema escolar.`,
      elapsedMs: 80,
      timeSavedMins: 0
    };
    setLogs(prev => [toggleLog, ...prev]);
  };

  // Compute analytics
  const totalExecutions = localFlows.reduce((sum, f) => sum + f.executions, 0) + logs.filter(l => l.status === 'success').length;
  const activeFlowsCount = localFlows.filter(f => f.active).length;
  const estimatedHoursSaved = Math.round((totalExecutions * 15) / 60);

  return (
    <div id="nexus_automations_engine" className="space-y-8 animate-fadeIn text-zinc-300">
      
      {/* 1. Header & Live Indicator Telemetry */}
      <section className="flex flex-col lg:flex-row justify-between lg:items-end border-b border-zinc-800 pb-6 gap-6">
        <div>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded font-mono font-bold tracking-[0.1em] flex items-center gap-1.5 w-fit">
            <Server className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
            CENTRAL DE PROCESSOS ESCOLARES
          </span>
          <h1 className="text-4xl font-bold font-display tracking-tight text-white mt-3">
            Motor de Automação Escolar
          </h1>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-2xl">
            Central de fluxos inteligentes e comunicações programadas. Reduza tarefas burocráticas manuais através de respostas e avisos automáticos em tempo real na base geral escolar.
          </p>
        </div>

        {/* Global Performance Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto shrink-0">
          <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl">
            <span className="text-[10px] uppercase font-mono text-zinc-550 block font-bold">Fluxos Ativos</span>
            <div className="text-xl font-light font-mono text-zinc-100 mt-1">{activeFlowsCount} <span className="text-zinc-650 text-xs">/ {localFlows.length}</span></div>
          </div>
          <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl">
            <span className="text-[10px] uppercase font-mono text-zinc-550 block font-bold">Total Disparos</span>
            <div className="text-xl font-light font-mono text-indigo-400 mt-1">{totalExecutions}</div>
          </div>
          <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl">
            <span className="text-[10px] uppercase font-mono text-zinc-550 block font-bold">Horas Poupatas</span>
            <div className="text-xl font-light font-mono text-emerald-400 mt-1">~{estimatedHoursSaved}h</div>
          </div>
          <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl">
            <span className="text-[10px] uppercase font-mono text-zinc-550 block font-bold">Taxa de Entrega</span>
            <div className="text-xs font-semibold font-mono text-emerald-400 mt-2.5 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-450 animate-ping inline-block"></span>
              99.8% OK
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid: Left Rules Panel & Right Console/Previews */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* LEFT TWO COLUMNS: CONFIGURE WORKFLOWS */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* Section title */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-lg font-bold font-display text-white">Regras e Conectores Automatizados</h2>
              <p className="text-xs text-zinc-440">Selecione, altere e controle o estado operativo de cada conector inteligente.</p>
            </div>
            
            <button
              onClick={() => setIsCreatingFlow(true)}
              className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-450 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Criar Conector
            </button>
          </div>

          {/* Flows Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {localFlows.map(flow => (
              <div 
                key={flow.id}
                className={`bg-[#111111] p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between h-[230px] ${
                  flow.active 
                    ? 'border-zinc-800 hover:border-zinc-700/80' 
                    : 'border-zinc-900 opacity-60 hover:opacity-100'
                }`}
              >
                {/* Active indicator dot and toggle */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[9px] font-mono font-bold tracking-widest text-indigo-400 uppercase">
                      {flow.id} • {flow.type.toUpperCase()}
                    </span>
                    <h3 className="text-sm font-semibold text-zinc-100 mt-1 font-display">
                      {flow.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleToggle(flow.id)}
                    className="p-1 rounded text-zinc-400 hover:text-white transition cursor-pointer"
                    title={flow.active ? 'Suspender Operação' : 'Habilitar Operação'}
                  >
                    {flow.active ? (
                      <ToggleRight className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-zinc-700" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-zinc-440 leading-relaxed font-sans line-clamp-2 mt-2">
                  {flow.description}
                </p>

                {/* Automation Logic Card (WHEN -> DO) */}
                <div className="bg-zinc-950 p-2 border border-zinc-850 rounded-lg text-[9px] font-mono text-zinc-350 space-y-1 mt-3">
                  <div className="flex items-center gap-1.5 truncate">
                    <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="text-zinc-650 font-bold uppercase">WHEN:</span>
                    <span className="truncate">{flow.trigger}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate text-emerald-400 border-t border-zinc-900 pt-1">
                    <Send className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="text-zinc-650 font-bold uppercase">DO:</span>
                    <span className="truncate">{flow.action}</span>
                  </div>
                </div>

                {/* Footer specs of card */}
                <div className="flex items-center justify-between border-t border-zinc-900 pt-3 mt-3 text-[10px] text-zinc-500">
                  <span className="font-mono">
                    Execuções: <b className="text-zinc-300">{flow.executions}</b>
                  </span>
                  
                  {flow.active ? (
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      ESCORRA ATIVA
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      SUSPENSO
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 2. LIVE SANDBOX EVENT PROCESSOR (REAL SCENARIO SIMULATOR) */}
          <div id="sandbox_event_processor" className="bg-[#111111] border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div>
              <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded font-mono font-bold w-fit block uppercase">
                ⚙️ Simulador Integrado de Processos
              </span>
              <h2 className="text-base font-semibold text-white font-display mt-2.5">
                Simulador de Eventos Académicos de Alta Fidelidade
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Dispare artificialmente um evento escolar real sobre a base de dados escolar para visualizar as reações em lote, o processamento de regras, a auditoria e as notificações geradas.
              </p>
            </div>

            {/* Selector Tabs for 4 mandated scenarios */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-zinc-950 p-1 border border-zinc-850 rounded-xl text-xs font-mono">
              <button
                onClick={() => setSimulatorTab('absence')}
                className={`py-2 px-3 rounded-lg cursor-pointer transition text-center flex flex-col items-center justify-center gap-1 ${
                  simulatorTab === 'absence' ? 'bg-zinc-900 border border-zinc-800 text-amber-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Ausência Registrada</span>
              </button>

              <button
                onClick={() => setSimulatorTab('payment')}
                className={`py-2 px-3 rounded-lg cursor-pointer transition text-center flex flex-col items-center justify-center gap-1 ${
                  simulatorTab === 'payment' ? 'bg-zinc-900 border border-zinc-800 text-amber-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Pagamento Atrasado</span>
              </button>

              <button
                onClick={() => setSimulatorTab('matricula')}
                className={`py-2 px-3 rounded-lg cursor-pointer transition text-center flex flex-col items-center justify-center gap-1 ${
                  simulatorTab === 'matricula' ? 'bg-zinc-900 border border-zinc-800 text-amber-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Matrícula Criada</span>
              </button>

              <button
                onClick={() => setSimulatorTab('ocr')}
                className={`py-2 px-3 rounded-lg cursor-pointer transition text-center flex flex-col items-center justify-center gap-1 ${
                  simulatorTab === 'ocr' ? 'bg-zinc-900 border border-zinc-800 text-amber-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <FileUp className="w-4 h-4" />
                <span>Ficheiro de Candidato</span>
              </button>
            </div>

            {/* TAB PANES */}
            <div className="bg-zinc-950 rounded-xl border border-zinc-900 p-5 font-mono text-xs">
              
              {/* Absences Pane */}
              {simulatorTab === 'absence' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-2 mb-2 text-zinc-400">
                    <CheckCircle2 className="w-4 h-4 text-amber-500" />
                    <span>PROCESSO: ausência do estudante → WhatsApp de alerta ao encarregado</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono block">Selecionar Aluno da Base</label>
                      <select 
                        value={absenceStudentId}
                        onChange={(e) => setAbsenceStudentId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 py-2 px-3 rounded outline-none h-9 text-xs"
                      >
                        {studentsList.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.class}) • Assiduidade: {s.attendanceRate}%</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono block">Tipo de Ausência Recorrente</label>
                      <select 
                        value={absenceReason}
                        onChange={(e) => setAbsenceReason(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 py-2 px-3 rounded outline-none h-9 text-xs"
                      >
                        <option value="Injustificada">Injustificada (Falta da Manhã)</option>
                        <option value="Sistemática">Sistemática (Ausência repetida em exames)</option>
                        <option value="Atraso Grave">Atraso Grave (&gt; 30 minutos)</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                    *<b>Ação do Motor</b>: O sistema identificará o registo da chamada diária, procurará o contacto da Encarregada de Educação do estudante selecionado na base de dados, estruturará um link de justificação e enviará a notificação por WhatsApp.
                  </p>

                  <div className="pt-2">
                    <button
                      onClick={handleExecuteAbsenceSimulation}
                      disabled={isSimulatingRun || studentsList.length === 0}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold px-4 py-2 rounded font-mono text-xs cursor-pointer"
                    >
                      {isSimulatingRun ? 'Processando Comunicação...' : 'Registrar Ausência & Alerta WhatsApp'}
                    </button>
                  </div>
                </div>
              )}

              {/* Payments/Debt Pane */}
              {simulatorTab === 'payment' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-2 mb-2 text-zinc-400">
                    <CheckCircle2 className="w-4 h-4 text-amber-500" />
                    <span>PROCESSO: pagamento em atraso → e-mail de aviso do encarregado</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono block">Selecionar Fatura de Cobrança</label>
                      <select 
                        value={paymentInvoiceId}
                        onChange={(e) => setPaymentInvoiceId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 py-2 px-3 rounded outline-none h-9 text-xs"
                      >
                        {invoicesList.filter(inv => inv.status !== 'paid').map(i => (
                          <option key={i.id} value={i.id}>{i.id} - {i.studentName} (€{i.amount}) [{i.status.toUpperCase()}]</option>
                        ))}
                        {invoicesList.filter(inv => inv.status === 'paid').map(i => (
                          <option key={i.id} value={i.id}>{i.id} - {i.studentName} (€{i.amount}) [PAGO]</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono block">Predefinição de Urgência</label>
                      <select 
                        value={paymentUrgency}
                        onChange={(e) => setPaymentUrgency(e.target.value as any)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 py-2 px-3 rounded outline-none h-9 text-xs"
                      >
                        <option value="normal">Normal (Lembrete Cortês para Pauta)</option>
                        <option value="alta">Alta (Último dia de Prazo)</option>
                        <option value="critica">Crítica (Fatura Vencida Há &gt; 10 dias + Multas)</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                    *<b>Ação do Motor</b>: Varre periodicamente na tabela `invoices` faturas devidas. Constrói um template corporativo com linha de saldo, referência bancária encriptada de pagamento e envia por servidor de e-mail seguro SMTP, mitigando inadimplências ativas.
                  </p>

                  <div className="pt-2">
                    <button
                      onClick={handleExecutePaymentSimulation}
                      disabled={isSimulatingRun || invoicesList.length === 0}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold px-4 py-2 rounded font-mono text-xs cursor-pointer"
                    >
                      {isSimulatingRun ? 'Compilando Elementos...' : 'Tratar Inadimplência & Emitir E-mail'}
                    </button>
                  </div>
                </div>
              )}

              {/* Matricula Pane */}
              {simulatorTab === 'matricula' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-2 mb-2 text-zinc-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>PROCESSO: nova matrícula aprovada → gerar acessos ao Workspace e Moodle</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5 md:col-span-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono block">Nome do Aluno Matriculado</label>
                      <input 
                        type="text" 
                        placeholder="ex: Thiago Neves" 
                        value={newMatriculaName}
                        onChange={(e) => setNewMatriculaName(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 py-2 px-3 rounded outline-none h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono block">Turma de Integração</label>
                      <select 
                        value={newMatriculaClass}
                        onChange={(e) => setNewMatriculaClass(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 py-2 px-3 rounded outline-none h-9 text-xs"
                      >
                        <option value="8º Ano A">8º Ano A</option>
                        <option value="9º Ano B">9º Ano B</option>
                        <option value="10º Ano C">10º Ano C (Artes)</option>
                        <option value="11º Ano A">11º Ano A (Tecnologias)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono block">Curso Escolhido</label>
                      <select 
                        value={newMatriculaCourse}
                        onChange={(e) => setNewMatriculaCourse(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 py-2 px-3 rounded outline-none h-9 text-xs"
                      >
                        <option value="Ensino Regular Básico">Ensino Regular Básico</option>
                        <option value="Científico-Humanístico">Científico-Humanístico</option>
                        <option value="Profissional Informática">Profissional Informática</option>
                      </select>
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                    *<b>Ação do Motor</b>: Ao oficializar a validação documental da inscrição na secretaria, o motor comunica-se bidirecionalmente via API do Google Workspace Developer Dashboard, autogera o e-mail @nexus.edu, cria a pasta de aluno compartilhada no Drive e o inscreve em tempo real no Moodle LMS.
                  </p>

                  <div className="pt-2">
                    <button
                      onClick={handleExecuteMatriculaSimulation}
                      disabled={isSimulatingRun || !newMatriculaName.trim()}
                      className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold px-4 py-2 rounded font-mono text-xs cursor-pointer"
                    >
                      {isSimulatingRun ? 'Comunicando APIs Externas...' : 'Integrar Matrícula (Workspace + Moodle)'}
                    </button>
                  </div>
                </div>
              )}

              {/* OCR document Pane */}
              {simulatorTab === 'ocr' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-2 mb-2 text-zinc-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>PROCESSO: ficheiro enviado → leitura por OCR e organização em arquivo seguro</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5 md:col-span-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono block">Estudante Destinatário</label>
                      <select 
                        value={ocrDocStudentId}
                        onChange={(e) => setOcrDocStudentId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 py-2 px-3 rounded outline-none h-9 text-xs"
                      >
                        {studentsList.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono block">Documento de Onboarding</label>
                      <select 
                        value={ocrDocType}
                        onChange={(e) => setOcrDocType(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 py-2 px-3 rounded outline-none h-9 text-xs"
                      >
                        <option value="Documento de Identificação (CC)">Cartão de Cidadão (Encarregado)</option>
                        <option value="Contrato de Onboarding Assinado">Contrato de Prestação Letiva</option>
                        <option value="Boletim de Vacinas Conforme">Boletim de Saúde / Vacinação</option>
                        <option value="Comprovativo Fiscal de IBAN">Comprovativo Fiscal Escolar</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono block">Precisão Esperada da IA OCR</label>
                      <input 
                        type="text" 
                        readOnly 
                        value={ocrScanQuality}
                        className="w-full bg-zinc-905 border border-zinc-850 text-zinc-500 py-2 px-3 rounded outline-none h-9 text-xs cursor-not-allowed select-none"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                    *<b>Ação do Motor</b>: Ficheiro carregado ativa scanner inteligente. Extrai metadados via IA de visão de documentos, descobre o ID nacional, categoriza no dossiê virtual correto do aluno correspondente no Drive e marca conformidade no painel administrativo.
                  </p>

                  <div className="pt-2">
                    <button
                      onClick={handleExecuteOcrSimulation}
                      disabled={isSimulatingRun || studentsList.length === 0}
                      className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold px-4 py-2 rounded font-mono text-xs cursor-pointer"
                    >
                      {isSimulatingRun ? 'Mapeando Padrões Vision OCR...' : 'Executar Validação & Arquivo Inteligente'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: NOTIFICATION PREVIEWS & EVENT LOGS */}
        <div className="space-y-8">
          
          {/* 3. SIMULATED COMMUNICATION DISPATCH VIEW (NOTIFY WORKPLATE) */}
          <div className="bg-[#111111] border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                <Laptop className="w-4 h-4 text-indigo-400" />
                Dossiê de Transmissão por IA
              </h3>
              <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.2 rounded font-mono uppercase font-bold">
                Live Preview
              </span>
            </div>

            {activeNotification ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span className="truncate max-w-[200px]">Destinatário: <b className="text-zinc-300 text-[10px]">{activeNotification.recipient}</b></span>
                  <span>{activeNotification.timestamp}</span>
                </div>

                {/* WHATSAPP GREEN CHAT BUBBLE RENDERING */}
                {activeNotification.type === 'whatsapp' && (
                  <div className="bg-[#0b141a] rounded-xl p-3 border border-[#1f2c34] relative space-y-1.5">
                    <div className="flex items-center gap-1 text-[10px] text-[#00a884] font-semibold font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]" />
                      NEXUS-EDU TELECOM (WHATSAPP GATEWAY)
                    </div>
                    
                    {/* Speech bubble */}
                    <div className="bg-[#005c4b] text-white p-3 rounded-lg rounded-tl-none text-xs ml-2 leading-relaxed relative">
                      <p>{activeNotification.body}</p>
                      <span className="text-[9px] text-[#85bca6] text-right block mt-1">
                        Sintetizado por IA • Entregue ✔✔
                      </span>
                    </div>
                  </div>
                )}

                {/* EMAIL TEMPLATE RENDERING */}
                {activeNotification.type === 'email' && (
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-3 font-sans">
                    <div className="flex items-center gap-2 border-b border-zinc-900 pb-2 text-[11px] font-mono">
                      <span className="text-zinc-600 font-bold uppercase shrink-0">ASSUNTO:</span>
                      <span className="text-zinc-305 font-bold truncate">{activeNotification.title}</span>
                    </div>

                    <div className="text-[11px] text-zinc-400 leading-relaxed space-y-2 whitespace-pre-line">
                      {activeNotification.body}
                    </div>

                    {activeNotification.details && (
                      <div className="bg-zinc-900 p-2.5 rounded border border-zinc-850 font-mono text-[9px] space-y-1 mt-2 text-zinc-300">
                        {Object.entries(activeNotification.details).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-zinc-500">{k}:</span>
                            <span className="font-bold">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-[9px] text-zinc-650 font-mono text-center border-t border-zinc-900 pt-2">
                      Serviço Geral de Cobrança Escolar • Conexão Segura
                    </div>
                  </div>
                )}

                {/* GOOGLE WORKSPACE AND SYSTEM ACCOUNTS TERMINAL RENDERING */}
                {activeNotification.type === 'system' && (
                  <div className="bg-zinc-950 rounded-xl border border-zinc-850 p-4 font-mono text-[10px] space-y-2 text-[#4af626]">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
                      <span className="text-zinc-450 uppercase text-[9px] flex items-center gap-1">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                        Consola do Sistema Pedagógico
                      </span>
                      <span className="w-2.5 h-2.5 rounded-full bg-[#4af626] animate-pulse"></span>
                    </div>

                    <p className="font-mono text-[11px] text-white font-bold">Integração de Contas e Google Workspace Ativa</p>
                    <p className="text-zinc-400">Ligação estabelecida com serviços escolares adicionais.</p>
                    <p className="text-zinc-405">Registo inserido com sucesso na base de dados.</p>

                    {activeNotification.details && (
                      <div className="border border-emerald-900/30 bg-emerald-950/10 p-2.5 rounded text-zinc-300 space-y-1 mt-2 font-mono text-[10px]">
                        {Object.entries(activeNotification.details).map(([k, v]) => (
                          <p key={k}>
                            <span className="text-zinc-500">{k}:</span> <strong className="text-[#4af626]">{v}</strong>
                          </p>
                        ))}
                      </div>
                    )}
                    <span className="text-zinc-650 block text-[9px] mt-2 italic">
                      Processo de ativação operado pelo sistema com êxito.
                    </span>
                  </div>
                )}

                <div className="text-center">
                  <button
                    onClick={() => setActiveNotification(null)}
                    className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                  >
                    Ocultar Visualizador
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-xs">
                <Sliders className="w-8 h-8 mx-auto mb-2 opacity-30 text-indigo-400" />
                <span>Nenhuma notificação instanciada. Execute uma simulação para gerar previsões e resultados.</span>
              </div>
            )}
          </div>

          {/* 4. REAL-TIME EVENT CONSOLE LOGS & STREAM */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                Diário de Atividades do Sistema
              </h3>
              <button
                onClick={() => setLogs([])}
                className="text-[9px] font-mono text-zinc-550 hover:text-zinc-300 transition cursor-pointer"
              >
                Limpar Registos
              </button>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs font-mono">
                  Sem atividades registadas recentemente.
                </div>
              ) : (
                logs.map(log => (
                  <div 
                    key={log.id} 
                    className="p-3 bg-zinc-950 rounded-xl border border-zinc-900 hover:border-zinc-850 transition relative group"
                  >
                    <div className="flex items-center justify-between text-[9px] font-mono mb-1.5">
                      <span className="text-zinc-605">[{log.time}] <b className="text-zinc-400">{log.id}</b></span>
                      <span className={`uppercase font-bold ${
                        log.status === 'success' ? 'text-emerald-400' : 'text-indigo-400'
                      }`}>
                        [{log.status.toUpperCase()}]
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-zinc-100 font-display">{log.flowTitle}</h4>
                    <p className="text-[10px] text-zinc-440 font-mono leading-relaxed mt-1">{log.detail}</p>
                    
                    <div className="flex items-center justify-between text-[8px] font-mono text-zinc-600 mt-2 border-t border-zinc-900/60 pt-1.5">
                      <span>Ref Gatilho: <b>{log.trigger}</b></span>
                      <span className="text-emerald-500 font-medium">Poupança: +{log.timeSavedMins}min (processado em {log.elapsedMs}ms)</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-600 font-mono">
              <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Auditoria Geral</span>
              <span>Central de Automações</span>
            </div>
          </div>

        </div>

      </div>

      {/* CREATE WORKFLOW MODAL DRAWER */}
      {isCreatingFlow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans animate-fadeIn">
          <div className="bg-[#111111] border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-bold text-white font-display">Configurar Novo Fluxo Inteligente (n8n API)</h3>
              </div>
              <button 
                onClick={() => setIsCreatingFlow(false)}
                className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomFlow} className="space-y-4 text-xs font-mono">
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 uppercase font-mono block">Nome do Conector / Título</label>
                <input 
                  type="text" 
                  required
                  placeholder="ex: Enviar Aviso de Notas Trimestrais"
                  value={newFlowTitle}
                  onChange={(e) => setNewFlowTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 py-2.5 px-3 rounded-lg outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 uppercase font-mono block">Descrição Descritiva do Objetivo</label>
                <textarea 
                  placeholder="Explique o que esta automação realiza e de que forma ela otimiza a rotina escolar..."
                  value={newFlowDesc}
                  onChange={(e) => setNewFlowDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 py-2.5 px-3 rounded-lg outline-none font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-500 uppercase font-mono block">Canal de Comunicação (Canal)</label>
                  <select 
                    value={newFlowChannel}
                    onChange={(e) => setNewFlowChannel(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 py-2 px-3 rounded-lg outline-none h-10"
                  >
                    <option value="whatsapp">WhatsApp Business</option>
                    <option value="email">E-mail Corporativo (SMTP)</option>
                    <option value="sms">SMS Escolar Integrado</option>
                    <option value="system">Sincronização de Sistema SaaS</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-500 uppercase font-mono block">Gatilho de Tabela (WHEN / TRIGGER)</label>
                  <select 
                    value={newFlowTrigger}
                    onChange={(e) => setNewFlowTrigger(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 py-2 px-3 rounded-lg outline-none h-10"
                  >
                    <option value="Falta injustificada registada">Ausência injustificada registada</option>
                    <option value="Mensalidade emitida">Vencimento de fatura atinge limite</option>
                    <option value="Matrícula submetida">Nova ficha de inscrição validada</option>
                    <option value="Atestado médico anexado">Documentação OCR carregada</option>
                    <option value="Parâmetros de comportamento baixos">Rendimento de nota &lt; 7.0</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 uppercase font-mono block">Ação Executada (DO / ACTION)</label>
                <input 
                  type="text" 
                  required
                  placeholder="ex: Disparar e-mail de mentoria pedagógica e agendamento"
                  value={newFlowAction}
                  onChange={(e) => setNewFlowAction(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 py-2.5 px-3 rounded-lg outline-none font-mono"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setIsCreatingFlow(false)}
                  className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 px-4 py-2.5 rounded-xl font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-500 hover:bg-indigo-450 px-5 py-2.5 rounded-xl font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/10 transition cursor-pointer"
                >
                  Confirmar e Registrar Conector
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
