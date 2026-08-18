import React, { useState, useEffect } from 'react';
import { 
  Zap, CheckCircle2, AlertTriangle, Play, Plus, Trash2, Settings, Activity, 
  FileText, Check, Loader2, Database, Mail, MessageSquare, Clock, ArrowRight, 
  UserPlus, Users, CheckCircle, TrendingUp, Sparkles, ShieldAlert, DollarSign, 
  Search, Building2, UserCheck, RefreshCw, FileUp, Layers, Eye, History, FileDown, ShieldCheck, CreditCard
} from 'lucide-react';
import { Invoice } from '../types';

interface WorkflowsCentralProps {
  invoices: Invoice[];
  onStartCanonicalEnrollment: () => void;
  onUpdateInvoiceStatus: (id: string, status: 'paid' | 'pending' | 'overdue') => void;
  currentUserRole: string;
}

interface CustomRule {
  id: string;
  trigger: string;
  consequences: string[]; // Chainable consequences (ENTÃO blocks)
  active: boolean;
  executions: number;
}

interface WorkflowInstance {
  id: string;
  name: string;
  type: 'matricula' | 'ocr' | 'financeiro' | 'personalizado';
  status: 'running' | 'completed' | 'blocked' | 'error';
  startedBy: string;
  approvedBy?: string;
  timestamp: string;
  date: string;
  durationMs: number;
  history: string[];
  entityName?: string;
}

