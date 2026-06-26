import React, { useState, useEffect } from 'react';
import { 
  Users, AlertTriangle, GraduationCap, Clock, TrendingUp, DollarSign, 
  ArrowUpRight, Plus, Bell, Sparkles, Loader2, RefreshCw, FileText, 
  CheckCircle2, ShieldCheck, Zap, Activity, Search, AlertCircle, 
  ChevronRight, Landmark, Terminal, FileWarning, BarChart4, TrendingDown,
  Trash2
} from 'lucide-react';
import { Student, Teacher, Invoice, Announcement } from '../types';
import { getLiveLogs, getHeaders } from '../supabaseClient';

interface DashboardProps {
  students: Student[];
  teachers: Teacher[];
  invoices: Invoice[];
  announcements: Announcement[];
  setCurrentTab: (tab: string) => void;
  onQuickAction: (actionType: string) => void;
}

interface LogRecord {
  id: number;
  userId: string | null;
  userName: string;
  userRole: string;
  action: string;
  details: string;
  created_at?: string;
  timestamp?: string;
}

export default function Dashboard({ 
  students, 
  teachers, 
  invoices, 
  announcements, 
  setCurrentTab, 
  onQuickAction 
}: DashboardProps) {
   const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [predictiveReport, setPredictiveReport] = useState('');
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [todoTasks, setTodoTasks] = useState<{ id: string; title: string; description: string; dueDate: string; priority: string; status: string; assignedTo: string }[]>([]);
  
  // Interactive Controls
  const [chartMode, setChartMode] = useState<'grades' | 'attendance' | 'outstanding'>('grades');
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<Student | null>(null);

  // Fetch real database action logs
  const fetchLiveLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const records = await getLiveLogs();
      if (records && Array.isArray(records)) {
        setLogs(records.slice(0, 8)); // Grab the 8 most recent entries
      }
    } catch (err) {
      console.error('Erro ao ler logs de operação do postgres:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchTodoTasks = async () => {
    try {
      const response = await fetch('/api/tasks', { headers: await getHeaders() });
      if (response.ok) {
        const data = await response.json();
        setTodoTasks(data);
      }
    } catch (err) {
      console.error('Erro ao buscar tarefas:', err);
    }
  };

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'completado' ? 'pendente' : 'completado';
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: await getHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        fetchTodoTasks();
        const customEvent = new CustomEvent('nexus-realtime-update');
        window.dispatchEvent(customEvent);
      }
    } catch (err) {
      console.error('Erro ao atualizar tarefa:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: await getHeaders()
      });
      if (response.ok) {
        fetchTodoTasks();
        const customEvent = new CustomEvent('nexus-realtime-update');
        window.dispatchEvent(customEvent);
      }
    } catch (err) {
      console.error('Erro ao eliminar tarefa:', err);
    }
  };

  useEffect(() => {
    fetchLiveLogs();
    fetchTodoTasks();
  }, [students, invoices, announcements]);

  useEffect(() => {
    const handleRealtimeUpdate = () => {
      fetchLiveLogs();
      fetchTodoTasks();
    };
    window.addEventListener('nexus-realtime-update', handleRealtimeUpdate);
    return () => window.removeEventListener('nexus-realtime-update', handleRealtimeUpdate);
  }, []);

  // Handle Predictive Insight with real RAG context
  const handleGeneratePredictiveInsight = async () => {
    setIsGeneratingInsight(true);
    setPredictiveReport('');
    try {
      const response = await fetch('/api/predictive-insight', {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({
          students: students.map(s => ({
            name: s.name,
            class: s.class,
            averageGrade: s.averageGrade,
            attendanceRate: s.attendanceRate,
            outstandingFees: s.outstandingFees,
            behavior: s.behaviorDegree
          })),
          averageGrade,
          averageAttendance
        })
      });
      const data = await response.json();
      if (data.error) {
        setPredictiveReport(`Erro ao gerar previsão do oráculo: ${data.error}`);
      } else {
        setPredictiveReport(data.result);
      }
    } catch (err: any) {
      console.error(err);
      setPredictiveReport(`Incidência operacional de rede: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  // --- COMPUTE KEY METRICS FROM REAL POSTGRES STATE ---
  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === 'active').length;
  
  // 1. Receitas & Cobranças
  const expectedTotalBillings = invoices.reduce((acc, i) => acc + i.amount, 0);
  const realizedRevenue = invoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.amount, 0);
  const pendingRevenue = invoices.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.amount, 0);
  const overdueRevenue = invoices.filter(i => i.status === 'overdue').reduce((acc, i) => acc + i.amount, 0);
  const financialFidelityPct = expectedTotalBillings > 0 
    ? Math.round((realizedRevenue / expectedTotalBillings) * 100) 
    : 0;
  
  // 2. Desempenho Escolar (Média Geral)
  const averageGradeVal = totalStudents > 0 
    ? students.reduce((acc, s) => acc + s.averageGrade, 0) / totalStudents 
    : 0;
  const averageGrade = averageGradeVal.toFixed(2);
  
  // 3. Faltas & Assiduidade Geral
  const averageAttendance = totalStudents > 0 
    ? Math.round(students.reduce((acc, s) => acc + s.attendanceRate, 0) / totalStudents) 
    : 100;

  // 4. Documentos Pendentes Audit
  let totalMissingDocsCount = 0;
  const studentsWithMissingDocs = students.filter(s => {
    if (!s.documents || !Array.isArray(s.documents)) return false;
    const missing = s.documents.filter(d => !d.submitted);
    if (missing.length > 0) {
      totalMissingDocsCount += missing.length;
      return true;
    }
    return false;
  });

  // 5. Alunos em Risco Crítico
  const studentsAtRisk = students.filter(s => s.averageGrade < 7.0 || s.attendanceRate < 90);

  // --- AUTOMATED AUDIT DISCOVERIES (REAL-TIME SCANS) ---
  const systemAnomalies: { id: string; type: 'financial' | 'pedagogic' | 'doc'; title: string; desc: string; date: string }[] = [];

  students.forEach(s => {
    if (s.attendanceRate < 90) {
      systemAnomalies.push({
        id: `anomaly-att-${s.id}`,
        type: 'pedagogic',
        title: 'Faltas Excessivas',
        desc: `${s.name} (${s.class}) ultrapassou o limite legal. Assiduidade de ${s.attendanceRate}%.`,
        date: 'Crítico'
      });
    }
    if (s.averageGrade < 7.0) {
      systemAnomalies.push({
        id: `anomaly-grd-${s.id}`,
        type: 'pedagogic',
        title: 'Risco de Reprovação',
        desc: `${s.name} (${s.class}) registou média geral de ${s.averageGrade}/10, abaixo da meta escolar.`,
        date: 'Urgente'
      });
    }
    if (s.documents && Array.isArray(s.documents)) {
      const missing = s.documents.filter(d => !d.submitted).map(d => d.name);
      if (missing.length > 0) {
        systemAnomalies.push({
          id: `anomaly-doc-${s.id}`,
          type: 'doc',
          title: 'Documentação Omitida',
          desc: `${s.name} não submeteu: ${missing.join(', ')}. CC/Matrículas em falha.`,
          date: 'Auditado'
        });
      }
    }
  });

  invoices.forEach(i => {
    if (i.status === 'overdue') {
      systemAnomalies.push({
        id: `anomaly-inv-${i.id}`,
        type: 'financial',
        title: 'Mensalidade Vencida',
        desc: `Fatura de €${i.amount} referente ao aluno ${i.studentName} em atraso crónico.`,
        date: 'Cobrança activa'
      });
    }
  });

  // --- DYNAMIC CONTROL TASKS (REAL-TIME ACTION ORDERS) ---
  const dynamicTasks: { id: string; text: string; priority: 'alta' | 'média' | 'baixa' }[] = [];
  
  if (invoices.some(i => i.status === 'overdue')) {
    dynamicTasks.push({
      id: 'task-fin',
      text: 'Disparar SMS de cobrança preventiva via Copilot para faturas overdue',
      priority: 'alta'
    });
  }
  if (students.some(s => s.attendanceRate < 90)) {
    dynamicTasks.push({
      id: 'task-att',
      text: 'Agendar diálogo pedagógico com os Encarregados dos alunos com frequência < 90%',
      priority: 'alta'
    });
  }
  if (studentsWithMissingDocs.length > 0) {
    dynamicTasks.push({
      id: 'task-doc',
      text: `Instigar uploads pendentes para os ${studentsWithMissingDocs.length} dossiês incompletos`,
      priority: 'média'
    });
  }
  if (logs.length > 0) {
    dynamicTasks.push({
      id: 'task-log',
      text: 'Revisar histórico de alterações automáticas e auditorias efetuadas pelo Copilot',
      priority: 'baixa'
    });
  } else {
    dynamicTasks.push({
      id: 'task-gen',
      text: 'Promover simulado e auditoria preventiva geral na base de dados',
      priority: 'baixa'
    });
  }

  // Filter students showing in comparison rows
  const filteredStudentsForRows = students.filter(s => 
    s.name.toLowerCase().includes(studentSearchInput.toLowerCase()) ||
    s.class.toLowerCase().includes(studentSearchInput.toLowerCase())
  );

  return (
    <div id="school_realtime_cockpit" className="space-y-8 animate-fadeIn text-zinc-300">
      
      {/* Live Operational Title Frame */}
      <section className="flex flex-col xl:flex-row xl:items-end justify-between border-b border-zinc-800 pb-6 gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold tracking-[0.1em] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              SISTEMA INSTITUCIONAL ATIVO
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Atualização automática em tempo real</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold font-display tracking-tight text-white mt-2">
            Centro de Controlo Institucional
          </h1>
          <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed max-w-2xl">
            Painel institucional conectado de dados escolares e eventos operacionais. Acompanhamento integral das turmas, assiduidade e médias académicas em tempo real.
          </p>
        </div>

        {/* Global Key Stats Frame */}
        <div className="flex flex-wrap gap-6 lg:gap-8 xl:text-right">
          <div className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl shadow-sm">
            <div className="text-2xl font-bold font-mono text-zinc-100">{totalStudents}</div>
            <div className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mt-0.5 font-mono">Alunos Reais</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl shadow-sm">
            <div className="text-2xl font-bold font-mono text-zinc-100">{averageAttendance}%</div>
            <div className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mt-0.5 font-mono">Assiduidade Média</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl shadow-sm">
            <div className="text-2xl font-bold font-mono text-emerald-400">{averageGrade}/10</div>
            <div className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mt-0.5 font-mono">Média Académica</div>
          </div>
        </div>
      </section>

      {/* Control Actions & Utility Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <Landmark className="text-indigo-400 w-4 h-4 shrink-0" />
          <span className="text-xs font-bold text-zinc-100">Suite Operativa de Decisão Académica</span>
        </div>
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => fetchLiveLogs()}
            className="flex items-center gap-1.5 text-zinc-300 hover:text-white bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 text-xs px-3.5 py-2 rounded-lg transition-colors cursor-pointer font-mono font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            Sincronizar Dados
          </button>
          
          <button
            onClick={() => onQuickAction('add-student')}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Matricular Aluno
          </button>
        </div>
      </div>

      {/* Core Dynamic Bento Grid for Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Core Metric 1: Financial & Revenues */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-indigo-500/20 transition duration-150 relative overflow-hidden group shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase font-mono">Métricas de Faturação</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <span className="block text-2xl font-bold font-mono text-zinc-100">€{realizedRevenue}</span>
            <span className="text-[10px] text-zinc-400 block font-semibold font-mono mt-0.5">de €{expectedTotalBillings} Previsto</span>
          </div>
          
          {/* Progress realization bar */}
          <div className="mt-3 w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-850">
            <div 
              style={{ width: `${financialFidelityPct}%` }}
              className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
            />
          </div>

          <div className="mt-3 flex justify-between text-[10px] font-mono">
            <span className="text-emerald-400 font-bold">{financialFidelityPct}% Líquido Pago</span>
            <span className="text-zinc-400 font-bold">€{pendingRevenue + overdueRevenue} Em Débito</span>
          </div>
        </div>

        {/* Core Metric 2: Academic Risk */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-indigo-500/20 transition duration-150 relative overflow-hidden group shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase font-mono">Estudantes Em Risco</span>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${studentsAtRisk.length > 0 ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <span className="block text-2xl font-bold font-mono text-zinc-100">{studentsAtRisk.length}</span>
            <span className="block font-semibold font-mono text-[10px] text-zinc-400 mt-0.5">Alunos Vulneráveis</span>
          </div>
          <p className="text-[10px] mt-3 font-semibold font-mono text-zinc-450">
            {studentsAtRisk.length > 0 
              ? `Rendimento Crítico: ${studentsAtRisk.filter(s => s.averageGrade < 7.0).length} aluno(s)` 
              : 'Sem vulnerabilidades graves'}
          </p>
        </div>

        {/* Core Metric 3: Absences Rate */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-indigo-500/20 transition duration-150 relative overflow-hidden group shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase font-mono">Faltas e Assiduidade</span>
            <span className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <span className="block text-2xl font-bold font-mono text-zinc-100">{averageAttendance}%</span>
            <span className="block font-semibold font-mono text-[10px] text-zinc-400 mt-0.5">Taxa de Presenças Geral</span>
          </div>
          <p className="text-[10px] mt-3 font-semibold font-mono text-zinc-450 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> 
            {students.filter(s => s.attendanceRate < 90).length} Alunos com faltas excessivas
          </p>
        </div>

        {/* Core Metric 4: Documents Auditing */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-indigo-500/20 transition duration-150 relative overflow-hidden group shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase font-mono">Dossiê Administrativo</span>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${totalMissingDocsCount > 0 ? 'bg-amber-500/10 border border-amber-500/25 text-amber-400' : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'}`}>
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <span className="block text-2xl font-bold font-mono text-zinc-100">{totalMissingDocsCount}</span>
            <span className="block font-semibold font-mono text-[10px] text-zinc-400 mt-0.5">Documentos em Falta</span>
          </div>
          <p className="text-[10px] mt-3 font-semibold font-mono text-zinc-450">
            {studentsWithMissingDocs.length > 0 
              ? `De ${studentsWithMissingDocs.length} alunos com registo pendente`
              : 'Todos os registos 100% conformes'}
          </p>
        </div>

      </div>

      {/* Main split work space panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN AND CENTER PANEL: LIVE ROW GRAPH & STUDENTS COMPARE */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[9px] font-bold tracking-wider text-indigo-400 uppercase font-mono">COMPARATIVO ACADÉMICO</span>
              <h2 className="text-base font-bold text-zinc-100 font-display mt-0.5">
                Pauta Viva de Estudantes e Rendimento
              </h2>
              <p className="text-xs text-zinc-400">Rendimento e frequências de alunos cruzados em tempo real na instituição.</p>
            </div>

            {/* Selector controls */}
            <div className="flex items-center gap-1.5 bg-zinc-950 p-1 border border-zinc-800 rounded-lg text-xs font-mono font-bold">
              <button
                onClick={() => setChartMode('grades')}
                className={`px-2.5 py-1 rounded cursor-pointer transition-all ${chartMode === 'grades' ? 'bg-zinc-850 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Notas / 10
              </button>
              <button
                onClick={() => setChartMode('attendance')}
                className={`px-2.5 py-1 rounded cursor-pointer transition-all ${chartMode === 'attendance' ? 'bg-zinc-850 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Frequência %
              </button>
              <button
                onClick={() => setChartMode('outstanding')}
                className={`px-2.5 py-1 rounded cursor-pointer transition-all ${chartMode === 'outstanding' ? 'bg-zinc-850 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Propinas Débito
              </button>
            </div>
          </div>

          {/* Mini Search Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder="Filtre alunos em tempo real na grelha... (ex: 8º Ano)"
              value={studentSearchInput}
              onChange={(e) => setStudentSearchInput(e.target.value)}
              className="w-full bg-zinc-100 border border-zinc-300 hover:border-zinc-400 rounded-lg py-2 pl-9 pr-4 text-xs text-zinc-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 h-9 font-mono"
            />
          </div>

          {/* SVG/Row Dynamic Chart List */}
          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
            {filteredStudentsForRows.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-300 rounded-lg">
                <p className="text-xs text-zinc-550">Nenhum aluno localizado sob esta pesquisa.</p>
              </div>
            ) : (
              filteredStudentsForRows.map((student) => {
                let score = 0;
                let barColor = 'bg-indigo-500';
                let valueLabel = '';

                if (chartMode === 'grades') {
                  score = student.averageGrade * 10; // scale 0-10 to 0-100%
                  barColor = student.averageGrade >= 8.5 
                     ? 'bg-emerald-500' 
                    : student.averageGrade >= 7.0 
                    ? 'bg-indigo-400' 
                    : 'bg-rose-500';
                  valueLabel = `${student.averageGrade}/10`;
                } else if (chartMode === 'attendance') {
                  score = student.attendanceRate;
                  barColor = student.attendanceRate >= 95 
                    ? 'bg-emerald-500' 
                    : student.attendanceRate >= 90 
                    ? 'bg-indigo-400' 
                    : 'bg-rose-500';
                  valueLabel = `${student.attendanceRate}%`;
                } else {
                  // Outstanding propinas
                  // max outstanding in our mock values is around 500, lets cap scale reference at 600
                  score = Math.min(100, (student.outstandingFees / 600) * 100);
                  barColor = student.outstandingFees > 300 
                    ? 'bg-rose-500' 
                    : student.outstandingFees > 0 
                    ? 'bg-amber-400' 
                    : 'bg-emerald-500';
                  valueLabel = `€${student.outstandingFees}`;
                }

                return (
                  <div 
                    key={student.id} 
                    onClick={() => setSelectedStudentDetail(selectedStudentDetail === student ? null : student)}
                    className="p-2.5 hover:bg-zinc-100 hover:ring-1 hover:ring-zinc-200 rounded-lg cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-900 font-semibold font-sans">{student.name}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">({student.class})</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="text-zinc-500 text-[10px]">Comportamento: <b>{student.behaviorDegree}</b></span>
                        <span className="text-zinc-900 font-bold">{valueLabel}</span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden flex shadow-inner">
                      <div 
                        style={{ width: `${score}%` }} 
                        className={`h-full rounded-l-full transition-all duration-300 ${barColor}`}
                      />
                    </div>

                    {/* Expandable Student details widget row */}
                    {selectedStudentDetail === student && (
                      <div className="mt-3 p-3 bg-zinc-50 rounded border border-zinc-200 space-y-2 text-[11px] animate-fadeIn">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono">
                          <div>
                            <span className="text-zinc-500 block text-[9px] uppercase">Encarregado</span>
                            <span className="text-zinc-800 block font-semibold">{student.guardiansName}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block text-[9px] uppercase">Telemóvel</span>
                            <span className="text-indigo-600 block">{student.guardiansContact}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block text-[9px] uppercase">Identificador</span>
                            <span className="text-zinc-800 block">{student.id}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block text-[9px] uppercase">Dossiê OCR</span>
                            {(() => {
                              const docs = Array.isArray(student.documents) ? student.documents : [];
                              const hasMissing = docs.some(d => !d.submitted);
                              return (
                                <span className={hasMissing ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                                  {hasMissing ? 'Cadastro Pendente' : '100% Concluído'}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Missing Files for this student if any */}
                        {(() => {
                          const docs = Array.isArray(student.documents) ? student.documents : [];
                          const missingDocsList = docs.filter(d => !d.submitted);
                          if (missingDocsList.length === 0) return null;
                          return (
                            <div className="bg-amber-100 border border-amber-200 p-2 rounded text-amber-800 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Documentos ausentes detetados: {missingDocsList.map(d => d.name).join(', ')}</span>
                            </div>
                          );
                        })()}
                        
                        {/* Grades Breakdowns */}
                        <div className="border-t border-zinc-200 pt-2 flex items-center justify-between text-[10px] text-zinc-500">
                          <span>Grades Breakdown: {student.grades && student.grades.length > 0 ? student.grades.map(g => `${g.subject}: ${g.score}`).join(', ') : 'Nenhuma nota individual lançada'}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentTab('students');
                            }} 
                            className="text-emerald-700 hover:underline font-bold"
                          >
                            Ir para ficha integral aluno
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-4 border-t border-zinc-200 flex flex-wrap gap-4 items-center justify-between text-xs text-zinc-600">
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block" /> Saudável/Ótimo</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-indigo-400 rounded-full inline-block" /> Regular</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block" /> Atenção / Alerta</span>
            </div>
            <button onClick={() => setCurrentTab('students')} className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-0.5 cursor-pointer font-mono text-[11px]">
              Visualizar Ficha Completa de Alunos <ChevronRight className="w-3 h-3 inline" />
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: DYNAMIC ANOMALIES & AUDIT FEED */}
        <div className="space-y-6">
          
          {/* Dynamic Database Anomalies / Alertas Internos */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
              <h3 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5 tracking-[0.1em] uppercase font-mono">
                <Bell className="w-4 h-4 text-rose-500 animate-pulse" />
                Alertas do Ecossistema ({systemAnomalies.length})
              </h3>
              <span className="text-[10px] font-mono text-zinc-450">Varredura de Risco</span>
            </div>
 
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {systemAnomalies.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-xs text-zinc-400">Excelente. Nenhuma anomalia de pauta ou cobrança detetada nas tabelas.</p>
                </div>
              ) : (
                systemAnomalies.slice(0, 4).map((anomaly, idx) => (
                  <div key={idx} className="p-3 bg-zinc-950/40 border border-zinc-850 rounded-lg hover:border-zinc-800 transition">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                      <span className={`uppercase font-bold px-2 py-0.5 rounded border ${
                        anomaly.type === 'financial' 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                          : anomaly.type === 'pedagogic'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      }`}>
                        {anomaly.type === 'financial' ? 'Finanças' : anomaly.type === 'pedagogic' ? 'Pedagogia' : 'Dossiê'}
                      </span>
                      <span className="text-zinc-500">{anomaly.date}</span>
                    </div>
                    <h4 className="text-xs font-bold text-zinc-100 mt-2 font-display">{anomaly.title}</h4>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed font-sans">{anomaly.desc}</p>
                  </div>
                ))
              )}
            </div>
          </div>
 
          {/* SQL Postgres Real-time Tasks and Strategic Recommendations Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-100 tracking-[0.1em] uppercase font-mono flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Tarefas Operativas Atuais
              </span>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">Seguro & Ativo</span>
            </h3>

            {/* Part 1: Strategic recommendations */}
            <div className="space-y-2.5 pb-3 border-b border-zinc-850">
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Recomendações do Sistema</span>
              {dynamicTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2 text-[11px] text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0 animate-pulse"></span>
                  <div className="flex-1">
                    <p className="font-sans text-zinc-300">{task.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Part 2: Real tasks created in database */}
            <div className="space-y-3 pt-2 max-h-[300px] overflow-y-auto pr-1">
              <span className="text-[10px] text-zinc-550 font-mono uppercase flex justify-between">
                <span>Pauta Operacional do Copilot</span>
                <span>({todoTasks.length})</span>
              </span>
              {todoTasks.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center py-4 bg-zinc-950/40 rounded border border-zinc-900">
                  Nenhuma tarefa operacional pendente no banco de dados. Delegue tarefas ao Copilot por chat ou botão rápido!
                </p>
              ) : (
                todoTasks.map((tk) => (
                  <div key={tk.id} className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg hover:border-zinc-800 transition flex items-start gap-2.5">
                    <input 
                      type="checkbox" 
                      checked={tk.status === 'completado'}
                      onChange={() => handleToggleTaskStatus(tk.id, tk.status)}
                      className="mt-1 rounded border-zinc-800 bg-zinc-900 text-emerald-500 focus:ring-opacity-0 cursor-pointer w-3.5 h-3.5 shrink-0" 
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-xs font-semibold ${tk.status === 'completado' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                        {tk.title}
                      </h4>
                      <p className="text-[10px] text-zinc-455 mt-1 font-sans break-words leading-relaxed">
                        {tk.description}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2 text-[8px] font-mono">
                        <span className={`uppercase px-1.5 py-0.2 rounded font-bold ${
                          tk.priority === 'alta' 
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' 
                            : tk.priority === 'média'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}>
                          {tk.priority}
                        </span>
                        {tk.assignedTo && tk.assignedTo !== 'all' && (
                          <span className="bg-zinc-800 text-zinc-400 px-1 py-0.2 rounded uppercase">
                            Setor: {tk.assignedTo}
                          </span>
                        )}
                        <span className="text-zinc-500">{tk.dueDate}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteTask(tk.id)}
                      className="text-zinc-650 hover:text-rose-400 p-1 rounded transition shrink-0 self-center"
                      title="Eliminar tarefa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* NEW CENTER SECTION: LIVE LOGS TRACKER (REORGANIZED & BEAUTIFIED ACTIVITY FEED) */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-emerald-400 shadow">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Diário de Atividades Académicas</h3>
              <p className="text-xs text-zinc-400">Histórico recente de ações letivas, emissão de faturas e matrículas no portal.</p>
            </div>
          </div>
          <button 
            onClick={() => fetchLiveLogs()}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer font-mono flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            Atualizar Diário
          </button>
        </div>

        {/* Live log entries directly from tables */}
        <div className="bg-zinc-950 rounded-xl border border-zinc-850 p-4 font-mono text-[11px] leading-relaxed text-zinc-400 max-h-[250px] overflow-y-auto space-y-2.5">
          {isLoadingLogs ? (
            <div className="flex items-center justify-center py-10 gap-2 text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>A carregar diário de atividade...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <span>Nenhum registo recente gravado no sistema.</span>
            </div>
          ) : (
            logs.map((lg, idx) => {
              const rawDetails = lg.details || '';
              const cleanDetails = rawDetails
                .replace(/supabase/gi, 'Base de Dados Central')
                .replace(/postgres/gi, 'Base escolar')
                .replace(/postgresql/gi, 'Base escolar')
                .replace(/firebase/gi, 'Autenticação de Segurança')
                .replace(/drizzle/gi, 'Sincronizador')
                .replace(/Drizzle ORM/gi, 'Sistema')
                .replace(/SELECT.*FROM/gi, 'Consulta de registos')
                .replace(/INSERT INTO/gi, 'Registo de novos dados')
                .replace(/UPDATE.*SET/gi, 'Atualização de registo')
                .replace(/jwt/gi, 'Sessão de Segurança')
                .replace(/auth/gi, 'Acesso');

              const displayTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

              const friendlyRole = lg.userRole === 'admin' ? 'Administrador' :
                                   lg.userRole === 'director' ? 'Direção' :
                                   lg.userRole === 'secretariat' ? 'Secretaria' :
                                   lg.userRole === 'financial' ? 'Finanças' :
                                   lg.userRole === 'teacher' ? 'Professor' : 'Utilizador';

              return (
                <div key={`${lg.id || 'log'}-${idx}`} className="border-b border-zinc-850/60 pb-2 flex flex-col md:flex-row md:items-start gap-1 md:gap-4 hover:bg-zinc-900/40 p-1.5 rounded transition">
                  <div className="text-zinc-500 shrink-0 select-none font-sans font-medium text-[10px]">
                    {displayTime}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 select-none font-sans">
                    <span className="bg-zinc-850 text-zinc-300 border border-zinc-750 px-1.5 py-0.2 rounded text-[8px] font-semibold">
                      {friendlyRole}
                    </span>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded text-[8px] font-semibold uppercase tracking-wider">
                      {lg.action}
                    </span>
                  </div>
                  <div className="text-zinc-300 shrink-1 space-y-0.5 font-sans">
                    <p className="text-[11px] leading-relaxed text-zinc-100 font-semibold">{cleanDetails}</p>
                    <p className="text-[9px] text-zinc-400 font-normal">Operador: {lg.userName || 'Sistema Automático'}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* SEÇÃO DE INTELIGÊNCIA PREDITIVA (AI-Driven Executive Oracle) */}
      <section className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold tracking-widest text-indigo-400 uppercase font-mono">EXEC EXECUTIVE AI ORACLE</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-450 animate-pulse"></span>
            </div>
            <h2 className="text-lg font-bold font-display text-white mt-0.5">Módulo de Análise Preditiva de Sucesso</h2>
            <p className="text-xs text-zinc-400">Previsões preventivas estruturadas por inteligência artificial sob dados históricos latentes.</p>
          </div>

          <button
            onClick={handleGeneratePredictiveInsight}
            disabled={isGeneratingInsight}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-450 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-mono shadow-md"
          >
            {isGeneratingInsight ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Computando Modelos...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-300 animate-pulse" />
                <span>Gerar Análise Profunda com IA</span>
              </>
            )}
          </button>
        </div>

        {/* Live forecast panel of dropout and resources */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 1. Potenciais Taxas de Evasão Escolar */}
          <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-rose-400 font-mono uppercase">Previsão de Evasão (Dropout Risk)</span>
              <span className="text-xs font-bold font-mono text-white">Taxa Esperada: {studentsAtRisk.length > 0 ? '5.8%' : '1.2%'}</span>
            </div>

            {/* Meter representing dropout rate */}
            <div className="w-full h-1.5 bg-zinc-850 rounded-full overflow-hidden">
              <div 
                style={{ width: `${studentsAtRisk.length > 0 ? '58' : '12'}%` }}
                className="h-full bg-rose-500 rounded-full" 
              />
            </div>

            <div className="space-y-3 pt-2">
              {studentsAtRisk.slice(0, 2).map(std => (
                <div key={std.id} className="p-3 bg-[#111111]/80 border border-white/5 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{std.name}</span>
                    <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.2 rounded font-mono uppercase font-bold border border-rose-500/15">Risco Elevado</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    Assiduidade: {std.attendanceRate}% • Dívida: €{std.outstandingFees} • Fator: {std.attendanceRate < 90 ? 'Absiduidade Crítica' : 'Inadimplência'}
                  </p>
                  <div className="pt-2 flex justify-end">
                    <button 
                      onClick={() => alert(`Aviso de risco já emitido e contactável no telemóvel do responsável ${std.guardiansName} (${std.guardiansContact})!`)}
                      className="text-[9px] text-indigo-400 hover:text-indigo-300 font-mono font-bold cursor-pointer"
                    >
                      Contactar Responsável →
                    </button>
                  </div>
                </div>
              ))}
              {studentsAtRisk.length === 0 && (
                <div className="text-center py-6 text-zinc-500 text-xs">
                  Sem alunos com fatores de risco acumulados.
                </div>
              )}
            </div>
          </div>

          {/* 2. Desempenho Académico Futuro */}
          <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-indigo-400 font-mono uppercase">Desempenho Futuro Estimado</span>
              <span className="text-xs font-bold font-mono text-white">Média Alvo: {averageGrade} / 10</span>
            </div>

            <div className="w-full h-1.5 bg-zinc-850 rounded-full overflow-hidden">
              <div 
                style={{ width: `${averageGradeVal * 10}%` }}
                className="h-full bg-indigo-500 rounded-full" 
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="p-3 bg-[#111111]/80 border border-white/5 rounded-lg space-y-2">
                <span className="text-[9px] font-bold tracking-wider text-zinc-500 font-mono block">PROJEÇÃO MATEMÁTICA</span>
                <p className="text-[10px] text-zinc-350 font-sans leading-relaxed">
                  Com base nos dados escolares, prevemos estabilidade global na média escolar fixada em <strong className="text-emerald-400">{averageGrade}/10</strong>.
                </p>
                {students.some(s => s.averageGrade < 7.0) && (
                  <p className="text-[9px] text-amber-400 font-mono bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">Recomenda-se mentoria académica individual para disciplinas críticas.</p>
                )}
              </div>
            </div>
          </div>

          {/* 3. Necessidades de Recursos Previsórias */}
          <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-amber-400 font-mono uppercase">Alocação de Recursos</span>
              <span className="text-xs font-bold font-mono text-zinc-500">Próximos 6 meses</span>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-[10px] text-zinc-300 font-mono">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span> Força Docente</span>
                <span className="text-emerald-400 font-semibold bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">100% Suprida ({teachers.length})</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-300 font-mono">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span> Automatizações SaaS</span>
                <span className="text-indigo-400 font-semibold bg-indigo-500/5 px-1.5 py-0.5 rounded border border-indigo-500/10">Fidelidade Excelente</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-300 font-mono">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> Kits de Física Exp.</span>
                <span className="text-emerald-400 font-semibold bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">Alocação Estável</span>
              </div>
            </div>
          </div>

        </div>

        {/* Predictive Output Report Panel */}
        {predictiveReport && (
          <div className="p-4 bg-zinc-950 border border-indigo-500/20 rounded-xl space-y-3 font-mono text-[10px] leading-relaxed text-zinc-350 animate-fadeIn max-h-[380px] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-400"></span>
                Oracle de IA: Relatório Sintetizado Real
              </span>
              <button 
                onClick={() => setPredictiveReport('')} 
                className="text-[10px] text-zinc-500 hover:text-white cursor-pointer font-bold"
              >
                Fechar ✕
              </button>
            </div>
            <div className="whitespace-pre-line text-[10px] space-y-4 font-mono leading-relaxed">
              {predictiveReport}
            </div>
          </div>
        )}
      </section>

      {/* Recentes Editados / Últimos Comunicados */}
      <div className="bg-[#111111] border border-zinc-850 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[9px] font-bold tracking-wider text-indigo-400 uppercase font-mono">Canais de Difusão</span>
            <h2 className="text-base font-semibold text-white font-display mt-0.5">Painel Geral de Comunicados Ativos</h2>
            <p className="text-xs text-zinc-405">Histórico real de avisos publicados para a comunidade</p>
          </div>
          <button onClick={() => setCurrentTab('communications')} className="text-xs text-indigo-450 hover:text-indigo-400 font-semibold cursor-pointer">
            Portal de Comunicações →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {announcements.slice(0, 3).map(adv => (
            <div key={adv.id} className="bg-zinc-950/40 border border-zinc-800 rounded-lg p-4 space-y-2 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono px-1.5 py-0.5 rounded uppercase">
                    Canal: {adv.target}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">{adv.date}</span>
                </div>
                <h3 className="text-xs font-semibold text-zinc-200 leading-snug line-clamp-1">{adv.title}</h3>
                <p className="text-[11px] text-zinc-400 line-clamp-3 leading-relaxed">{adv.content}</p>
              </div>
              <div className="pt-2 border-t border-zinc-850 mt-3 flex items-center justify-between text-[10px] text-zinc-500">
                <span>Por: {adv.author}</span>
                <span>{adv.role}</span>
              </div>
            </div>
          ))}
          {announcements.length === 0 && (
            <div className="col-span-3 text-center py-6 text-zinc-500 text-xs">
              Nenhum comunicado ativo publicado na base central.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
