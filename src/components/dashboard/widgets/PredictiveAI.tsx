import React, { useState, memo, useMemo } from 'react';
import { 
  Sparkles, Loader2, TrendingUp, AlertTriangle, Cpu, HelpCircle, CheckCircle2, ChevronDown, ChevronUp, AlertCircle, Users, Settings, Database
} from 'lucide-react';
import { Student, Teacher } from '../../../types';
import { getHeaders } from '../../../supabaseClient';

interface PredictiveAIProps {
  students: Student[];
  teachers?: Teacher[];
  averageGrade: string;
  averageAttendance: number;
  theme: string;
}

function PredictiveAI({
  students = [],
  teachers = [],
  averageGrade,
  averageAttendance,
  theme
}: PredictiveAIProps) {
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [predictiveReport, setPredictiveReport] = useState('');
  const [showFullReport, setShowFullReport] = useState(true);

  const isLight = theme === 'light';

  // Check if we have enough students to build a proper predictive model
  const hasEnoughData = students.length >= 3;

  // Real-time evaluation of students at risk based on exact grade (< 5.0) and attendance (< 75%)
  const studentsAtRisk = useMemo(() => 
    students.filter(s => s.averageGrade < 5.0 || s.attendanceRate < 75),
    [students]
  );

  // Math calculated dropout metrics - 100% real and derived from existing data
  const dropoutInfo = useMemo(() => {
    if (students.length === 0) {
      return { rate: '0.0%', width: '0%' };
    }
    const pct = (studentsAtRisk.length / students.length) * 100;
    return {
      rate: `${pct.toFixed(1)}%`,
      width: `${pct.toFixed(0)}%`
    };
  }, [students, studentsAtRisk]);

  const dropoutRate = dropoutInfo.rate;
  const dropoutWidth = dropoutInfo.width;

  // Academic trend interpretation based on actual average grade
  const academicTrend = useMemo(() => {
    if (students.length === 0) {
      return { 
        label: 'Dados Insuficientes', 
        color: 'text-zinc-500', 
        desc: 'Não existem notas reais lançadas na pauta para calcular tendências.' 
      };
    }
    const avg = parseFloat(averageGrade);
    if (avg >= 7.5) {
      return {
        label: 'Tendência Ascendente (Aproveitamento Alto)',
        color: 'text-emerald-400',
        desc: `A média global de ${avg.toFixed(1)}/10 indica estabilidade escolar em níveis elevados de assimilação de conteúdo.`
      };
    } else if (avg >= 5.0) {
      return {
        label: 'Tendência Estável (Aproveitamento Médio)',
        color: 'text-indigo-400',
        desc: `A média global de ${avg.toFixed(1)}/10 indica estabilização padrão. Recomenda-se acompanhamento preventivo.`
      };
    } else {
      return {
        label: 'Tendência Descendente (Risco Crítico)',
        color: 'text-rose-400',
        desc: `A média global real de ${avg.toFixed(1)}/10 está abaixo do limite de suficiência pedagógica. Atenção urgente!`
      };
    }
  }, [students, averageGrade]);

  // Dynamic resources evaluation based on active teachers, unique classes and total students
  const resourcesInfo = useMemo(() => {
    const activeTeachers = teachers.filter(t => t.status === 'active').length;
    const uniqueClasses = new Set(students.map(s => s.class)).size;
    
    // 1. Teacher-student ratio
    let teacherStatus = 'Excelente Cobertura';
    let teacherColor = 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10';
    if (activeTeachers === 0) {
      teacherStatus = 'Sem Docentes Ativos';
      teacherColor = 'text-rose-400 bg-rose-500/5 border-rose-500/10 animate-pulse';
    } else {
      const ratio = students.length / activeTeachers;
      if (ratio > 15) {
        teacherStatus = `Rácio Alto: ${ratio.toFixed(1)} Alunos/Prof`;
        teacherColor = 'text-amber-400 bg-amber-500/5 border-amber-500/10';
      } else {
        teacherStatus = `Rácio Ideal: ${ratio.toFixed(1)} Alunos/Prof`;
      }
    }

    // 2. Class sizing
    let classStatus = 'Salas Estáveis';
    let classColor = 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10';
    if (uniqueClasses === 0) {
      classStatus = 'Sem Turmas';
      classColor = 'text-zinc-500 bg-zinc-500/5 border-zinc-500/10';
    } else {
      const sizing = students.length / uniqueClasses;
      if (sizing > 25) {
        classStatus = `Densa: Média ${sizing.toFixed(1)} Alunos`;
        classColor = 'text-amber-400 bg-amber-500/5 border-amber-500/10';
      } else {
        classStatus = `Adequada: ${sizing.toFixed(1)} Alunos/Sala`;
      }
    }

    // 3. Digital Infrastructure demand
    let infraStatus = 'Plano Regular Adequado';
    let infraColor = 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10';
    const totalUsers = students.length + teachers.length;
    if (totalUsers > 50) {
      infraStatus = 'Atenção: Recomenda-se plano SaaS Pro';
      infraColor = 'text-indigo-400 bg-indigo-500/5 border-indigo-500/10';
    } else if (totalUsers === 0) {
      infraStatus = 'Sem Tráfego Ativo';
      infraColor = 'text-zinc-500 bg-zinc-500/5 border-zinc-500/10';
    }

    return {
      teacherStatus,
      teacherColor,
      classStatus,
      classColor,
      infraStatus,
      infraColor
    };
  }, [students, teachers]);

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
        setPredictiveReport(`Erro ao gerar previsão do oráculo de IA: ${data.error}`);
      } else {
        setPredictiveReport(data.result);
        setShowFullReport(true);
      }
    } catch (err: any) {
      console.error(err);
      setPredictiveReport(`Incidência operacional de rede: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  return (
    <section 
      id="dashboard_predictive_ai_section"
      className={`p-6 rounded-2xl border ${
        isLight ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-[#111111] border-white/5 text-zinc-350 shadow-xl'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold tracking-widest text-indigo-400 uppercase font-mono">Executive AI Oracle</span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
          </div>
          <h2 className="text-lg font-bold font-display text-white mt-0.5">Módulo de Análise Preditiva de Sucesso</h2>
          <p className="text-xs text-zinc-450 mt-0.5">Previsões preventivas e análise de recursos estritamente baseadas em dados históricos reais.</p>
        </div>

        <button
          onClick={handleGeneratePredictiveInsight}
          disabled={isGeneratingInsight}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all duration-150 cursor-pointer font-mono shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingInsight ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Computando Modelos...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-indigo-200 animate-pulse" />
              <span>Gerar Análise Profunda com IA</span>
            </>
          )}
        </button>
      </div>

      {!hasEnoughData ? (
        <div className="mt-6 p-6 bg-amber-500/5 border border-amber-500/15 rounded-xl flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white font-display">Amostragem de Dados Insuficiente</h4>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              O oráculo de inteligência preditiva exige pelo menos **3 estudantes ativos** registados na base de dados para mapear desvios de frequência, rácios de produtividade e traçar previsões fidedignas. Atualmente, dispõe apenas de **{students.length}** estudante(s) registado(s).
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Live forecast panel of dropout and resources */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            
            {/* 1. Potenciais Taxas de Evasão Escolar */}
            <div className="bg-zinc-900/45 border border-white/5 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-rose-400 font-mono uppercase">Risco de Evasão Real</span>
                <span className="text-xs font-bold font-mono text-white">Rácio Esperado: {dropoutRate}</span>
              </div>

              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  style={{ width: dropoutWidth }}
                  className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                />
              </div>

              <div className="space-y-2.5 pt-1">
                {studentsAtRisk.slice(0, 2).map(std => {
                  const rScore = ((10 - std.averageGrade) * 5 + (100 - std.attendanceRate) * 0.5).toFixed(0);
                  return (
                    <div key={std.id} className="p-2.5 bg-black/40 border border-white/5 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white truncate max-w-[120px]">{std.name}</span>
                        <span className="text-[8px] bg-rose-500/10 text-rose-400 px-1.5 py-0.2 rounded font-mono uppercase font-bold border border-rose-500/15">
                          Risco: {rScore}%
                        </span>
                      </div>
                      <p className="text-[9px] text-zinc-400 font-mono">
                        Presenças: {std.attendanceRate}% • Notas: {std.averageGrade}/10
                      </p>
                    </div>
                  );
                })}
                {studentsAtRisk.length === 0 && (
                  <div className="text-center py-4 text-zinc-500 text-xs">
                    Nenhum aluno com fatores acumulados de vulnerabilidade pedagógica ou faltas.
                  </div>
                )}
              </div>
            </div>

            {/* 2. Desempenho Académico Futuro */}
            <div className="bg-zinc-900/45 border border-white/5 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-indigo-400 font-mono uppercase">Análise de Rendimento</span>
                <span className="text-xs font-bold font-mono text-white">Média Global: {averageGrade} / 10</span>
              </div>

              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  style={{ width: `${Math.min(parseFloat(averageGrade) * 10, 100)}%` }}
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                />
              </div>

              <div className="p-3 bg-black/40 border border-white/5 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  <span className={`text-[9px] font-bold tracking-wider font-mono uppercase ${academicTrend.color}`}>
                    {academicTrend.label}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                  {academicTrend.desc}
                </p>
              </div>
            </div>

            {/* 3. Necessidades de Recursos Previsórias */}
            <div className="bg-zinc-900/45 border border-white/5 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-amber-400 font-mono uppercase">Auditoria Real de Recursos</span>
                <span className="text-xs font-bold font-mono text-zinc-400">Ativo Real</span>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-zinc-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" /> Corpo Docente
                  </span>
                  <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${resourcesInfo.teacherColor}`}>
                    {resourcesInfo.teacherStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-zinc-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" /> Saturação de Salas
                  </span>
                  <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${resourcesInfo.classColor}`}>
                    {resourcesInfo.classStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-zinc-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> Infraestrutura SaaS
                  </span>
                  <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${resourcesInfo.infraColor}`}>
                    {resourcesInfo.infraStatus}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Generated Report Frame */}
          {predictiveReport && (
            <div className="mt-6 border-t border-white/5 pt-6 animate-fadeIn">
              <div className="bg-black/50 border border-indigo-500/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                    Relatório Estruturado de Inteligência Contextual Real
                  </span>
                  <button 
                    onClick={() => setShowFullReport(!showFullReport)} 
                    className="text-xs text-zinc-400 hover:text-white cursor-pointer font-bold flex items-center gap-1"
                  >
                    {showFullReport ? (
                      <>Ocultar <ChevronUp className="w-3.5 h-3.5" /></>
                    ) : (
                      <>Mostrar <ChevronDown className="w-3.5 h-3.5" /></>
                    )}
                  </button>
                </div>
                {showFullReport && (
                  <div className="whitespace-pre-line text-xs font-sans text-zinc-300 leading-relaxed max-h-[300px] overflow-y-auto pr-1 space-y-2">
                    {predictiveReport}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default memo(PredictiveAI);
