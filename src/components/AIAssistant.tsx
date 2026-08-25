import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Bot, Sparkles, MessageSquare, CornerDownLeft, Loader2, RefreshCw, 
  Database, FileText, Zap, AlertTriangle, Bell, Search, CheckCircle2, 
  Activity, ShieldCheck, UserCheck, Trash2
} from 'lucide-react';
import { Student, Teacher, Invoice } from '../types';
import { getHeaders } from '../supabaseClient';

interface AIAssistantProps {
  students: Student[];
  teachers: Teacher[];
  invoices: Invoice[];
  onRefreshData?: () => void;
}

const AI_UNAVAILABLE_MESSAGE = 'Funcionalidade temporariamente indisponível. O assistente institucional ainda não está ligado a uma autoridade de IA autorizada.';

export default function AIAssistant({ students, teachers, invoices, onRefreshData }: AIAssistantProps) {
  const [messages, setMessages] = useState<{ id: string; role: 'user' | 'assistant'; content: string; timestamp?: string }[]>([
    {
      id: 'welcome-message',
      role: 'assistant',
      content: AI_UNAVAILABLE_MESSAGE,
      timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'integrations' | 'tasks'>('console');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isLoading) return;

    if (!textToSend) {
      setInputMessage('');
    }

    const currentTimestamp = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev,
      { id: `user-msg-${Date.now()}`, role: 'user', content: text, timestamp: currentTimestamp },
      { id: `assistant-unavailable-${Date.now()}`, role: 'assistant', content: AI_UNAVAILABLE_MESSAGE, timestamp: currentTimestamp },
    ]);
  };

  const parseMarkdown = (text: string) => {
    // Elegant formatting replacement helper supporting tables, blockquotes, code-blocks and status indicators
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded font-mono text-xs">$1</code>')
      .replace(/### (.*?)\n/g, '<h3 class="text-xs font-semibold text-zinc-100 mt-4 mb-2 first:mt-1 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-800 pb-1">$1</h3>')
      .replace(/## (.*?)\n/g, '<h2 class="text-sm font-bold text-zinc-150 mt-5 mb-2.5">$1</h2>')
      .replace(/^- (.*?)\n/gm, '<li class="ml-4 list-disc text-zinc-300 py-0.5">$1</li>')
      // Custom green action indicator blocks for real transactions
      .replace(/\[AGENT_ACTION\] (.*?)\n/g, '<div class="my-3 px-3.5 py-2.5 bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center gap-2 font-mono"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><strong>AÇÃO OPERACIONAL EFETUADA:</strong> $1</div>')
      // Custom warning blocks for anomalies
      .replace(/\[ANOMALY_DETECTED\] (.*?)\n/g, '<div class="my-3 px-3.5 py-2.5 bg-rose-950/25 border border-rose-500/20 text-rose-400 rounded-lg text-xs flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0"></span><strong>ALERTA DE SEGURANÇA:</strong> $1</div>')
      // Table formatting placeholders
      .replace(/(\|.*\|)\n/g, (match) => {
        if (match.includes('---')) return ''; // Skip separator lines
        const cells = match.split('|').filter(c => c.trim() !== '');
        const isHeader = match.includes('Nome') || match.includes('ID') || match.includes('Média');
        const cellClass = isHeader 
          ? 'px-3 py-1.5 text-left text-[11px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-850 border border-zinc-800' 
          : 'px-3 py-1.5 text-zinc-300 border border-zinc-800 text-xs';
        const rowContent = cells.map(c => `<td class="${cellClass}">${c.trim()}</td>`).join('');
        return `<tr class="hover:bg-zinc-800/10 transition-colors">${rowContent}</tr>`;
      });

    // Handle wrapping of generic tables inside elegant responsive layouts
    if (formatted.includes('</tr>')) {
      formatted = formatted.replace(/(<tr.*<\/tr>)+/g, '<div class="overflow-x-auto my-3 border border-zinc-800 rounded-lg"><table class="min-w-full divide-y divide-zinc-850 bg-zinc-900/40">$1</table></div>');
    }

    return formatted.split('\n').map((line, idx) => {
      if (line.trim().startsWith('<li') || line.trim().startsWith('<h3') || line.trim().startsWith('<h2') || line.trim().startsWith('<div') || line.trim().startsWith('<strong class="action"')) {
        return <div key={idx} dangerouslySetInnerHTML={{ __html: line }} />;
      }
      return <p key={idx} className="min-h-4 text-zinc-300 leading-relaxed text-xs" dangerouslySetInnerHTML={{ __html: line }} />;
    });
  };

  // Predefined actual high-frequency operational prompts representing the digital worker's actual capabilities
  const actionsList = [
    {
      title: 'Gerar Cobrança (Recibo João Silva)',
      query: 'Por favor, gera uma fatura/cobrança de mensalidade no valor de 155 Euros para o aluno João Silva (ALU-101) com vencimento para 2026-07-05.',
      icon: Database,
      badge: 'Cobranças / Invoices',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-550/20'
    },
    {
      title: 'Mostrar Pagamentos Pendentes',
      query: 'Faz uma auditoria e mostra todas as faturas e pagamentos com estado pendente (pending) registados no sistema escolar.',
      icon: Search,
      badge: 'Financeiro',
      color: 'text-amber-400 bg-amber-500/10 border-amber-550/20'
    },
    {
      title: 'Criar Certificado de Matrícula',
      query: 'Gera e regista um Certificado de Matrícula oficial com assinatura digital para o aluno João Silva (ALU-101) para o ano letivo 2025/2026.',
      icon: FileText,
      badge: 'Certificados',
      color: 'text-sky-400 bg-sky-500/10 border-sky-550/20'
    },
    {
      title: 'Encontrar Contrato de João Silva',
      query: 'Localiza o dossiê, contratos carregados no OCR e documentos arquivados do aluno João Silva (ALU-101).',
      icon: FileText,
      badge: 'Dossiês OCR',
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-550/20'
    },
    {
      title: 'Gerar Declaração de Frequência',
      query: 'Gera uma Declaração de Frequência Escolar oficial em formato digital para o aluno Bruno Medeiros (ALU-105) para fins de justificação de faltas.',
      icon: FileText,
      badge: 'Declarações',
      color: 'text-pink-400 bg-pink-500/10 border-pink-550/20'
    },
    {
      title: 'Criar Relatório Administrativo',
      query: 'Faz a emissão e gera um relatório consolidado do tipo "financial" (Relatório Financeiro) com auditoria na base de dados da escola.',
      icon: Activity,
      badge: 'Filtro Relatórios',
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-550/20'
    },
    {
      title: 'Agendar Nova Tarefa Operacional',
      query: 'Cria uma tarefa interna na pauta da secretaria com prioridade alta assim definida: Titulo: "Ligar encarregados do 8º Ano", Descricao: "Efetuar chamadas para encarregados pendentes de boletim vacina."',
      icon: CheckCircle2,
      badge: 'Fluxo Interno',
      color: 'text-purple-400 bg-purple-500/10 border-purple-550/20'
    },
    {
      title: 'Disparar Alerta Avisos (SMS/Fluxo)',
      query: 'Cria uma notificação oficial destinada a todos (all) para avisar sobre a reunião do conselho de turma no final do mês.',
      icon: Bell,
      badge: 'Circulares',
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-550/20'
    }
  ];

  return (
    <div id="nexus_copilot_digital_worker_panel" className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden h-[calc(100vh-140px)] flex flex-col shadow-2xl relative">
      
      {/* Worker Banner / Agent Header */}
      <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center relative shrink-0">
            <Bot className="w-5.5 h-5.5 text-emerald-400" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-900 flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-emerald-100 rounded-full animate-ping"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-zinc-100">Assistente Nexus</h1>
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono font-medium">
                INDISPONÍVEL
              </span>
            </div>
            <p className="text-xs text-zinc-400">Sem consulta, análise ou ações institucionais neste ambiente.</p>
          </div>
        </div>

        {/* Quick Tabs */}
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
          <button 
            onClick={() => setActiveTab('console')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'console' ? 'bg-zinc-850 text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Activity className="w-3.5 h-3.5" />
            Consola Ativa
          </button>
          <button 
            onClick={() => setActiveTab('integrations')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'integrations' ? 'bg-zinc-850 text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Database className="w-3.5 h-3.5" />
            Mapeamento Real (B.D.)
          </button>
          <button 
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'tasks' ? 'bg-zinc-850 text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Ordens Rápidas
          </button>
        </div>
      </div>

      {/* Main split dashboard view depending on active tab */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Interactive Integrations Dashboard & Metadata - visible on md screens */}
        <div className="hidden lg:flex w-72 border-r border-zinc-800 bg-zinc-900/30 flex-col p-4 space-y-4 overflow-y-auto">
          <div>
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              SISTEMAS OPERATIVOS
            </h2>
            <div className="space-y-2">
              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 flex items-center justify-between mb-1">
                  INFRAESTRUTURA DE DADOS
                  <span className="font-mono text-emerald-400">Ativa</span>
                </span>
                <p className="text-xs font-semibold text-zinc-100">Live Cloud SQL</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-400 font-mono">
                  <span>Alunos: <b>{students.length}</b></span>
                  <span>Notas: <b>Ok</b></span>
                  <span>Faturas: <b>{invoices.length}</b></span>
                </div>
              </div>

              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 flex items-center justify-between mb-1">
                  SERVIÇO DE FICHEIROS
                  <span className="font-mono text-emerald-400">OCR Activo</span>
                </span>
                <p className="text-xs font-semibold text-zinc-100">Biblioteca Virtual / Dossiês</p>
                <p className="text-[10px] text-zinc-400 mt-1 font-mono">
                  Indexação automática de CC, Vacinas e Contratos com extração OCR.
                </p>
              </div>

              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 flex items-center justify-between mb-1">
                  SISTEMA DE PROCESSOS
                  <span className="font-mono text-emerald-400">execução ativa</span>
                </span>
                <p className="text-xs font-semibold text-zinc-100">Processos de Saída</p>
                <p className="text-[10px] text-zinc-400 mt-1 font-mono">
                  Envio SMS de Cobrança, E-mail de Avisos e Triggers Automatizados.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              CAPACIDADES OPERATIVAS
            </h2>
            <div className="text-[11px] space-y-1.5 text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Procura inteligente na base de dados</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Detecção de anomalias/baixas médias</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Relatórios e pautas integradas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>OCR de Contratos de Alunos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Mutação real de dívida de propinas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Disparo real de fluxos e circulares</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button 
              onClick={() => setMessages([{
                id: 'reset-welcome-message',
                role: 'assistant',
                content: 'Olá! Recompilei a minha memória de trabalho. A base de dados central está sincronizada e operante. Como funcionário digital inteligente da escola, que tarefas operacionais deseja que execute agora?',
                timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
              }])}
              className="w-full text-xs text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1.5 py-2 rounded bg-zinc-800/40 hover:bg-zinc-850 border border-zinc-850 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset do Histórico
            </button>
          </div>
        </div>

        {/* Center/Right: Console logs, Integrations inspect, or Action buttons depending on tab selection */}
        <div className="flex-1 flex flex-col bg-zinc-950/40 relative">
          
          {/* TAB 1: Console View (Typical AI Chat, but augmented) */}
          {activeTab === 'console' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 max-w-[90%] md:max-w-[85%] ${
                    message.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      message.role === 'user'
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-sm'
                    }`}
                  >
                    {message.role === 'user' ? 'U' : <Bot className="w-4 h-4" />}
                  </div>
                  <div>
                    <div
                      className={`rounded-xl px-4 py-3 leading-relaxed border ${
                        message.role === 'user'
                          ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow'
                          : 'bg-zinc-900/60 border-zinc-850 text-zinc-300'
                      }`}
                    >
                      <div className="space-y-2">
                        {parseMarkdown(message.content)}
                      </div>
                    </div>
                    {message.timestamp && (
                      <p className={`text-[10px] text-zinc-500 mt-1 ${message.role === 'user' ? 'text-right mr-1' : 'ml-1'}`}>
                        {message.timestamp} • {message.role === 'user' ? 'Utilizador' : 'Nexus Copilot'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Activity className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="rounded-xl px-4 py-3 text-xs bg-zinc-900/60 border border-zinc-850 text-zinc-400 italic flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    Nexus Copilot está a comunicar com a base de dados central, analisando os registos e efetuando tarefas operacionais...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* TAB 2: Database and System Integrations Inspector */}
          {activeTab === 'integrations' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Esquema de Dados e Relações (Tabelas Escolares)
                </h3>
                <p className="text-xs text-zinc-400 mb-4">
                  O Copilot lê e escreve diretamente nas pautas da base de dados escolar. Abaixo estão representados os volumes atuais que o agente está a monitorizar.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 flex flex-col">
                    <span className="text-[10px] text-zinc-500 uppercase font-mono">Tabela Estudantes</span>
                    <span className="text-xl font-bold text-zinc-100 mt-1">{students.length}</span>
                    <span className="text-[10px] text-emerald-500 mt-1">✓ Acesso R/W</span>
                  </div>
                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 flex flex-col">
                    <span className="text-[10px] text-zinc-500 uppercase font-mono">Tabela Pagamentos</span>
                    <span className="text-xl font-bold text-zinc-100 mt-1">{invoices.length}</span>
                    <span className="text-[10px] text-emerald-500 mt-1">✓ Auditável</span>
                  </div>
                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 flex flex-col">
                    <span className="text-[10px] text-zinc-500 uppercase font-mono">Tabela Docentes</span>
                    <span className="text-xl font-bold text-zinc-100 mt-1">{teachers.length}</span>
                    <span className="text-[10px] text-emerald-500 mt-1">✓ Sincronizado</span>
                  </div>
                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 flex flex-col">
                    <span className="text-[10px] text-zinc-500 uppercase font-mono">Logs de Operação</span>
                    <span className="text-xl font-bold text-zinc-100 mt-1">Ativo</span>
                    <span className="text-[10px] text-emerald-500 mt-1">✓ Registo de Auditoria</span>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  Repositório OCR Documental Inteligente
                </h3>
                <p className="text-xs text-zinc-400 mb-3">
                  O dossiê documental de cada aluno é verificado sistematicamente pelo agente à procura de inconsistências administrativas (como a ausência de contratos ou boletins de vacina obrigatórios).
                </p>
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850">
                  <div className="flex items-center justify-between text-xs text-zinc-300 pb-2 border-b border-zinc-850 mb-2 font-mono">
                    <span>Documentação Crítica Analisada</span>
                    <span className="text-emerald-400 font-bold">100% Sincronizado</span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-zinc-400">
                    <div className="flex items-center justify-between">
                      <span>• Cartão de Cidadão (Alojado & Carimbado)</span>
                      <span className="bg-emerald-500/10 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">AUDITADO</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• Boletim de Vacinas (Validação de datas pelo Copilot)</span>
                      <span className="bg-emerald-500/10 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">CONVERTIDO</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• Termo de Responsabilidade & Encarregados</span>
                      <span className="bg-emerald-500/10 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">VÍNCULO OK</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  Fluxos de Processos Automáticos Ativos
                </h3>
                <p className="text-xs text-zinc-400 mb-3">
                  O Copilot possui gatilhos ativos para acionar relatórios SMS ou notificações em massa destinadas aos encarregados de educação.
                </p>
                <div className="space-y-2">
                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-200">sms_notificacao_cobranca (ID: FLUX-01)</h4>
                      <p className="text-[10px] text-zinc-500">Trigger: Disparo manual pelo Copilot ou inadimplência &gt; €300</p>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-550/20 px-2 py-0.5 rounded font-mono">ATIVO</span>
                  </div>
                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-200">email_circulo_coordenadores (ID: FLUX-02)</h4>
                      <p className="text-[10px] text-zinc-500">Trigger: Queda súbita de notas de pauta geral em turmas</p>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-550/20 px-2 py-0.5 rounded font-mono">ATIVO</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Task Grid / Quick Action Orders */}
          {activeTab === 'tasks' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              <div className="border border-zinc-800 bg-zinc-900/20 p-4 rounded-xl">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2 mb-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
                  Ordens Rápidas de Operação Real
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Estes botões ordenam que o funcionário digital acione imediatamente as suas ferramentas integradas para realizar leituras ou mutações reais na base de dados, arquivos e processos.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {actionsList.map((act, idx) => {
                  const IconComp = act.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveTab('console');
                        handleSendMessage(act.query);
                      }}
                      className="text-left bg-zinc-900 border border-zinc-850 hover:border-zinc-700/80 p-4 rounded-xl transition duration-150 cursor-pointer flex flex-col justify-between h-36 hover:bg-zinc-850 group"
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className={`p-2 rounded-lg border ${act.color}`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-zinc-400 font-mono font-medium group-hover:border-zinc-700">
                          {act.badge}
                        </span>
                      </div>
                      <div className="mt-2.5">
                        <h4 className="text-xs font-semibold text-zinc-150 group-hover:text-zinc-100 transition-colors">
                          {act.title}
                        </h4>
                        <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                          {act.query}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Persistent input container on console tab */}
          {activeTab === 'console' && (
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/90 gap-2 flex flex-col">
              <div className="relative flex items-center">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ordene tarefas complexas de leitura, escrita ou processos automáticos..."
                  rows={1}
                  className="w-full resize-none bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 rounded-lg py-3 px-4 pr-12 text-xs text-zinc-100 placeholder-zinc-550 outline-none focus:ring-1 focus:ring-emerald-500 h-11"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className={`absolute right-2 p-1.5 rounded-md transition-all cursor-pointer ${
                    inputMessage.trim() && !isLoading
                      ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                      : 'text-zinc-650 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-1.5 text-[10px] text-zinc-500 px-1 mt-1">
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3 text-emerald-400/90" />
                  Operações são efetuadas e registadas na base real de auditoria em tempo real.
                </span>
                <span className="flex items-center gap-1 font-mono">
                  Shift + Enter para nova linha • Enter <CornerDownLeft className="w-2.5 h-2.5" /> enviar
                </span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