export default function WorkflowsCentral({ 
  invoices, 
  onStartCanonicalEnrollment,
  onUpdateInvoiceStatus,
  currentUserRole 
}: WorkflowsCentralProps) {
  
  // Theme state parsing directly from classlist or local storage
  const [isDarkMode, setIsDarkMode] = useState(true);
  useEffect(() => {
    const isLightClass = document.body.classList.contains('light');
    setIsDarkMode(!isLightClass);
    
    // Setup observer to detect theme toggle changes dynamically
    const observer = new MutationObserver(() => {
      const isLight = document.body.classList.contains('light');
      setIsDarkMode(!isLight);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Workflow Instances State synced with localStorage
  const [instances, setInstances] = useState<WorkflowInstance[]>(() => {
    const saved = localStorage.getItem('nexus_workflow_instances');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      {
        id: 'WKF-101',
        name: 'Matrícula Completa: Alice Siqueira',
        type: 'matricula',
        status: 'completed',
        startedBy: 'Secretaria (Clara Mendes)',
        approvedBy: 'Dir. Financeiro (Beto Costa)',
        timestamp: '14:22:10',
        date: '2026-06-18',
        durationMs: 4200,
        entityName: 'Alice Siqueira',
        history: [
          'Processo de matrícula iniciado para Alice Siqueira',
          'Registo do estudante criado na Base de Dados Escolar',
          'Dossier pessoal gerado na Secretaria Virtual',
          'Verificação de compliance documental concluído (CC, Vacinas, Fotos)',
          'Plano de propinas estruturado (Desconto 10% Mérito)',
          'Encarregado de Educação Marcos Siqueira registado',
          'Contrato de Prestação de Serviços Digitais emitido electronicamente',
          'Assinatura digital recolhida via Portal Autenticação',
          'Credenciais do Estudante e Encarregado geradas (ALU-101)',
          'Notificação geral enviada à Direção Académica'
        ]
      },
      {
        id: 'WKF-102',
        name: 'Processamento OCR: Comprovativo Propina Junho',
        type: 'ocr',
        status: 'completed',
        startedBy: 'Portal do Aluno (Alice Siqueira)',
        approvedBy: 'Verificação Inteligente Nexus AI',
        timestamp: '15:10:04',
        date: '2026-06-18',
        durationMs: 1840,
        entityName: 'Comprovativo Propina Junho.pdf',
        history: [
          'Ficheiro submetido pelo portal escolar',
          'Sistema de Leitura Eletrónica Inteligente acionado localmente',
          'Leitura de texto extraída com precisão de 99.4%',
          'Classificado como: Comprovativo de Pagamento Bancário',
          'Associado ao Aluno: Alice Siqueira (ALU-101)',
          'Entidade Bancária identificada (CGD) e Valor extraído: 310.00 €',
          'Fatura associada (FT-2026-101) elegida para aprovação',
          'Recibo de liquidação financeira disparado para o e-mail do Encarregado'
        ]
      },
      {
        id: 'WKF-103',
        name: 'Conciliação de Cobrança: ALU-103',
        type: 'financeiro',
        status: 'blocked',
        startedBy: 'Disparador de Contas (Sistema)',
        timestamp: '08:00:00',
        date: '2026-06-19',
        durationMs: 0,
        entityName: 'Bruno Medeiros',
        history: [
          'Início da varredura recorrente de propinas vencidas',
          'Fatura FT-2026-103 registada com 14 dias de atraso',
          'Acesso documental do encarregado de educação verificado',
          'Bloqueado: Comunicação por SMS falhou (Contacto +351 912 345 678 indisponível ou fora de rede)',
          'Processo suspenso aguardando rectificação de contacto na secretaria'
        ]
      }
    ];
  });

  // Custom Rules State synced with localStorage with chainable consequences
  const [customRules, setCustomRules] = useState<CustomRule[]>(() => {
    const saved = localStorage.getItem('nexus_custom_workflow_rules');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      {
        id: 'RULE-101',
        trigger: 'Documento obrigatório expirar em < 15 dias',
        consequences: [
          'Criar tarefa de secretaria no dossier do aluno',
          'Enviar notificação automática e aviso WhatsApp'
        ],
        active: true,
        executions: 6
      },
      {
        id: 'RULE-102',
        trigger: 'Ausência injustificada registada (3 faltas)',
        consequences: [
          'Suspender permissões de portal temporariamente',
          'Criar tarefa urgente de secretaria para contacto telefónico',
          'Notificar Direção executiva e registar log auditoria'
        ],
        active: true,
        executions: 12
      },
      {
        id: 'RULE-103',
        trigger: 'Pagamento de propina atrasar 15 dias',
        consequences: [
          'Emitir cobrança com acréscimo de 2.5% juros',
          'Enviar lembrete eletrónico automático por e-mail'
        ],
        active: false,
        executions: 0
      }
    ];
  });

  // Navigation tabs for the workflow panel
  const [activeSubView, setActiveSubView] = useState<'dashboard' | 'matricula' | 'ocr' | 'financeiro' | 'builder'>('dashboard');

  // Persistence hooks
  useEffect(() => {
    localStorage.setItem('nexus_workflow_instances', JSON.stringify(instances));
  }, [instances]);

  useEffect(() => {
    localStorage.setItem('nexus_custom_workflow_rules', JSON.stringify(customRules));
  }, [customRules]);

  // WORKFLOW INTERATIVO DE MATRÍCULA STATES & CONTROLLERS
  const [newStudName, setNewStudName] = useState('');
  const [newStudGuardian, setNewStudGuardian] = useState('');
  const [newStudGuardianContact, setNewStudGuardianContact] = useState('+351 928 345 112');
  const [newStudClass, setNewStudClass] = useState('7º Ano A');
  const [matriculaRunning, setMatriculaRunning] = useState(false);
  const [matriculaStep, setMatriculaStep] = useState(0);
  const [matriculaLogs, setMatriculaLogs] = useState<string[]>([]);
  const [completedStudent, setCompletedStudent] = useState<any>(null);

  // States for OCR and uploads
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrStep, setOcrStep] = useState(0);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [ocrExtractedData, setOcrExtractedData] = useState<any>(null);
  const [ocrLogs, setOcrLogs] = useState<string[]>([]);
  const [ocrDocsList, setOcrDocsList] = useState<Array<{ name: string; type: string; student: string; quality: string; date: string }>>([
    { name: 'CC_AliceSiqueira.pdf', type: 'Cartão de Cidadão', student: 'Alice Siqueira', quality: '99.5%', date: '21/06/2026' },
    { name: 'Vacinas_BrunoMedeiros.jpg', type: 'Boletim de Vacinas', student: 'Bruno Medeiros', quality: '92.1%', date: '19/06/2026' },
  ]);

  // States for Financial Reconciliation Workflow
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<string>('');
  const [paymentReconciling, setPaymentReconciling] = useState(false);
  const [paymentStep, setPaymentStep] = useState(0);
  const [paymentLogs, setPaymentLogs] = useState<string[]>([]);
  const [paymentReceipt, setPaymentReceipt] = useState<any>(null);

  // Custom workflow builder states
  const [builderTrigger, setBuilderTrigger] = useState('Documento obrigatório expirar em < 15 dias');
  const [builderConsequences, setBuilderConsequences] = useState<string[]>([
    'Criar tarefa de secretaria no dossier do aluno',
    'Enviar notificação automática e aviso WhatsApp'
  ]);
  const [builtRulesCount, setBuiltRulesCount] = useState(0);

  // Custom rule real-time simulated testing states
  const [simulatingRuleId, setSimulatingRuleId] = useState<string | null>(null);
  const [simRuleStep, setSimRuleStep] = useState<number>(-1);
  const [simRuleLogs, setSimRuleLogs] = useState<string[]>([]);

  // Stats calculation
  const totalWorkflows = instances.length;
  const completedWorkflows = instances.filter(i => i.status === 'completed').length;
  const runningWorkflows = instances.filter(i => i.status === 'running').length;
  const blockedWorkflows = instances.filter(i => i.status === 'blocked').length;
  const errorWorkflows = instances.filter(i => i.status === 'error').length;
  
  // Dynamic calculation for average execution time
  const avgExecutionTime = (() => {
    const executed = instances.filter(i => i.durationMs > 0);
    if (executed.length === 0) return '2.1s';
    const sum = executed.reduce((acc, current) => acc + current.durationMs, 0);
    return `${(sum / executed.length / 1000).toFixed(1)}s`;
  })();

  // 10 STEP DEFINITIONS FOR MATRICULA WORKFLOW
  const MATRICULA_STEPS = [
    { num: 1, label: 'Criar Aluno', desc: 'Registo e ficha central' },
    { num: 2, label: 'Criar Responsável', desc: 'Vinculo de encarregado' },
    { num: 3, label: 'Criar Pasta Documental', desc: 'Diretório digital seguro' },
    { num: 4, label: 'Verificar Documentos', desc: 'Validação de uploads' },
    { num: 5, label: 'Gerar Contrato', desc: 'Minuta oficial letiva' },
    { num: 6, label: 'Solicitar Assinatura', desc: 'Envio por SMS/Email' },
    { num: 7, label: 'Criar Plano Financ.', desc: 'Isenções e propinas' },
    { num: 8, label: 'Gerar Mensalidades', desc: 'Lote de 10 faturas' },
    { num: 9, label: 'Criar Acessos', desc: 'Contas digitais cifradas' },
    { num: 10, label: 'Notificar Secretaria', desc: 'Alerta de homologação' }
  ];

  // 5 STEP DEFINITIONS FOR PAYMENT WORKFLOW
  const PAYMENT_STEPS = [
    { num: 1, label: 'Atualizar Saldo', desc: 'Conciliação e saldo da escola' },
    { num: 2, label: 'Atualizar Financeiro', desc: 'Faturação e ficha do aluno' },
    { num: 3, label: 'Emitir Recibo', desc: 'Geração do recibo legal PDF' },
    { num: 4, label: 'Atualizar Dashboards', desc: 'Estatísticas financeiras r8n' },
    { num: 5, label: 'Registar Auditoria', desc: 'Log imutável guardado' }
  ];

  // 6 STEP DEFINITIONS FOR DOCUMENTS (OCR) WORKFLOW
  const DOCUMENT_STEPS = [
    { num: 1, label: 'Executar OCR', desc: 'Extração bruta do texto' },
    { num: 2, label: 'Classificar', desc: 'Identificar tipo documental' },
    { num: 3, label: 'Associar Entidade', desc: 'Vinculação ao aluno/ficha' },
    { num: 4, label: 'Criar Tarefas', desc: 'Agendamento de revisão' },
    { num: 5, label: 'Criar Alertas', desc: 'Prevenir expiração legal' },
    { num: 6, label: 'Atualizar Módulos', desc: 'Gravação na pasta escolar' }
  ];

  // SIMULAÇÃO MATRÍCULA WORKFLOW (10 PASSOS)
  const triggerMatriculaWorkflow = () => {
    onStartCanonicalEnrollment();
  };

  // SIMULAÇÃO WORKFLOW FINANCEIRO (5 PASSOS)
  const triggerPaymentReconciliation = async () => {
    if (!selectedInvoiceForPayment) {
      alert('Por favor, selecione uma fatura pendente ou em dívida para processar.');
      return;
    }

    const selectedInv = invoices.find(i => i.id === selectedInvoiceForPayment);
    if (!selectedInv) return;

    setPaymentReconciling(true);
    setPaymentStep(0);
    setPaymentReceipt(null);
    setPaymentLogs([`[INÍCIO] Lançamento de Conciliação Financeira para Fatura ${selectedInv.id} (€${selectedInv.amount})`]);

    const stepsLogs = [
      `[PASSO 1/5 - Atualizar Saldo]: Sincronizado crédito bancário bancarizado de €${selectedInv.amount} e adicionado ao fluxo de caixa letivo corrente da escola.`,
      `[PASSO 2/5 - Atualizar Financeiro]: Conta pessoal de [${selectedInv.studentName}] localizada e saldo Outstanding Fee diminuído em proporcional de €${selectedInv.amount}. Dívida deduzida.`,
      `[PASSO 3/5 - Emitir Recibo]: Recibo fiscal digital devidamente assinado e carimbado via Nexus Wallet Certifier. ID gerado: REC-${Math.floor(4000 + Math.random() * 5900)}`,
      `[PASSO 4/5 - Atualizar Dashboards]: Sinais de sincronia em lote expedidos para renovação instantânea do painel financeiro, fluxo de caixa e balanço global.`,
      `[PASSO 5/5 - Registar Auditoria]: Código único e assinatura digital de conformidade guardados permanentemente no livro de registo escolar para o perfil de ${currentUserRole}.`
    ];

    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 600));
      setPaymentStep(i + 1);
      setPaymentLogs(prev => [...prev, stepsLogs[i]]);
    }

    // Call Parent State Mutator to set invoice as paid!
    onUpdateInvoiceStatus(selectedInv.id, 'paid');

    const generatedReceiptId = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
    setPaymentReceipt({
      receiptId: generatedReceiptId,
      studentName: selectedInv.studentName,
      invoiceId: selectedInv.id,
      amount: selectedInv.amount,
      date: new Date().toLocaleDateString('pt-PT'),
      time: new Date().toLocaleTimeString('pt-PT')
    });

    // Create new workflow instance record to append to lists
    const newInstance: WorkflowInstance = {
      id: `WKF-${Math.floor(105 + Math.random() * 800)}`,
      name: `Liquidação Faturação: Recibo ${generatedReceiptId}`,
      type: 'financeiro',
      status: 'completed',
      startedBy: 'API Integradora Bancária (Realtime)',
      approvedBy: `Operador Financeiro (${currentUserRole})`,
      timestamp: new Date().toLocaleTimeString('pt-PT'),
      date: new Date().toISOString().split('T')[0],
      durationMs: 3000,
      entityName: selectedInv.studentName,
      history: [...stepsLogs, `Recibo ${generatedReceiptId} certificado e guardado no Dossier Escolar`]
    };

    setInstances(prev => [newInstance, ...prev]);
    setPaymentReconciling(false);
  };

  // SIMULAÇÃO WORKFLOW DOCUMENTAL OCR (6 PASSOS)
  const runOcrSimulation = async (fileName: string) => {
    if (!fileName) return;
    setOcrRunning(true);
    setOcrStep(0);
    setOcrExtractedData(null);
    setOcrLogs([`[INÍCIO] Entrada de ficheiro detetada no servidor OCR da secretaria: ${fileName}`]);

    const stepLogs = [
      `[PASSO 1/6 - Executar OCR]: Matriz do arquivo binário analisada com 300 DPI. Aplicação de binarização gráfica e leitura do texto concluída.`,
      `[PASSO 2/6 - Classificar]: O sistema inteligente lê o cabeçalho de metadados e classifica o tipo do documento como [Dossier Oficial da Secretaria].`,
      `[PASSO 3/6 - Associar Entidade]: Pesquisa na base escolar realizada. Metadados do documento vinculados ao Perfil Escolar de Aluno correspondente.`,
      `[PASSO 4/6 - Criar Tarefas]: Tarefa secundária agendada na mesa de avaliação física da secretaria para homologação presencial rápida.`,
      `[PASSO 5/6 - Criar Alertas]: Alerta crítico preventivo de verificação registado. Notificação interna agendada 30 dias antes da expiração de validade relevante.`,
      `[PASSO 6/6 - Atualizar Módulos]: Sincronia concluída com sucesso! Digitalização anexada e registada na gaveta digital segura do estudante.`
    ];

    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 600));
      setOcrStep(i + 1);
      setOcrLogs(prev => [...prev, stepLogs[i]]);
    }

    const ocrData = {
      accuracy: '99.1%',
      textExtracted: `SUBMETIDO VIA PORTAL DE SECRETARIA \nNome: Ricardo Jorge Barbosa \nNascimento: 12 Abr 2012 • Documento Oficioso \nNIF Fiscal: 288744112 \nDigitalizado e validado pela Central Nexus AI`,
      studentAssoc: 'Ricardo Jorge Barbosa',
      docType: fileName.includes('CC') ? 'Cartão de Cidadão' : fileName.includes('Ativo') ? 'Atestado Médico' : fileName.includes('Contrato') ? 'Contrato de Frequência' : 'Comprovativo de Liquidação',
      nif: '288744112',
      validity: '31/12/2031'
    };

    setOcrExtractedData(ocrData);

    // Add to OCR documents list
    setOcrDocsList(prev => [
      { name: fileName, type: ocrData.docType, student: 'Ricardo Jorge Barbosa', quality: ocrData.accuracy, date: new Date().toLocaleDateString('pt-PT') },
      ...prev
    ]);

    // Create new workflow instance record to append to lists
    const newInstance: WorkflowInstance = {
      id: `WKF-${Math.floor(105 + Math.random() * 800)}`,
      name: `Processamento Inteligente: ${fileName}`,
      type: 'ocr',
      status: 'completed',
      startedBy: 'Secretaria Virtual (Upload)',
      timestamp: new Date().toLocaleTimeString('pt-PT'),
      date: new Date().toISOString().split('T')[0],
      durationMs: 3600,
      entityName: fileName,
      history: [...stepLogs, 'Ficheiro classificado, associado e catalogado eletronicamente no dossier.']
    };

    setInstances(prev => [newInstance, ...prev]);
    setOcrRunning(false);
  };

  // ADD DYNAMIC CUSTOM WORKFLOW RULE WITH MULTIPLE CONSEQUENCES
  const handleAddNewConsequence = () => {
    setBuilderConsequences([...builderConsequences, '']);
  };

  const handleRemoveConsequence = (index: number) => {
    if (builderConsequences.length <= 1) return;
    const updated = [...builderConsequences];
    updated.splice(index, 1);
    setBuilderConsequences(updated);
  };

  const handleConsequenceChange = (index: number, value: string) => {
    const updated = [...builderConsequences];
    updated[index] = value;
    setBuilderConsequences(updated);
  };

  const handleCreateCustomRule = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate consequences
    const filteredCons = builderConsequences.filter(c => c.trim() !== '');
    if (filteredCons.length === 0) {
      alert('Por favor, adicione pelo menos uma consequência (ENTÃO) para a regra de automação.');
      return;
    }

    const newRule: CustomRule = {
      id: `RULE-${104 + customRules.length}`,
      trigger: builderTrigger,
      consequences: filteredCons,
      active: true,
      executions: 0
    };

    setCustomRules(prev => [newRule, ...prev]);
    setBuiltRulesCount(prev => prev + 1);
    
    // Add audit log for rule creation
    const newInstance: WorkflowInstance = {
      id: `WKF-${Math.floor(200 + Math.random() * 800)}`,
      name: `Nova regra criada: "SE ${newRule.trigger.substring(0,25)}..."`,
      type: 'personalizado',
      status: 'completed',
      startedBy: `Administrador (${currentUserRole})`,
      timestamp: new Date().toLocaleTimeString('pt-PT'),
      date: new Date().toISOString().split('T')[0],
      durationMs: 450,
      history: [
        `Criador visual de regras instanciado`,
        `Gatilho SE definido como: "${newRule.trigger}"`,
        ...filteredCons.map((c, i) => `Consequência ENTÃO [${i+1}] configurada: "${c}"`),
        `Configuração lógica realizada com sucesso e integrada no sistema de processos automáticos.`
      ]
    };
    setInstances(prev => [newInstance, ...prev]);
    
    // Reset consequences back to defaults
    setBuilderConsequences(['']);
  };

  const deleteCustomRule = (id: string) => {
    setCustomRules(prev => prev.filter(r => r.id !== id));
  };

  const toggleCustomRule = (id: string) => {
    setCustomRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  // REAL-TIME SIMULATED TESTING OF THE CUSTOM NO-CODE RULES
  const simulateRuleExecution = async (rule: CustomRule) => {
    setSimulatingRuleId(rule.id);
    setSimRuleStep(0);
    setSimRuleLogs([`[INÍCIO] Monitorizador de Regras acionado para Regra ${rule.id}`]);

    // Initial check log
    await new Promise(resolve => setTimeout(resolve, 500));
    setSimRuleLogs(prev => [...prev, `[EVALUAR] Auditoria periódica Nexus identificou condição satisfatória para Gatilho SE: "${rule.trigger}"`]);
    
    // Run though each consequence step-by-step in real-time
    for (let c = 0; c < rule.consequences.length; c++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setSimRuleStep(c + 1);
      setSimRuleLogs(prev => [...prev, `[EXECUÇÃO PASSO ${c+1}/${rule.consequences.length}] Disparando Ação ENTÃO: "${rule.consequences[c]}"`]);
    }

    await new Promise(resolve => setTimeout(resolve, 600));
    setSimRuleLogs(prev => [...prev, `[SUCESSO] Cadeia lógica concluída com êxito. Estado reposto.`]);
    
    // Update count in state
    setCustomRules(prev => prev.map(r => r.id === rule.id ? { ...r, executions: r.executions + 1 } : r));
    
    const newInstance: WorkflowInstance = {
      id: `WKF-${Math.floor(200 + Math.random() * 800)}`,
      name: `Disparo Automático: ${rule.trigger}`,
      type: 'personalizado',
      status: 'completed',
      startedBy: 'Sistema Automático',
      timestamp: new Date().toLocaleTimeString('pt-PT'),
      date: new Date().toISOString().split('T')[0],
      durationMs: Math.floor(1000 + rule.consequences.length * 800),
      entityName: 'Nexus Rule System',
      history: [
        `Verificação periódica de tarefas ativada`,
        `Identificada condição satisfatória para Regra [${rule.id}]`,
        `Expressão SE validada: "${rule.trigger}"`,
        ...rule.consequences.map((c, idx) => `Canal de ação [${idx+1}] acionado: "${c}"`),
        `Processamento assíncrono concluído em segundo plano`
      ]
    };
    
    setInstances(prev => [newInstance, ...prev]);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-zinc-850">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.0 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/15">
              <Zap className="w-5 h-5 animate-pulse" />
            </span>
            <h1 className="text-xl font-bold text-zinc-100 uppercase tracking-tight font-sans">
              Central de Processos
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Orquestrador inteligente de processos e conexões escolares. O Nexus Edu opera por cadeias automáticas de eventos acionadas e monitorizadas eletronicamente em tempo real.
          </p>
        </div>
        
        {/* Sub-view switcher tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl" id="workflow_nav_tabs">
          <button
            onClick={() => setActiveSubView('dashboard')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubView === 'dashboard'
                ? 'bg-indigo-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            Visualizar Painel
          </button>
          <button
            onClick={() => setActiveSubView('matricula')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubView === 'matricula'
                ? 'bg-indigo-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            Matrícula Automatizada
          </button>
          <button
            onClick={() => {
              setActiveSubView('ocr');
              setOcrStep(0);
              setOcrLogs([]);
              setOcrExtractedData(null);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubView === 'ocr'
                ? 'bg-indigo-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            OCR Documental
          </button>
          <button
            onClick={() => {
              setActiveSubView('financeiro');
              setPaymentStep(0);
              setPaymentLogs([]);
              setPaymentReceipt(null);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubView === 'financeiro'
                ? 'bg-indigo-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            Processo Financeiro
          </button>
          <button
            onClick={() => setActiveSubView('builder')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubView === 'builder'
                ? 'bg-indigo-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            Visual Construtor
          </button>
        </div>
      </div>

      {/* DASHBOARD SUMMARY KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" id="workflow_metrics_grid">
        
        {/* Stats 1: Active workflows */}
        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl flex flex-col justify-between hover:border-indigo-500/30 transition-all group">
          <span className="text-[10px] uppercase font-mono tracking-wider text-sky-400 font-bold block text-left">Processos Ativos</span>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-2xl font-bold font-sans text-zinc-100 group-hover:text-sky-300 transition-colors">{runningWorkflows + (simulatingRuleId ? 1 : 0)}</h3>
            <span className="w-2 h-2 rounded-full bg-sky-450 animate-ping shrink-0" />
          </div>
        </div>

        {/* Stats 2: Completed */}
        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl flex flex-col justify-between hover:border-emerald-500/30 transition-all group">
          <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 font-bold block text-left">Concluídos</span>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-2xl font-bold font-sans text-emerald-400 group-hover:text-emerald-300 transition-colors">{completedWorkflows}</h3>
            <span className="text-[8px] bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-400 font-mono font-bold">100% OK</span>
          </div>
        </div>

        {/* Stats 3: Pending */}
        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl flex flex-col justify-between hover:border-amber-500/30 transition-all group">
          <span className="text-[10px] uppercase font-mono tracking-wider text-amber-500 font-bold block text-left">Pendentes</span>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-2xl font-bold font-sans text-amber-400 group-hover:text-amber-300 transition-colors">1</h3>
            <span className="text-[8px] bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-400 font-mono font-bold">Aguardar</span>
          </div>
        </div>

        {/* Stats 4: Blocked processes */}
        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl flex flex-col justify-between hover:border-orange-500/30 transition-all group">
          <span className="text-[10px] uppercase font-mono tracking-wider text-orange-400 font-bold block text-left">Suspensos</span>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-2xl font-bold font-sans text-orange-400 group-hover:text-orange-300 transition-colors">{blockedWorkflows}</h3>
            <span className="text-[8.5px] text-zinc-500 font-mono">Dados incompletos</span>
          </div>
        </div>

        {/* Stats 5: Error logs */}
        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl flex flex-col justify-between hover:border-rose-500/30 transition-all group">
          <span className="text-[10px] uppercase font-mono tracking-wider text-rose-500 font-bold block text-left">Incidentes</span>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-2xl font-bold font-sans text-rose-400 group-hover:text-rose-300 transition-colors">{errorWorkflows}</h3>
            <span className="text-[8px] bg-rose-500/10 px-1.5 py-0.5 rounded text-rose-400 font-mono font-bold">Zero crítico</span>
          </div>
        </div>

        {/* Stats 6: Average speed */}
        <div className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl flex flex-col justify-between hover:border-indigo-500/30 transition-all group">
          <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-400 font-bold block text-left">Tempo Médio</span>
          <div className="flex items-baseline justify-between mt-2">
            <h3 className="text-2xl font-bold font-sans text-indigo-400 group-hover:text-indigo-300 transition-colors">{avgExecutionTime}</h3>
            <span className="text-[8.5px] text-zinc-500 font-mono">Processamento</span>
          </div>
        </div>
      </div>

      {/* VIEW: MAIN WORKFLOW DASHBOARD */}
      {activeSubView === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn" id="workflows_main_dashboard">
          
          {/* Column 1 & 2: Main Active Workflows Trace Log & Monitoring */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-bold text-zinc-200">Monitorização em Tempo Real de Processos</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-zinc-950 border border-zinc-850 text-indigo-400 px-2 py-1 rounded-md flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Sincronizado
                  </span>
                </div>
              </div>

              {/* Instances Tracker Loop */}
              <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1">
                {instances.map((inst) => (
                  <div key={inst.id} className="p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl hover:border-zinc-750 transition-all space-y-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
                      <div className="text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold font-mono tracking-wide text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                            {inst.id}
                          </span>
                          <span className="text-[11.5px] font-bold text-zinc-100 font-sans">
                            {inst.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono mt-1.5">
                          <span>Operador: <strong className="text-zinc-400">{inst.startedBy}</strong></span>
                          <span>•</span>
                          <span>Início: <strong className="text-zinc-400">{inst.timestamp} ({inst.date})</strong></span>
                          {inst.durationMs > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-sky-400">Tempo: <strong>{(inst.durationMs / 1000).toFixed(1)}s</strong></span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div>
                        {inst.status === 'completed' && (
                          <span className="text-[9px] uppercase font-mono font-bold bg-emerald-550/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.8 rounded">
                            CONCLUÍDO
                          </span>
                        )}
                        {inst.status === 'running' && (
                          <span className="text-[9px] uppercase font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-400/25 px-2 py-0.8 rounded flex items-center gap-1 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin text-sky-400" /> EM CURSO
                          </span>
                        )}
                        {inst.status === 'blocked' && (
                          <span className="text-[9px] uppercase font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.8 rounded flex items-center gap-1">
                            BLOQUEADO
                          </span>
                        )}
                        {inst.status === 'error' && (
                          <span className="text-[9px] uppercase font-mono font-bold bg-rose-500/10 text-rose-450 border border-rose-500/25 px-2 py-0.8 rounded">
                            ✘ FALHA
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Step log summaries */}
                    <div className="bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-850/60 space-y-1 text-left">
                      <span className="text-[8.5px] font-mono uppercase text-zinc-500 block mb-1 font-bold">Rastreabilidade & Eventos</span>
                      <div className="text-[10px] font-mono leading-relaxed space-y-1">
                        {inst.history.slice(-3).map((histMsg, idx) => (
                          <div key={idx} className="flex gap-1.5 text-zinc-450">
                            <span className="text-zinc-600 font-bold">→</span>
                            <span className="truncate">{histMsg}</span>
                          </div>
                        ))}
                        {inst.history.length > 3 && (
                          <span className="text-[9px] text-indigo-400 font-bold block pt-1 hover:underline cursor-pointer">
                            + Ver todos os {inst.history.length} passos do log auditoria
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta audit and approval signature */}
                    <div className="flex items-center justify-between text-[9.5px] font-mono text-zinc-500 pt-0.5">
                      <div className="flex items-center gap-1 text-emerald-500">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Aprovado por: {inst.approvedBy || 'Sistema Autónomo'}</span>
                      </div>
                      <span className="text-zinc-650">Identificação: PR-{inst.id.toLowerCase()}</span>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 3: Active Rules and Direct Actions Trigger */}
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-zinc-200">Gatilhos Escolares Registados</h2>
                </div>
                <button 
                  onClick={() => setActiveSubView('builder')}
                  className="p-1 px-2 border border-zinc-800 bg-zinc-950 text-[10px] text-zinc-450 hover:text-white rounded hover:border-zinc-700 transition-all font-mono font-bold cursor-pointer"
                >
                  + Novo SE/AÇÃO
                </button>
              </div>

              {/* Automation Rules */}
              <div className="space-y-3">
                {customRules.map((rule) => {
                  return (
                    <div key={rule.id} className="p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl hover:border-zinc-750 transition-all space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] uppercase font-mono font-bold text-indigo-400 tracking-wider">
                          {rule.id}
                        </span>
                        
                        {/* Interactive toggle switch */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleCustomRule(rule.id)}
                            className={`p-0.5 rounded transition-all cursor-pointer ${
                              rule.active ? 'text-indigo-400' : 'text-zinc-500'
                            }`}
                          >
                            <span className="text-xs font-mono font-bold mr-1 text-[9px]">
                              {rule.active ? 'ATIVO' : 'MUTADO'}
                            </span>
                          </button>
                          <input 
                            type="checkbox" 
                            checked={rule.active} 
                            onChange={() => toggleCustomRule(rule.id)}
                            className="w-3.5 h-3.5 rounded bg-zinc-900 accent-indigo-500 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Decoupled Rule Display */}
                      <div className="space-y-1.5 text-left font-mono">
                        <div className="text-[11.5px] font-bold text-zinc-200">
                          <span className="text-zinc-500">SE:</span> {rule.trigger}
                        </div>
                        {rule.consequences.map((cons, idx) => (
                          <div key={idx} className="text-[11px] text-zinc-400 pl-2.5 border-l-2 border-indigo-500/30">
                            <span className="text-zinc-650 text-[10px]">ENTÃO ({idx + 1}):</span> {cons}
                          </div>
                        ))}
                      </div>

                      {/* Executions log & quick test */}
                      <div className="flex items-center justify-between border-t border-zinc-900 pt-2 text-[10px] font-mono">
                        <span className="text-zinc-500">Compilado: <strong className="text-zinc-400">{rule.executions} disparos</strong></span>
                        <button
                          onClick={() => simulateRuleExecution(rule)}
                          disabled={!rule.active || simulatingRuleId !== null}
                          className={`flex items-center gap-1 text-[9.5px] font-mono px-2 py-0.5 rounded border transition-all ${
                            rule.active && simulatingRuleId === null
                              ? 'bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border-zinc-850 hover:border-emerald-500/20 cursor-pointer font-bold'
                              : 'bg-zinc-900/50 text-zinc-600 border-zinc-850 cursor-not-allowed'
                          }`}
                        >
                          <Play className="w-2.5 h-2.5" /> Simular Processo
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Visual Quick Actions overview */}
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 space-y-3.5 text-left">
              <h2 className="text-xs font-bold text-zinc-200 font-mono uppercase tracking-wider">Canais de Lançamento Ativos</h2>
              <p className="text-[11px] text-zinc-450 leading-relaxed">
                As ações automáticas dos processos escolares utilizam as comportas e canais de comunicação integrados:
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono">
                <div className="p-2 bg-zinc-950 border border-zinc-850 rounded-lg flex items-center gap-1.5 justify-start">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Notificação WhatsApp</span>
                </div>
                <div className="p-2 bg-zinc-950 border border-zinc-850 rounded-lg flex items-center gap-1.5 justify-start">
                  <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">Correio Eletrónico</span>
                </div>
                <div className="p-2 bg-zinc-950 border border-zinc-850 rounded-lg flex items-center gap-1.5 justify-start">
                  <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">Base de Dados Central</span>
                </div>
                <div className="p-2 bg-zinc-950 border border-zinc-850 rounded-lg flex items-center gap-1.5 justify-start">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Certificado & Assinatura</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* VIEW: WORKFLOW DE MATRÍCULA AUTOMATIZADA */}
      {activeSubView === 'matricula' && (
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6 space-y-6 animate-fadeIn" id="workflows_matricula_portal">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-4 text-left font-sans">
            <div>
              <h2 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400 animate-pulse" />
                Entrada de Matrícula
              </h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                Inicie a matrícula no fluxo oficial. A criação de aluno, documentos, validação e ativação são confirmadas pelo backend nesse processo.
              </p>
            </div>
            {matriculaRunning && (
              <span className="text-xs font-mono bg-indigo-500/15 border border-indigo-500/25 px-3 py-1 rounded-lg text-indigo-400 flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" /> PASSOS EM EXECUÇÃO...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Form Input block */}
            <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 space-y-4 h-fit">
              <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 tracking-wider block border-b border-zinc-900 pb-1.5 text-left">
                Dados do Novo Aluno
              </span>

              <div className="space-y-3 font-sans text-xs text-left">
                {/* School documents required alert */}
                <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 font-mono text-[9.5px] leading-relaxed">
                  <strong>Aviso legal:</strong> A ativação definitiva requer a posterior validação em OCR dos documentos carregados pelo encarregado de educação.
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400 font-bold block">Nome Completo do Estudante</label>
                  <input
                    type="text"
                    value={newStudName}
                    onChange={(e) => setNewStudName(e.target.value)}
                    placeholder="Ex: Daniel Ramos Silva"
                    disabled={matriculaRunning}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400 font-bold block">Nome do Encarregado de Educação</label>
                  <input
                    type="text"
                    value={newStudGuardian}
                    onChange={(e) => setNewStudGuardian(e.target.value)}
                    placeholder="Ex: Sofia Ramos"
                    disabled={matriculaRunning}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400 font-bold block">Contacto do Encarregado</label>
                  <input
                    type="text"
                    value={newStudGuardianContact}
                    onChange={(e) => setNewStudGuardianContact(e.target.value)}
                    placeholder="Ex: +351 928 345 112"
                    disabled={matriculaRunning}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400 font-bold block">Ano Curricular Letivo</label>
                  <select
                    value={newStudClass}
                    onChange={(e) => setNewStudClass(e.target.value)}
                    disabled={matriculaRunning}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                  >
                    <option value="5º Ano A">5º Ano A</option>
                    <option value="7º Ano A">7º Ano A</option>
                    <option value="8º Ano A">8º Ano A</option>
                    <option value="9º Ano B">9º Ano B</option>
                    <option value="10º Ano A">10º Ano A</option>
                  </select>
                </div>

                <button
                  onClick={triggerMatriculaWorkflow}
                  disabled={matriculaRunning}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold font-sans tracking-wide transition-all border ${
                    matriculaRunning
                      ? 'bg-zinc-800 text-zinc-500 border-zinc-850 cursor-not-allowed'
                      : 'bg-indigo-500 hover:bg-indigo-650 text-white border-indigo-400 cursor-pointer shadow-lg hover:shadow-indigo-500/10'
                  }`}
                >
                  {matriculaRunning ? 'A abrir matrícula...' : 'Abrir matrícula'}
                </button>
              </div>
            </div>

            {/* Visual Timeline and Pipeline representation */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 space-y-4 select-none">
                <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 tracking-wider block border-b border-zinc-900 pb-1.5 text-left">
                  Diagrama de Execução em Tempo Real [10 Passos de Matrícula]
                </span>

                {/* 10 Step sequential visual components */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 text-left">
                  {MATRICULA_STEPS.map((step) => {
                    const isPassed = matriculaStep >= step.num;
                    const isCurrent = matriculaStep === step.num && matriculaRunning;

                    return (
                      <div 
                        key={step.num}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                          isPassed 
                            ? 'bg-emerald-500/5 border-emerald-500/25 text-emerald-400'
                            : isCurrent
                            ? 'bg-indigo-500/5 border-indigo-400 text-indigo-400 ring-1 ring-indigo-400 animate-pulse'
                            : 'bg-zinc-900/40 border-zinc-850 text-zinc-650'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded ${
                            isPassed ? 'bg-emerald-500/10' : isCurrent ? 'bg-indigo-500/10' : 'bg-zinc-800'
                          }`}>
                            {step.num}
                          </span>
                          {isPassed && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          {isCurrent && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />}
                        </div>
                        <div className="mt-3">
                          <h4 className="text-[10px] font-bold font-sans truncate">{step.label}</h4>
                          <p className="text-[8.5px] font-mono font-medium text-zinc-500 truncate mt-0.5">{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Simulated Logs console output */}
                <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-850 mt-4 text-left">
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-2 mb-2">
                    <span className="text-[9px] font-bold tracking-wider font-mono uppercase text-zinc-450 flex items-center gap-1">
                      <span>⌨</span> HISTÓRICO DE PROCESSAMENTO DO PROCESSO
                    </span>
                    <span className="text-[8.5px] font-mono text-zinc-600">ID: PR-MT-{newStudClass.replace(/\s+/g, '')}</span>
                  </div>
                  <div className="h-40 overflow-y-auto font-mono text-[10px] text-zinc-400 leading-relaxed pr-1 space-y-1.5 select-text">
                    {matriculaLogs.map((logLine, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="text-zinc-600">[{index+1}]</span>
                        <span className={
                          logLine.includes('[PASSO') ? 'text-indigo-400 font-semibold' : 
                          logLine.includes('[INÍCIO]') ? 'text-sky-450' : 'text-emerald-400'
                        }>{logLine}</span>
                      </div>
                    ))}
                    {matriculaLogs.length === 0 && (
                      <p className="text-zinc-650 italic text-[9.5px]">Aguardar início do processo para visualizar o histórico de auditoria...</p>
                    )}
                  </div>
                </div>

                {/* Successful Result Card */}
                {completedStudent && (
                  <div className="p-3.5 bg-emerald-550/5 border border-emerald-500/20 rounded-xl space-y-2 animate-fadeIn mt-4 text-left">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold font-mono text-emerald-450 uppercase">
                      <CheckCircle className="w-4 h-4 text-emerald-450" />
                      <span>Matrícula Registada & Homologada com Sucesso</span>
                    </div>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      O aluno <strong>{completedStudent.name}</strong> foi adicionado ao registo académico escolar das turmas do <strong>{completedStudent.class}</strong>. As 10 parcelas automáticas de mensalidades de €310 já estão anexadas ao seu dossier financeiro.
                    </p>
                    <div className="flex gap-4 text-[10px] font-mono pt-1 text-zinc-500 border-t border-zinc-900/60 mt-2">
                      <span>ID DO ALUNO: <strong className="text-zinc-300">{completedStudent.id}</strong></span>
                      <span>RESPONSÁVEL: <strong className="text-zinc-300">{completedStudent.guardiansName}</strong></span>
                      <span>MENSALIDADE: <strong className="text-emerald-400">€310.00 / mês</strong></span>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      )}

      {/* VIEW: WORKFLOW DOCUMENTAL (OCR) */}
      {activeSubView === 'ocr' && (
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6 space-y-6 animate-fadeIn" id="workflows_ocr_documental">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-4 text-left">
            <div>
              <h2 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Processo Documental & Reconhecimento Ótico (OCR)
              </h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                Alimente o leitor inteligente de secretaria. O sistema executará 6 passos para escanear, classificar, verificar vencimentos e vincular os documentos ao aluno correto de forma autónoma.
              </p>
            </div>
            {ocrRunning && (
              <span className="text-xs font-mono bg-indigo-500/15 border border-indigo-500/25 px-3 py-1 rounded-lg text-indigo-400 flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" /> PROCESSANDO OCR...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left side: Upload simulators and OCR triggers */}
            <div className="space-y-4 font-sans text-left">
              <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 space-y-4">
                <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 tracking-wider block border-b border-zinc-900 pb-1.5">
                  Simulador de Documentos de Secretaria
                </span>

                <div className="space-y-2">
                  <p className="text-[11px] text-zinc-450 leading-relaxed font-sans mb-3">
                    Clique num dos documentos comuns abaixo para simular o processo automático de catalogação OCR:
                  </p>
                  
                  {[
                    { file: 'CC_RicardoBarbosa_Aluno.pdf', label: 'Cartão de Cidadão', desc: 'Identidade' },
                    { file: 'Atestado_Medico_2026.jpg', label: 'Atestado Aptidão Física', desc: 'Saúde' },
                    { file: 'Contrato_Frequencia_Assinado.pdf', label: 'Contrato Assinado', desc: 'Legal' },
                    { file: 'Comprovativo_Propina_Junho.png', label: 'Comprovativo Transferência CGD', desc: 'Faturas' }
                  ].map((model) => (
                    <button
                      key={model.file}
                      onClick={() => {
                        setSelectedFileName(model.file);
                        runOcrSimulation(model.file);
                      }}
                      disabled={ocrRunning}
                      className="w-full text-left p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-indigo-400/50 hover:bg-zinc-800/10 cursor-pointer transition-all flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div>
                        <div className="text-[11px] font-bold text-zinc-200 font-mono group-hover:text-white transition-colors">{model.file}</div>
                        <div className="text-[9.5px] text-zinc-500 font-sans mt-0.5">{model.label}</div>
                      </div>
                      <span className="text-[8.5px] bg-indigo-500/10 px-1.5 py-0.5 rounded text-indigo-400 font-mono font-bold uppercase shrink-0">{model.desc}</span>
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-zinc-900">
                  <div className="p-4 border border-dashed border-zinc-800 rounded-xl hover:border-indigo-400/60 transition-all text-center select-none cursor-not-allowed">
                    <FileUp className="w-5 h-5 text-zinc-500 mx-auto mb-1.5" />
                    <span className="text-[10.5px] font-bold text-zinc-300 block">Carregar Ficheiro Adicional</span>
                    <span className="text-[8.5px] text-zinc-600 font-mono">SUPORTA PDF, PNG, JPG (MÁX 10MB)</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Middle & Right side: Steps and logs */}
            <div className="lg:col-span-2 space-y-4 text-left">
              <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 space-y-4">
                <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 tracking-wider block border-b border-zinc-900 pb-1.5">
                  Monitor de Extração Inteligente & Estado em Tempo Real [6 Passos]
                </span>

                {/* Stepper horizontal */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  {DOCUMENT_STEPS.map((step) => {
                    const isPassed = ocrStep >= step.num;
                    const isCurrent = ocrStep === step.num && ocrRunning;

                    return (
                      <div 
                        key={step.num}
                        className={`p-2 border rounded-xl flex flex-col justify-between transition-all ${
                          isPassed 
                            ? 'bg-emerald-500/5 border-emerald-500/25 text-emerald-400'
                            : isCurrent
                            ? 'bg-indigo-500/5 border-indigo-400 text-indigo-400 ring-1 ring-indigo-400 animate-pulse'
                            : 'bg-zinc-900/40 border-zinc-850 text-zinc-650'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[8.5px] font-bold font-mono px-1.5 py-0.1 rounded ${
                            isPassed ? 'bg-emerald-500/10' : isCurrent ? 'bg-indigo-500/5' : 'bg-zinc-850'
                          }`}>
                            P{step.num}
                          </span>
                          {isPassed && <Check className="w-3 h-3 text-emerald-400" />}
                          {isCurrent && <Loader2 className="w-2.5 h-2.5 text-indigo-400 animate-spin" />}
                        </div>
                        <div className="mt-2.5">
                          <h4 className="text-[9px] font-bold font-sans truncate">{step.label}</h4>
                          <p className="text-[8px] font-mono text-zinc-500 truncate mt-0.5">{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Console logs output */}
                  <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-850 flex flex-col justify-between h-[230px]">
                    <div className="border-b border-zinc-850 pb-2 mb-2 flex items-center justify-between text-[9px] font-mono font-bold text-zinc-450 uppercase">
                      <span>Histórico do Documento (OCR)</span>
                      <span className="text-[8.5px] text-zinc-650">Sistema de Leitura Eletrónica</span>
                    </div>
                    <div className="flex-1 overflow-y-auto font-mono text-[9px] text-zinc-400 leading-relaxed pr-1 space-y-1 select-text">
                      {ocrLogs.map((log, idx) => (
                        <div key={idx} className="flex gap-1.5">
                          <span className="text-zinc-650 font-bold">»</span>
                          <span className={log.includes('- Executar OCR') ? 'text-indigo-400' : 'text-zinc-300'}>{log}</span>
                        </div>
                      ))}
                      {ocrLogs.length === 0 && (
                        <p className="text-zinc-600 italic text-[9.5px]">Selecione um dos ficheiros modelo na barra lateral para inicializar extração em segundo plano.</p>
                      )}
                    </div>
                  </div>

                  {/* Extracted JSON/XML key-value representation */}
                  <div className="bg-zinc-900/60 p-4 border border-zinc-850 rounded-xl space-y-3 font-mono text-[11px] h-[230px] overflow-y-auto">
                    <span className="text-[9.5px] font-bold text-zinc-550 uppercase font-sans tracking-wide block border-b border-zinc-850 pb-1.5">Metadados OCR Catalogados</span>
                    
                    {ocrExtractedData ? (
                      <div className="space-y-3.5 text-[10.5px]">
                        <div>
                          <span className="text-zinc-500 font-sans block text-[9px] uppercase">Acurácia de Leitura:</span>
                          <strong className="text-emerald-450 font-bold">{ocrExtractedData.accuracy}</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-sans block text-[9px] uppercase">Tipo de Documento:</span>
                          <strong className="text-zinc-200">{ocrExtractedData.docType}</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-sans block text-[9px] uppercase">Aluno Associado:</span>
                          <strong className="text-indigo-400">{ocrExtractedData.studentAssoc}</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-sans block text-[9px] uppercase">NIF Fiscal Identificado:</span>
                          <strong className="text-zinc-300">{ocrExtractedData.nif}</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-sans block text-[9px] uppercase">Data de Validade Legal:</span>
                          <strong className="text-zinc-300">{ocrExtractedData.validity} (VÁLIDO)</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-zinc-600 font-sans text-xs italic">
                        Nenhum metadado extraído no momento.
                      </div>
                    )}
                  </div>
                </div>

                {/* Catalog history table */}
                <div className="border-t border-zinc-900/80 pt-4">
                  <span className="text-[10px] font-mono uppercase font-bold text-zinc-450 tracking-wider block mb-3">
                    Ficheiros Processados Automaticamente via OCR [Dossier Geral]
                  </span>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-sans text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-850 text-zinc-550 font-mono text-[9px] uppercase font-bold">
                          <th className="pb-1.5">Ficheiro</th>
                          <th className="pb-1.5">Tipo Classificado</th>
                          <th className="pb-1.5">Vinculado Ao Aluno</th>
                          <th className="pb-1.5 text-right">Precisão OCR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-850/60 font-medium text-zinc-300">
                        {ocrDocsList.map((doc, idx) => (
                          <tr key={idx} className="hover:bg-zinc-900/40">
                            <td className="py-2 font-mono text-[10.5px] text-zinc-100">{doc.name}</td>
                            <td className="py-2 text-zinc-400">{doc.type}</td>
                            <td className="py-2 font-semibold text-indigo-400">{doc.student}</td>
                            <td className="py-2 text-emerald-450 font-mono font-bold text-right">{doc.quality}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* VIEW: WORKFLOW FINANCEIRO */}
      {activeSubView === 'financeiro' && (
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6 space-y-6 animate-fadeIn" id="workflows_reconcile_financial">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-4 text-left font-sans">
            <div>
              <h2 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-400" />
                Processo de Recebimento & Sincronia Financeira
              </h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                Automatize o fluxo completo de quitação de propinas. Ao receber a compensação bancária, o sistema executa 5 passos e liquida saldos, emite recibo fiscal e atualiza os painéis.
              </p>
            </div>
            {paymentReconciling && (
              <span className="text-xs font-mono bg-indigo-500/15 border border-indigo-500/25 px-3 py-1 rounded-lg text-indigo-400 flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" /> CONCILIANDO FATURAÇÃO...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Form list of pending invoices to select for liquidation */}
            <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 space-y-4 text-left">
              <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 tracking-wider block border-b border-zinc-900 pb-1.5">
                Propinas & Cobranças em Aberto
              </span>

              <div className="space-y-3 font-sans text-xs">
                <p className="text-[11px] text-zinc-450 leading-relaxed font-sans mb-3">
                  Selecione uma fatura pendente ou atrasada abaixo para simular a chegada de compensação bancária:
                </p>

                <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                  {invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => setSelectedInvoiceForPayment(inv.id)}
                      disabled={paymentReconciling}
                      className={`w-full text-left p-3 border rounded-xl hover:bg-zinc-900 cursor-pointer transition-all disabled:opacity-55 ${
                        selectedInvoiceForPayment === inv.id 
                          ? 'border-indigo-400 bg-indigo-500/5' 
                          : 'border-zinc-850 bg-zinc-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
                          {inv.id}
                        </span>
                        <span className={`text-[9.5px] uppercase font-bold font-mono px-1.5 py-0.2 rounded-full ${
                          inv.status === 'pending' ? 'bg-amber-500/15 text-amber-500' : 'bg-rose-500/15 text-rose-500'
                        }`}>
                          {inv.status === 'pending' ? 'pendente' : 'em atraso'}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-zinc-100 font-sans mt-2">{inv.studentName}</h4>
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mt-1">
                        <span>Categoria: <strong className="text-zinc-300">{inv.category === 'tuition' ? 'Propina regular' : inv.category === 'material' ? 'Manual Escolar' : 'Extra letiva'}</strong></span>
                        <span className="text-emerald-400 font-bold">€{inv.amount}</span>
                      </div>
                    </button>
                  ))}
                  {invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length === 0 && (
                    <p className="text-zinc-500 italic text-[10px] text-center p-4">Excelente! Não há propinas em aberto no momento na secretaria.</p>
                  )}
                </div>

                <button
                  onClick={triggerPaymentReconciliation}
                  disabled={paymentReconciling || !selectedInvoiceForPayment}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold font-sans tracking-wide transition-all border ${
                    paymentReconciling || !selectedInvoiceForPayment
                      ? 'bg-zinc-800 text-zinc-500 border-zinc-850 cursor-not-allowed'
                      : 'bg-indigo-500 hover:bg-indigo-650 text-white border-indigo-400 cursor-pointer shadow-lg hover:shadow-indigo-500/10'
                  }`}
                >
                  {paymentReconciling ? 'Sincronizando Módulos...' : 'Disparar Liquidação Automática'}
                </button>
              </div>
            </div>

            {/* Visual Trace output: payment received steps */}
            <div className="lg:col-span-2 space-y-4 text-left">
              <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 space-y-4">
                <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 tracking-wider block border-b border-zinc-900 pb-1.5">
                  Fluxo de Liquidação Financeira [5 Passos em Tempo Real]
                </span>

                {/* 5 Step Payment Stepper */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {PAYMENT_STEPS.map((step) => {
                    const isPassed = paymentStep >= step.num;
                    const isCurrent = paymentStep === step.num && paymentReconciling;

                    return (
                      <div 
                        key={step.num}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                          isPassed 
                            ? 'bg-emerald-500/5 border-emerald-500/25 text-emerald-400'
                            : isCurrent
                            ? 'bg-indigo-500/5 border-indigo-400 text-indigo-400 ring-1 ring-indigo-400 animate-pulse'
                            : 'bg-zinc-900/40 border-zinc-850 text-zinc-650'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[8.5px] font-bold font-mono px-1.5 py-0.2 rounded ${
                            isPassed ? 'bg-emerald-500/10' : isCurrent ? 'bg-indigo-500/10' : 'bg-zinc-800'
                          }`}>
                            P{step.num}
                          </span>
                          {isPassed && <Check className="w-3 h-3 text-emerald-400" />}
                          {isCurrent && <Loader2 className="w-2.5 h-2.5 text-indigo-400 animate-spin" />}
                        </div>
                        <div className="mt-2.5">
                          <h4 className="text-[9px] font-bold font-sans truncate">{step.label}</h4>
                          <p className="text-[8px] font-mono text-zinc-500 truncate mt-0.5">{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Console traces log */}
                  <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-850 flex flex-col justify-between h-[230px]">
                    <div className="border-b border-zinc-850 pb-2 mb-2 flex items-center justify-between text-[9px] font-mono font-bold text-zinc-450 uppercase">
                      <span>Histórico de Conciliação Ativa</span>
                      <span className="text-[8.5px] text-zinc-650">Certificação Digital</span>
                    </div>
                    <div className="flex-1 overflow-y-auto font-mono text-[9px] text-zinc-400 leading-relaxed pr-1 space-y-1 select-text text-left">
                      {paymentLogs.map((log, idx) => (
                        <div key={idx} className="flex gap-1.5">
                          <span className="text-zinc-600 font-bold">»</span>
                          <span className="text-zinc-200">{log}</span>
                        </div>
                      ))}
                      {paymentLogs.length === 0 && (
                        <p className="text-zinc-600 italic text-[9.5px]">Selecione uma cobrança pendente e clique no botão de liquidação para validar as compensações letivas.</p>
                      )}
                    </div>
                  </div>

                  {/* Receipt Voucher output preview */}
                  <div className="bg-zinc-900/60 p-4 border border-zinc-850 rounded-xl space-y-2.5 font-mono text-[11px] h-[230px] overflow-y-auto relative text-left">
                    <span className="text-[9.5px] font-bold text-zinc-550 uppercase font-sans tracking-wide block border-b border-zinc-850 pb-1.5 mr-6">Recibo Eletrónico Emitido</span>
                    
                    {paymentReceipt ? (
                      <div className="space-y-1.5 pt-0.5 font-mono text-[9.5px] text-zinc-300 relative">
                        <div className="absolute right-0 top-0 bg-emerald-500/10 p-0.5 px-1.5 rounded border border-emerald-500/20 text-emerald-400 animate-fadeIn text-[7.5px] font-bold uppercase shrink-0">
                          PAGO
                        </div>
                        <div className="text-center font-bold text-[10.5px] text-zinc-150 uppercase tracking-wider leading-relaxed pb-1 border-b border-dashed border-zinc-800">
                          NEXUS EDU DIGITAL <br /> Recibo de Quitação Escolar
                        </div>
                        <div className="space-y-0.5 py-1.5 font-mono">
                          <p>Nº RECIBO: <strong className="text-emerald-400">{paymentReceipt.receiptId}</strong></p>
                          <p>DATA CARIMBO: <strong className="text-zinc-200">{paymentReceipt.date} • {paymentReceipt.time}</strong></p>
                          <p>ESTUDANTE: <strong className="text-zinc-200">{paymentReceipt.studentName}</strong></p>
                          <p>DOC DE ORIGEM: <strong className="text-zinc-150">{paymentReceipt.invoiceId}</strong></p>
                        </div>
                        <div className="text-right text-[11px] font-bold border-y border-dashed border-zinc-800 py-1 flex justify-between mt-1">
                          <span>TOTAL LIQUIDADO:</span>
                          <strong className="text-emerald-450 text-xs">€{paymentReceipt.amount}.00</strong>
                        </div>
                        <p className="text-[7.5px] text-zinc-600 pt-1 leading-normal text-center">Registado no livro de auditoria e arquivado por assinatura certificada no sistema Nexus Escolar.</p>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-zinc-600 font-sans text-xs italic text-center">
                        Aguardar conclusão do processo para gerar quitação oficial.
                      </div>
                    )}
                  </div>
                </div>

                {/* Successful reconcile trace feedback */}
                {paymentReceipt && (
                  <div className="p-3.5 bg-emerald-550/5 border border-emerald-500/20 rounded-xl space-y-2 animate-fadeIn text-left">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold font-mono text-emerald-450 uppercase">
                      <ShieldCheck className="w-4 h-4 text-emerald-450" />
                      <span>Transação Liquidada e Registos Sincronizados</span>
                    </div>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      O saldo Outstanding Fee do aluno <strong>{paymentReceipt.studentName}</strong> foi regularizado com o pagamento de <strong>€{paymentReceipt.amount}</strong>. O encarregado de educação já foi notificado electronicamente.
                    </p>
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      )}

      {/* VIEW: CONSTRUTOR DE WORKFLOWS (SE / ENTÃO / AÇÃO) */}
      {activeSubView === 'builder' && (
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6 space-y-6 animate-fadeIn" id="workflows_rules_builder">
          <div className="border-b border-zinc-800 pb-4 text-left font-sans">
            <h2 className="text-base font-bold text-zinc-200 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400 animate-pulse" />
              Construtor Visual de Regras Escolares [No-Code]
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Configure regras dinâmicas baseadas em lógica condicional. Defina o gatilho (SE) e encadeie múltiplas consequências (ENTÃO) como exigências do seu fluxo de automação institucional.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            
            {/* Creator form */}
            <div className="lg:col-span-2 bg-zinc-950 border border-zinc-850 rounded-xl p-4 space-y-4">
              <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 tracking-wider block border-b border-zinc-900 pb-1.5 text-left">
                Definição de Lógica Condicional (SE e ENTÃO)
              </span>

              <form onSubmit={handleCreateCustomRule} className="space-y-4 font-sans text-xs text-left">
                
                {/* 1. SE (Trigger Selection) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono text-indigo-400 font-bold flex items-center gap-1.5">
                    <span className="bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-400/20 text-[9px]">SE</span> 
                    <span>GATILHO AUTOMÁTICO (EVENT TRIGGER)</span>
                  </label>
                  <select
                    value={builderTrigger}
                    onChange={(e) => setBuilderTrigger(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-150 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                  >
                    <option value="Documento obrigatório expirar em < 15 dias">Documento obrigatório expirar em &lt; 15 dias</option>
                    <option value="Ausência injustificada registada (3 faltas)">Ausência injustificada registada (3 faltas)</option>
                    <option value="Pagamento de propina atrasar 15 dias">Pagamento de propina atrasar 15 dias</option>
                    <option value="A média de notas do aluno descer de 10.0">A média de notas do aluno descer de 10.0</option>
                    <option value="Nova matrícula de aluno iniciada pelo portal">Nova matrícula de aluno iniciada pelo portal</option>
                    <option value="Contrato letivo assinado eletronicamente">Contrato letivo assinado eletronicamente</option>
                  </select>
                </div>

                {/* 2. ENTÃO LIST (Chainable Consequences Builder) */}
                <div className="space-y-3">
                  <label className="text-[10px] uppercase font-mono text-emerald-400 font-bold flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-emerald-555/10 px-1.5 py-0.5 rounded border border-emerald-400/20 text-[9px] text-emerald-450">ENTÃO</span>
                      <span>CONSEQUÊNCIAS AUTOMÁTICAS (ACTIONS)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddNewConsequence}
                      className="text-[9px] bg-zinc-900 border border-zinc-800 text-indigo-400 hover:text-indigo-300 font-mono px-2 py-0.5 rounded hover:border-indigo-400/30 transition-all cursor-pointer font-bold"
                    >
                      + Consequência
                    </button>
                  </label>

                  <div className="space-y-2.5">
                    {builderConsequences.map((consequence, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 animate-fadeIn">
                        <span className="text-[9px] font-mono text-zinc-500 font-bold">#{idx + 1}</span>
                        <select
                          value={consequence}
                          onChange={(e) => handleConsequenceChange(idx, e.target.value)}
                          className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-150 rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                        >
                          <option value="">-- Selecione uma Ação --</option>
                          <option value="Criar tarefa de secretaria no dossier do aluno">Criar tarefa de secretaria no dossier do aluno</option>
                          <option value="Enviar notificação automática e aviso WhatsApp">Enviar aviso automático por WhatsApp ao encarregado</option>
                          <option value="Enviar lembrete eletrónico automático por e-mail">Disparar lembrete eletrónico de e-mail</option>
                          <option value="Suspender permissões de portal temporariamente">Suspender permissões do portal provisoriamente</option>
                          <option value="Emitir cobrança com acréscimo de 2.5% juros">Emitir cobrança extraordinária junta com 2.5% juros</option>
                          <option value="Notificar Direção executiva e registar log auditoria">Notificar Diretor Executivo e expedir hash no auditor</option>
                          <option value="Solicitar entrevista de tutoria pedagógica presencial">Agendar de imediato entrevista letiva com pais</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveConsequence(idx)}
                          disabled={builderConsequences.length <= 1}
                          className="p-2 border border-zinc-850 bg-zinc-900 text-zinc-500 hover:text-rose-450 rounded-lg hover:border-rose-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                          title="Remover ação"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. LIVE BLUEPRINT DIAGRAM FLOW PREVIEW */}
                <div className="pt-2 border-t border-zinc-900 text-left font-mono">
                  <span className="text-[9px] font-bold text-zinc-550 uppercase">Visualizador do Fluxo (Blueprint Diagram)</span>
                  <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-850 text-[10px] space-y-2 mt-2 select-none">
                    
                    {/* Trigger Node */}
                    <div className="bg-indigo-500/5 border border-indigo-400/40 p-2 rounded-lg flex items-center gap-2">
                      <span className="bg-indigo-500 text-white font-bold px-1.5 py-0.1 rounded text-[8px] shrink-0">SE</span>
                      <span className="text-indigo-400 font-semibold truncate text-[10.5px]">{builderTrigger}</span>
                    </div>

                    {/* Consequence Nodes with connected arrows */}
                    {builderConsequences.filter(c => c !== '').map((cons, idx) => (
                      <div key={idx} className="space-y-2 animate-fadeIn">
                        <div className="flex justify-center py-0.5">
                          <ArrowRight className="w-4 h-4 text-zinc-500 rotate-90" />
                        </div>
                        <div className="bg-emerald-555/5 border border-emerald-400/40 p-2 rounded-lg flex items-center gap-2">
                          <span className="bg-emerald-500 text-white font-bold px-1.5 py-0.1 rounded text-[8px] shrink-0">ENTÃO</span>
                          <span className="text-emerald-400 truncate text-[10px]">{cons}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-650 text-white rounded-lg text-xs font-bold transition-all border border-indigo-400 cursor-pointer shadow-lg hover:shadow-indigo-500/10 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Compilar e Ativar Automação
                </button>
              </form>

              {builtRulesCount > 0 && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-400/30 rounded-xl space-y-1 text-left animate-fadeIn">
                  <div className="text-[10.5px] font-bold font-mono text-indigo-400">✓ Processo Automático Ativado</div>
                  <p className="text-[9.5px] text-zinc-450 font-sans leading-relaxed">
                    A regra de processo automático foi adicionada e integrada com sucesso ao sistema inteligente escolar de regras recorrentes.
                  </p>
                </div>
              )}
            </div>

            {/* List of custom rules currently compile registered */}
            <div className="lg:col-span-3 space-y-4 text-left">
              
              {/* IF IN LIVE TEST MODE: Show beautiful stepper overlay drawer */}
              {simulatingRuleId !== null && (
                <div className="bg-zinc-950 border-2 border-indigo-500/65 rounded-xl p-5 space-y-4.5 animate-fadeIn relative">
                  <button 
                    onClick={() => setSimulatingRuleId(null)}
                    className="absolute right-3.5 top-3.5 text-zinc-400 hover:text-white font-mono text-xs cursor-pointer bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded"
                  >
                    Fechar Monitor
                  </button>
                  
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-2.5">
                    <span className="p-1 px-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/15 text-xs font-mono font-bold">TEST MODE</span>
                    <h3 className="text-sm font-bold text-zinc-200">Simulação e Estado de Execução da Regra: {simulatingRuleId}</h3>
                  </div>

                  {/* Progressive indicator pipeline */}
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 bg-zinc-900/60 p-4 border border-zinc-850 rounded-xl space-y-2.5 text-left font-mono text-[10.5px]">
                      <span className="text-[8.5px] font-bold text-zinc-550 uppercase font-sans tracking-wide block border-b border-zinc-800 pb-1.5">Seqüência Lógica</span>
                      
                      {/* Trigger block state */}
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${simRuleStep >= 0 ? 'bg-emerald-400' : 'bg-indigo-400 animate-pulse'}`} />
                        <span className="text-zinc-500">Gatilho (SE):</span>
                        <span className="text-zinc-100 font-bold">
                          {customRules.find(r => r.id === simulatingRuleId)?.trigger}
                        </span>
                      </div>

                      {/* Consequence list step indicators */}
                      {customRules.find(r => r.id === simulatingRuleId)?.consequences.map((cons, idx) => {
                        const isPassed = simRuleStep >= idx + 1;
                        const isCurrent = simRuleStep === idx;
                        return (
                          <div key={idx} className="flex items-center gap-2 pl-3 border-l border-zinc-800">
                            <span className={`w-2 h-2 rounded-full ${
                              isPassed ? 'bg-emerald-400' : isCurrent ? 'bg-indigo-400 animate-pulse' : 'bg-zinc-800'
                            }`} />
                            <span className="text-zinc-500">Passo {idx + 1} (ENTÃO):</span>
                            <span className={`${isPassed ? 'text-emerald-400 font-medium' : isCurrent ? 'text-indigo-400 animate-pulse' : 'text-zinc-600'}`}>
                              {cons}
                            </span>
                            {isPassed && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Console log outputs */}
                    <div className="flex-1 bg-zinc-900 p-3 rounded-xl border border-zinc-850 h-[155px] overflow-y-auto font-mono text-[9px] text-zinc-400 leading-normal space-y-1">
                      {simRuleLogs.map((log, lIdx) => (
                        <div key={lIdx} className="flex gap-2">
                          <span className="text-zinc-650">✓</span>
                          <span className={log.includes('[SUCESSO]') ? 'text-emerald-400' : 'text-zinc-200'}>{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 space-y-4">
                <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 tracking-wider block border-b border-zinc-900 pb-1.5">
                  Regras Ativas e Operacionais no Sistema [{customRules.length}]
                </span>

                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                  {customRules.map((rule) => (
                    <div 
                      key={rule.id} 
                      className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-750 transition-all relative group flex flex-col justify-between md:flex-row md:items-center gap-3"
                    >
                      <div className="space-y-1.5 flex-1 text-left font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-bold bg-zinc-950 border border-zinc-850 px-1.5 py-0.5 rounded text-indigo-400">
                            {rule.id}
                          </span>
                          <span className={`text-[8.5px] font-bold uppercase font-mono px-1 py-0.2 rounded border ${
                            rule.active ? 'bg-emerald-550/5 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-750'
                          }`}>
                            {rule.active ? 'Compilação OK' : 'Desativado'}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-zinc-100 leading-relaxed">
                          <span className="text-zinc-500 font-sans">SE: </span> {rule.trigger}
                        </div>
                        {rule.consequences.map((cons, idx) => (
                          <div key={idx} className="text-[10.5px] text-zinc-450 pl-2 text-left border-l-2 border-indigo-500/30">
                            <span className="text-zinc-650 text-[9px] font-bold">ENTÃO ({idx + 1}): </span> {cons}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => simulateRuleExecution(rule)}
                          disabled={!rule.active || simulatingRuleId !== null}
                          className={`flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded border transition-all ${
                            rule.active && simulatingRuleId === null
                              ? 'bg-zinc-950 hover:bg-zinc-850 text-indigo-400 border-zinc-850 hover:border-indigo-400/30 font-bold cursor-pointer'
                              : 'bg-zinc-250 text-zinc-700 border-zinc-850 cursor-not-allowed'
                          }`}
                          title="Simular execução"
                        >
                          <Play className="w-3 h-3 text-emerald-450" /> Testar
                        </button>
                        
                        <button
                          onClick={() => deleteCustomRule(rule.id)}
                          className="p-1 text-zinc-550 hover:text-rose-450 border border-zinc-850 bg-zinc-950 hover:border-rose-500/25 rounded cursor-pointer transition-all"
                          title="Remover regra"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* DEDICATED COMPLIANCE AUDIT PANEL */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 space-y-4 text-left shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-450" />
            <h2 className="text-sm font-bold text-zinc-200">Painel Geral de Auditoria de Processos</h2>
          </div>
          <span className="text-[8.5px] font-mono text-zinc-500">ISO/IEC 27011 conformidade letiva</span>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed font-sans">
          Cada acionamento, homologação ou alteração nos processos automáticos é registada de forma segura com carimbo histórico temporal. Previne erros e fraudes em todos os módulos integrados.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-850 text-zinc-550 font-mono text-[9.5px] uppercase font-bold">
                <th className="pb-2">Audit ID</th>
                <th className="pb-2">Processo Escalado</th>
                <th className="pb-2">Operador Origem</th>
                <th className="pb-2">Validado Por</th>
                <th className="pb-2">Data Letiva</th>
                <th className="pb-2 text-right font-semibold">Carimbo Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/50 font-medium text-zinc-400 font-mono text-[10px]">
              {instances.map((inst, index) => (
                <tr key={index} className="hover:bg-zinc-950/40">
                  <td className="py-2.5 text-zinc-200 font-bold">{inst.id}.AUD</td>
                  <td className="py-2.5 text-zinc-300 font-mono">{inst.name}</td>
                  <td className="py-2.5 text-zinc-450">{inst.startedBy}</td>
                  <td className="py-2.5 text-emerald-450 font-semibold">{inst.approvedBy || 'Processador Escolar'}</td>
                  <td className="py-2.5 text-zinc-500">{inst.date}</td>
                  <td className="py-2.5 text-zinc-500 text-right font-semibold">{inst.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
