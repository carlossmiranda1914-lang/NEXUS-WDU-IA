import React, { useState, memo, useMemo } from 'react';
import { 
  Users, AlertTriangle, Clock, TrendingUp, DollarSign, FileText, CheckCircle2, 
  Search, ShieldAlert, ClipboardCheck, ArrowUpRight, BarChart4, Mail, Phone, BookOpen, AlertCircle
} from 'lucide-react';
import { Student, Teacher, Invoice, ApprovalRequest, DigitalSignatureRequest, UserRole } from '../../../types';

interface RoleWidgetsProps {
  currentUserRole: UserRole;
  students: Student[];
  teachers: Teacher[];
  invoices: Invoice[];
  approvals: ApprovalRequest[];
  signatures: DigitalSignatureRequest[];
  setCurrentTab: (tab: string) => void;
  theme: string;
}

function RoleWidgets({
  currentUserRole,
  students,
  teachers,
  invoices,
  approvals,
  signatures,
  setCurrentTab,
  theme
}: RoleWidgetsProps) {
  const isLight = theme === 'light';

  // State for search and filter within Professor/Teacher widget
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [chartMode, setChartMode] = useState<'grades' | 'attendance' | 'outstanding'>('grades');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // --- COMPUTE SYSTEM ANOMALIES FOR ADMIN / GLOBAL SCAN ---
  const systemAnomalies = useMemo(() => {
    const anomalies: { id: string; type: 'financial' | 'pedagogic' | 'doc'; title: string; desc: string; studentName?: string; class?: string }[] = [];
    students.forEach(s => {
      if (s.attendanceRate < 90) {
        anomalies.push({
          id: `anomaly-att-${s.id}`,
          type: 'pedagogic',
          title: 'Faltas Excessivas',
          desc: `${s.name} (${s.class}) ultrapassou o limite legal. Assiduidade de ${s.attendanceRate}%.`,
          studentName: s.name,
          class: s.class
        });
      }
      if (s.averageGrade < 7.0) {
        anomalies.push({
          id: `anomaly-grd-${s.id}`,
          type: 'pedagogic',
          title: 'Risco de Reprovação',
          desc: `${s.name} (${s.class}) registou média geral de ${s.averageGrade}/10, abaixo da meta escolar.`,
          studentName: s.name,
          class: s.class
        });
      }
      if (s.documents) {
        const missing = s.documents.filter(d => !d.submitted).map(d => d.name);
        if (missing.length > 0) {
          anomalies.push({
            id: `anomaly-doc-${s.id}`,
            type: 'doc',
            title: 'Documentação Omitida',
            desc: `${s.name} não submeteu: ${missing.join(', ')}. CC/Matrículas em falha.`,
            studentName: s.name,
            class: s.class
          });
        }
      }
    });

    invoices.forEach(i => {
      if (i.status === 'overdue') {
        anomalies.push({
          id: `anomaly-inv-${i.id}`,
          type: 'financial',
          title: 'Mensalidade Vencida',
          desc: `Fatura de €${i.amount} referente ao aluno ${i.studentName} em atraso crónico.`,
          studentName: i.studentName
        });
      }
    });
    return anomalies;
  }, [students, invoices]);

  // --- COMPUTE GLOBAL METRICS ---
  const globalMetrics = useMemo(() => {
    const total = students.length;
    const active = students.filter(s => s.status === 'active').length;
    
    const expected = invoices.reduce((acc, i) => acc + i.amount, 0);
    const realized = invoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.amount, 0);
    const pending = invoices.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.amount, 0);
    const overdue = invoices.filter(i => i.status === 'overdue').reduce((acc, i) => acc + i.amount, 0);
    const fidelityPct = expected > 0 ? Math.round((realized / expected) * 100) : 0;

    const avgGradeVal = total > 0 ? students.reduce((acc, s) => acc + s.averageGrade, 0) / total : 0;
    const avgAttendance = total > 0 ? Math.round(students.reduce((acc, s) => acc + s.attendanceRate, 0) / total) : 100;

    const atRisk = students.filter(s => s.averageGrade < 7.0 || s.attendanceRate < 90);

    return {
      total,
      active,
      expected,
      realized,
      pending,
      overdue,
      fidelityPct,
      avgGrade: avgGradeVal.toFixed(2),
      avgGradeRaw: avgGradeVal,
      avgAttendance,
      atRisk
    };
  }, [students, invoices]);

  const totalStudents = globalMetrics.total;
  const activeStudents = globalMetrics.active;
  const expectedTotalBillings = globalMetrics.expected;
  const realizedRevenue = globalMetrics.realized;
  const pendingRevenue = globalMetrics.pending;
  const overdueRevenue = globalMetrics.overdue;
  const financialFidelityPct = globalMetrics.fidelityPct;
  const averageGrade = globalMetrics.avgGrade;
  const averageGradeVal = globalMetrics.avgGradeRaw;
  const averageAttendance = globalMetrics.avgAttendance;
  const studentsAtRisk = globalMetrics.atRisk;

  // Memoized listings for specific roles
  const pendingRequests = useMemo(() => 
    approvals.filter(a => a.status === 'pending' || a.status === 'analyzing'),
    [approvals]
  );

  const studentsWithMissingDocs = useMemo(() => 
    students.filter(s => s.documents && s.documents.some(d => !d.submitted)),
    [students]
  );

  const activeSignatures = useMemo(() => 
    signatures.filter(s => s.status === 'sent'),
    [signatures]
  );

  const lowGradeCount = useMemo(() => 
    students.filter(s => s.averageGrade < 7.0).length,
    [students]
  );

  const filteredStudents = useMemo(() => 
    students.filter(s => 
      s.name.toLowerCase().includes(studentSearchInput.toLowerCase()) ||
      s.class.toLowerCase().includes(studentSearchInput.toLowerCase())
    ),
    [students, studentSearchInput]
  );

  const overdueInvoices = useMemo(() => 
    invoices.filter(i => i.status === 'overdue'),
    [invoices]
  );

  // WIDGET 1: ADMINISTRADOR
  if (currentUserRole === 'admin') {
    return (
      <div id="role_widget_admin" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Administrative Stats */}
        <div className={`p-6 rounded-2xl border lg:col-span-1 flex flex-col justify-between ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
        }`}>
          <div>
            <h3 className={`text-sm font-bold font-display flex items-center gap-2 mb-2 ${isLight ? 'text-zinc-900' : 'text-zinc-150'}`}>
              <Users className="w-4 h-4 text-emerald-500" />
              Métricas Operativas Gerais
            </h3>
            <p className={`text-[11px] mb-4 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Varredura estrita da base de dados escolar central.
            </p>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50 pb-2">
                <span className="text-xs text-zinc-500 font-medium">Estudantes Ativos / Totais</span>
                <span className={`text-xs font-bold font-mono ${isLight ? 'text-zinc-850' : 'text-zinc-200'}`}>{activeStudents} / {totalStudents}</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50 pb-2">
                <span className="text-xs text-zinc-500 font-medium">Corpo Docente Ativo</span>
                <span className={`text-xs font-bold font-mono ${isLight ? 'text-zinc-850' : 'text-zinc-200'}`}>{teachers.length} Professores</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50 pb-2">
                <span className="text-xs text-zinc-500 font-medium">Assinaturas do Período</span>
                <span className={`text-xs font-bold font-mono ${isLight ? 'text-zinc-850' : 'text-zinc-200'}`}>{signatures.length} Enviadas</span>
              </div>
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs text-zinc-500 font-medium">Pedidos de Aprovação</span>
                <span className={`text-xs font-bold font-mono ${isLight ? 'text-zinc-850' : 'text-zinc-200'}`}>{approvals.length} Totais</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setCurrentTab('config')}
            className={`w-full mt-6 py-2 rounded-xl text-xs font-bold text-center cursor-pointer border ${
              isLight ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-350 text-zinc-800' : 'bg-zinc-950/80 border-zinc-850 hover:bg-zinc-950 hover:border-zinc-800 text-zinc-250'
            }`}
          >
            Aceder a Definições do Sistema
          </button>
        </div>

        {/* Global Risks and Database Anomalies */}
        <div className={`p-6 rounded-2xl border lg:col-span-2 space-y-4 flex flex-col justify-between ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
        }`}>
          <div>
            <h3 className={`text-sm font-bold font-display flex items-center gap-2 ${isLight ? 'text-zinc-900' : 'text-zinc-150'}`}>
              <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
              Relatório Automático de Auditoria do Sistema
            </h3>
            <p className={`text-[11px] ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Riscos ativos e anomalias de conformidade de pauta/faturação em tempo real.
            </p>
          </div>

          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {systemAnomalies.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs text-zinc-500 font-medium">Varredura limpa. Zero anomalias estruturais.</p>
              </div>
            ) : (
              systemAnomalies.slice(0, 3).map((anom, idx) => (
                <div key={idx} className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                  isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-zinc-850'
                }`}>
                  <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                    anom.type === 'financial' ? 'text-rose-500' : anom.type === 'pedagogic' ? 'text-amber-500' : 'text-indigo-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-bold tracking-wider font-mono uppercase ${
                        anom.type === 'financial' ? 'text-rose-500' : anom.type === 'pedagogic' ? 'text-amber-500' : 'text-indigo-400'
                      }`}>
                        {anom.type}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-mono">Crítico</span>
                    </div>
                    <h4 className={`text-xs font-bold font-display mt-0.5 ${isLight ? 'text-zinc-850' : 'text-zinc-200'}`}>{anom.title}</h4>
                    <p className={`text-[10px] leading-relaxed truncate ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>{anom.desc}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-[11px] font-semibold text-indigo-500 dark:text-indigo-400 font-mono">
            <span>Varredura de integridade operacional estrita</span>
            <span>Total: {systemAnomalies.length} anomalias</span>
          </div>
        </div>
      </div>
    );
  }

  // WIDGET 2: DIRETOR
  if (currentUserRole === 'director') {
    return (
      <div id="role_widget_director" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Academic KPIs and Projections */}
        <div className={`p-6 rounded-2xl border lg:col-span-1 flex flex-col justify-between ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
        }`}>
          <div>
            <h3 className={`text-sm font-bold font-display flex items-center gap-2 mb-2 ${isLight ? 'text-zinc-900' : 'text-zinc-150'}`}>
              <BarChart4 className="w-4 h-4 text-emerald-500" />
              Cockpit Estratégico de Performance
            </h3>
            <p className={`text-[11px] mb-4 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Aproveitamento global da instituição.
            </p>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-500 font-medium">Média Académica Geral</span>
                  <span className={`font-mono font-bold ${isLight ? 'text-zinc-800' : 'text-white'}`}>{averageGrade} / 10</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-850 h-1.5 rounded-full overflow-hidden">
                  <div style={{ width: `${averageGradeVal * 10}%` }} className="h-full bg-emerald-500 rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-500 font-medium">Rácio de Frequência / Presença</span>
                  <span className={`font-mono font-bold ${isLight ? 'text-zinc-800' : 'text-white'}`}>{averageAttendance}%</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-850 h-1.5 rounded-full overflow-hidden">
                  <div style={{ width: `${averageAttendance}%` }} className="h-full bg-indigo-500 rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-550 font-medium">Estudantes Vulneráveis (Risco)</span>
                  <span className="font-mono font-bold text-rose-500">{studentsAtRisk.length} Alunos</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-850 h-1.5 rounded-full overflow-hidden">
                  <div style={{ width: `${(studentsAtRisk.length / (totalStudents || 1)) * 100}%` }} className="h-full bg-rose-500 rounded-full" />
                </div>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setCurrentTab('workflows')}
            className={`w-full mt-4 py-2 rounded-xl text-xs font-bold text-center cursor-pointer border ${
              isLight ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-350 text-zinc-800' : 'bg-zinc-950/80 border-zinc-850 hover:bg-zinc-950 hover:border-zinc-800 text-zinc-250'
            }`}
          >
            Aceder ao Central de Workflows
          </button>
        </div>

        {/* Approvals required */}
        <div className={`p-6 rounded-2xl border lg:col-span-2 space-y-4 flex flex-col justify-between ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
        }`}>
          <div>
            <h3 className={`text-sm font-bold font-display flex items-center gap-2 ${isLight ? 'text-zinc-900' : 'text-zinc-150'}`}>
              <ClipboardCheck className="w-4 h-4 text-indigo-400" />
              Pareceres e Autorizações da Direção Geral
            </h3>
            <p className={`text-[11px] ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Fluxogramas críticos e requisições pendentes de decisão superior direta.
            </p>
          </div>

          <div className="space-y-2 max-h-[165px] overflow-y-auto pr-1">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-85" />
                <p className="text-xs text-zinc-550 font-medium">Tudo homologado! Nenhuma decisão pendente no momento.</p>
              </div>
            ) : (
              pendingRequests.slice(0, 3).map((req) => (
                <div key={req.id} className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                  isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-zinc-850'
                }`}>
                  <div className="min-w-0">
                    <span className="text-[8px] font-bold tracking-wider font-mono text-indigo-400 uppercase bg-indigo-500/5 border border-indigo-500/10 px-1.5 py-0.2 rounded">
                      {req.flowType.replace(/_/g, ' ')}
                    </span>
                    <h4 className={`text-xs font-bold font-display mt-1 truncate ${isLight ? 'text-zinc-850' : 'text-zinc-200'}`}>{req.title}</h4>
                    <p className={`text-[10px] leading-relaxed truncate ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>{req.description}</p>
                  </div>
                  <button 
                    onClick={() => setCurrentTab('approvals')}
                    className="text-[10px] bg-indigo-500 hover:bg-indigo-400 text-white font-semibold font-mono px-2.5 py-1.5 rounded-lg shrink-0"
                  >
                    Decidir →
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-[10px] font-mono text-zinc-400">
            <span>Aprovações e Portais de Transição de Estado</span>
            <span>Total pendentes: {pendingRequests.length} de {approvals.length} total</span>
          </div>
        </div>
      </div>
    );
  }

  // WIDGET 3: SECRETARIA
  if (currentUserRole === 'secretariat') {
    return (
      <div id="role_widget_secretariat" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Matriculas & Document stats */}
        <div className={`p-6 rounded-2xl border lg:col-span-1 flex flex-col justify-between ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
        }`}>
          <div>
            <h3 className={`text-sm font-bold font-display flex items-center gap-2 mb-2 ${isLight ? 'text-zinc-900' : 'text-zinc-150'}`}>
              <FileText className="w-4 h-4 text-emerald-500" />
              Gestão de Matrículas e Assinaturas
            </h3>
            <p className={`text-[11px] mb-4 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Fluxos de conformidade e contratação activa.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-2.5">
                <span className="text-xs text-zinc-550">Matrículas Incompletas</span>
                <span className="text-xs font-mono font-bold text-amber-500">{studentsWithMissingDocs.length} Alunos</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-2.5">
                <span className="text-xs text-zinc-550">Assinaturas Pendentes</span>
                <span className="text-xs font-mono font-bold text-purple-500">{activeSignatures.length} Contratos</span>
              </div>
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs text-zinc-555">Dossiês Conformes</span>
                <span className="text-xs font-mono font-bold text-emerald-500">
                  {totalStudents - studentsWithMissingDocs.length} de {totalStudents} ({totalStudents > 0 ? Math.round(((totalStudents - studentsWithMissingDocs.length) / totalStudents) * 100) : 100}%)
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setCurrentTab('documents')}
            className={`w-full mt-4 py-2 rounded-xl text-xs font-bold text-center cursor-pointer border ${
              isLight ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-350 text-zinc-800' : 'bg-zinc-950/80 border-zinc-850 hover:bg-zinc-950 hover:border-zinc-800 text-zinc-250'
            }`}
          >
            Abrir Gestor Documental OCR
          </button>
        </div>

        {/* Missing docs action list */}
        <div className={`p-6 rounded-2xl border lg:col-span-2 space-y-4 flex flex-col justify-between ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
        }`}>
          <div>
            <h3 className={`text-sm font-bold font-display flex items-center gap-2 ${isLight ? 'text-zinc-900' : 'text-zinc-150'}`}>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Alunos com Processos Administrativos Pendentes
            </h3>
            <p className={`text-[11px] ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Fichas com falta de CC, histórico escolar, boletim de vacinas ou termos oficiais de matrícula.
            </p>
          </div>

          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {studentsWithMissingDocs.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs text-zinc-500">Todos os alunos com documentação 100% arquivada.</p>
              </div>
            ) : (
              studentsWithMissingDocs.slice(0, 3).map((std) => {
                const missing = std.documents.filter(d => !d.submitted).map(d => d.name);
                return (
                  <div key={std.id} className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                    isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-zinc-850'
                  }`}>
                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold font-display truncate ${isLight ? 'text-zinc-850' : 'text-zinc-200'}`}>{std.name} ({std.class})</h4>
                      <p className="text-[10px] text-amber-500 font-mono font-medium mt-1">Falta: {missing.join(', ')}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <a href={`tel:${std.guardiansContact}`} className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500/20" title="Ligar">
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                      <button 
                        onClick={() => setCurrentTab('students')}
                        className="text-[10px] bg-zinc-800 dark:bg-zinc-950 text-zinc-300 dark:text-zinc-400 hover:text-white border border-zinc-700 dark:border-zinc-850 px-2.5 py-1.5 rounded-lg font-mono font-bold"
                      >
                        Ficha →
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-[10px] font-mono text-zinc-400">
            <span>Para regularizar, submeta arquivos ou instigue Encarregados via portal</span>
            <span>Total incompletos: {studentsWithMissingDocs.length} de {totalStudents}</span>
          </div>
        </div>
      </div>
    );
  }

  // WIDGET 4: PROFESSOR
  if (currentUserRole === 'teacher') {
    return (
      <div id="role_widget_teacher" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class overview and failures risk */}
        <div className={`p-6 rounded-2xl border lg:col-span-1 flex flex-col justify-between ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
        }`}>
          <div>
            <h3 className={`text-sm font-bold font-display flex items-center gap-2 mb-2 ${isLight ? 'text-zinc-900' : 'text-zinc-150'}`}>
              <BookOpen className="w-4 h-4 text-emerald-500" />
              Diário Docente de Turma
            </h3>
            <p className={`text-[11px] mb-4 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Acompanhamento de pauta e avaliações.
            </p>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-850 pb-2">
                <span className="text-xs text-zinc-550">Média Geral Académica</span>
                <span className={`text-xs font-bold font-mono ${isLight ? 'text-zinc-850' : 'text-zinc-200'}`}>{averageGrade} / 10</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-850 pb-2">
                <span className="text-xs text-zinc-550">Taxa de Assiduidade</span>
                <span className={`text-xs font-bold font-mono ${isLight ? 'text-zinc-850' : 'text-zinc-200'}`}>{averageAttendance}%</span>
              </div>
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs text-zinc-550">Risco de Reprovação</span>
                <span className="text-xs font-bold font-mono text-rose-500">{lowGradeCount} Alunos</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setCurrentTab('students')}
            className={`w-full mt-4 py-2 rounded-xl text-xs font-bold text-center cursor-pointer border ${
              isLight ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-350 text-zinc-800' : 'bg-zinc-950/80 border-zinc-850 hover:bg-zinc-950 hover:border-zinc-800 text-zinc-250'
            }`}
          >
            Lançar Notas & Faltas Completas
          </button>
        </div>

        {/* Real-time Student performance comparative rows */}
        <div className={`p-6 rounded-2xl border lg:col-span-2 space-y-4 flex flex-col justify-between ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/50 dark:border-zinc-800/50 pb-2">
            <div>
              <h3 className={`text-sm font-bold font-display flex items-center gap-2 ${isLight ? 'text-zinc-900' : 'text-zinc-150'}`}>
                <BarChart4 className="w-4 h-4 text-indigo-400" />
                Grelha de Rendimento Escolar Cruzado
              </h3>
            </div>
            
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 p-0.5 border border-zinc-200 dark:border-zinc-850 rounded-lg text-[10px] font-mono font-bold">
              <button onClick={() => setChartMode('grades')} className={`px-2 py-0.5 rounded cursor-pointer ${chartMode === 'grades' ? 'bg-white dark:bg-zinc-850 text-emerald-500' : 'text-zinc-500'}`}>Notas</button>
              <button onClick={() => setChartMode('attendance')} className={`px-2 py-0.5 rounded cursor-pointer ${chartMode === 'attendance' ? 'bg-white dark:bg-zinc-850 text-emerald-500' : 'text-zinc-500'}`}>Faltas</button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Filtre alunos... (ex: 7º Ano)" 
              value={studentSearchInput}
              onChange={(e) => setStudentSearchInput(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-850 hover:border-zinc-350 rounded-lg py-1 pl-8 pr-3 text-[11px] text-zinc-850 dark:text-zinc-200 outline-none h-7 font-mono"
            />
          </div>

          <div className="space-y-2.5 max-h-[140px] overflow-y-auto pr-1">
            {filteredStudents.slice(0, 4).map((student) => {
              let score = 0;
              let valueLabel = '';
              let barColor = 'bg-indigo-500';

              if (chartMode === 'grades') {
                score = student.averageGrade * 10;
                barColor = student.averageGrade >= 8.5 ? 'bg-emerald-500' : student.averageGrade >= 7.0 ? 'bg-indigo-400' : 'bg-rose-500';
                valueLabel = `${student.averageGrade}/10`;
              } else {
                score = student.attendanceRate;
                barColor = student.attendanceRate >= 95 ? 'bg-emerald-500' : student.attendanceRate >= 90 ? 'bg-indigo-400' : 'bg-rose-500';
                valueLabel = `${student.attendanceRate}%`;
              }

              return (
                <div key={student.id} className="text-[11px]">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className={`font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>{student.name} ({student.class})</span>
                    <span className={`font-mono font-bold ${isLight ? 'text-zinc-900' : 'text-white'}`}>{valueLabel}</span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                    <div style={{ width: `${score}%` }} className={`h-full rounded-full transition-all duration-300 ${barColor}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // WIDGET 5: FINANCEIRO
  if (currentUserRole === 'financial') {
    return (
      <div id="role_widget_financial" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expected/Collected metrics and bar */}
        <div className={`p-6 rounded-2xl border lg:col-span-1 flex flex-col justify-between ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
        }`}>
          <div>
            <h3 className={`text-sm font-bold font-display flex items-center gap-2 mb-2 ${isLight ? 'text-zinc-900' : 'text-zinc-150'}`}>
              <DollarSign className="w-4 h-4 text-emerald-500" />
              Balanço de Cobranças Ativas
            </h3>
            <p className={`text-[11px] mb-4 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Acompanhamento de liquidez da instituição.
            </p>
            <div className="space-y-4">
              <div>
                <span className="block text-2xl font-bold font-mono text-emerald-500">€{realizedRevenue}</span>
                <span className="text-[10px] text-zinc-500 block font-semibold font-mono">Realizado (Pago) de €{expectedTotalBillings} previsto</span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-950 h-2 rounded-full overflow-hidden">
                <div style={{ width: `${financialFidelityPct}%` }} className="h-full bg-emerald-500 rounded-full" />
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-emerald-500 font-bold">{financialFidelityPct}% Líquido Pago</span>
                <span className="text-rose-500 font-bold">€{overdueRevenue} Em Mora</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setCurrentTab('financials')}
            className={`w-full mt-4 py-2 rounded-xl text-xs font-bold text-center cursor-pointer border ${
              isLight ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-350 text-zinc-800' : 'bg-zinc-950/80 border-zinc-850 hover:bg-zinc-950 hover:border-zinc-800 text-zinc-250'
            }`}
          >
            Emitir Faturas / Relatórios
          </button>
        </div>

        {/* Overdue invoices list */}
        <div className={`p-6 rounded-2xl border lg:col-span-2 space-y-4 flex flex-col justify-between ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
        }`}>
          <div>
            <h3 className={`text-sm font-bold font-display flex items-center gap-2 ${isLight ? 'text-zinc-900' : 'text-zinc-150'}`}>
              <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
              Inadimplência Crónica (Overdue)
            </h3>
            <p className={`text-[11px] ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Mensalidades escolares em atraso aguardando notificação de cobrança ou liquidação.
            </p>
          </div>

          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {overdueInvoices.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs text-zinc-500">Parabéns! Zero faturas em atraso no sistema.</p>
              </div>
            ) : (
              overdueInvoices.slice(0, 3).map((inv) => (
                <div key={inv.id} className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                  isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-zinc-850'
                }`}>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-bold font-display truncate ${isLight ? 'text-zinc-850' : 'text-zinc-200'}`}>{inv.studentName}</h4>
                    <p className="text-[10px] text-zinc-500 font-mono">Fatura: #{inv.id} • Vencimento: {inv.dueDate}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold font-mono text-rose-500">€{inv.amount}</span>
                    <button 
                      onClick={() => setCurrentTab('financials')}
                      className="text-[10px] bg-indigo-500 hover:bg-indigo-400 text-white font-semibold font-mono px-2 py-1 rounded-md"
                    >
                      Cobrar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-[10px] font-mono text-zinc-400">
            <span>Envie notificações de SMS/WhatsApp automatizadas pelo portal de cobrança</span>
            <span>Total atrasadas: {overdueInvoices.length} de {invoices.length} total</span>
          </div>
        </div>
      </div>
    );
  }

  // WIDGET 6: ENCARREGADO / DEFAULT USER
  return (
    <div 
      id="role_widget_guardian"
      className={`p-6 rounded-2xl border ${
        isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4.5 h-4.5 text-indigo-400" />
        <h3 className={`text-base font-bold font-display ${isLight ? 'text-zinc-900' : 'text-white'}`}>
          Espaço do Aluno & Encarregado de Educação
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
            Bem-vindo ao Portal de Acompanhamento Escolar. Aqui poderá monitorizar notas, relatórios de assiduidade diária, faturas emitidas e comunicados institucionais.
          </p>
          <div className="space-y-3 font-sans">
            <div className="flex justify-between text-xs border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <span className="text-zinc-500 font-medium">Turmas / Educando</span>
              <span className={`font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>Estudante Ativo</span>
            </div>
            <div className="flex justify-between text-xs border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <span className="text-zinc-500 font-medium">Assiduidade do Período</span>
              <span className={`font-mono font-bold text-emerald-500`}>Excelente</span>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Pendências</span>
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-zinc-850'
          }`}>
            <div className="space-y-1">
              <h4 className={`text-xs font-bold font-display ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>Termos & Assinaturas</h4>
              <p className={`text-[10px] ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>Assine os documentos em falta para garantir a matrícula.</p>
            </div>
            <button 
              onClick={() => setCurrentTab('signatures')}
              className="text-[10px] bg-indigo-500 hover:bg-indigo-400 text-white font-mono font-bold px-2.5 py-1.5 rounded-lg text-center"
            >
              Assinar →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(RoleWidgets);
