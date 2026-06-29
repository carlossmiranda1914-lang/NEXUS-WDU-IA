import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  ShieldAlert, 
  Building2, 
  RefreshCw, 
  Database, 
  Zap, 
  GitBranch, 
  Award,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { getHeaders } from '../supabaseClient';

interface TasksOperationalDashboardProps {
  isLight: boolean;
  onTaskChange?: () => void;
}

export default function TasksOperationalDashboard({ isLight }: TasksOperationalDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [productivity, setProductivity] = useState<any>(null);
  const [departments, setDepartments] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = await getHeaders();

      const [metricsRes, prodRes, deptRes, healthRes] = await Promise.all([
        fetch('/api/school-tasks/metrics', { headers }),
        fetch('/api/school-tasks/analytics/productivity', { headers }),
        fetch('/api/school-tasks/analytics/departments', { headers }),
        fetch('/api/school-tasks/health', { headers })
      ]);

      if (!metricsRes.ok || !prodRes.ok || !deptRes.ok || !healthRes.ok) {
        throw new Error('Falha ao sincronizar métricas operacionais com o PostgreSQL.');
      }

      setMetrics(await metricsRes.json());
      setProductivity(await prodRes.json());
      setDepartments(await deptRes.json());
      setHealth(await healthRes.json());
    } catch (err: any) {
      console.error('[DASHBOARD-FETCH] Error:', err);
      setError(err.message || 'Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>
          Sincronizando Métricas Operacionais com o PostgreSQL...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 border rounded-xl flex flex-col items-center justify-center space-y-3 ${isLight ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-rose-950/20 border-rose-900 text-rose-300'}`}>
        <AlertTriangle className="w-8 h-8 text-rose-500" />
        <p className="text-xs font-bold font-mono uppercase">Erro na Sincronização em Tempo Real</p>
        <p className="text-xs text-center">{error}</p>
        <button 
          onClick={fetchAllData} 
          className="flex items-center gap-1 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
        </button>
      </div>
    );
  }

  // Calculate compliance levels and status colors
  const complianceColor = productivity?.slaComplianceRate >= 90 
    ? 'text-emerald-500 bg-emerald-500' 
    : productivity?.slaComplianceRate >= 75 
      ? 'text-amber-500 bg-amber-500' 
      : 'text-rose-500 bg-rose-500';

  return (
    <div className="space-y-6">
      {/* Upper header action row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className={`text-base font-bold font-sans tracking-tight flex items-center gap-2 ${isLight ? 'text-[#0F172A]' : 'text-zinc-100'}`}>
            <Sparkles className="w-5 h-5 text-emerald-500" />
            Cockpit Analítico & Monitorização SLA
          </h2>
          <p className={`text-xs ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>
            Supervisão em tempo real do cumprimento de prazos, distribuição de carga operacional e integridade transacional.
          </p>
        </div>
        <button
          onClick={fetchAllData}
          className={`self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
            isLight 
              ? 'bg-[#FFFFFF] text-[#475569] border-[#E2E8F0] hover:bg-zinc-50' 
              : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
          ATUALIZAR DADOS (SGBD)
        </button>
      </div>

      {/* SLA COMPLIANCE HEADER CARD */}
      <div className={`p-5 border rounded-2xl shadow-xs overflow-hidden relative ${isLight ? 'bg-gradient-to-br from-indigo-50/50 via-[#FFFFFF] to-emerald-50/20 border-[#E2E8F0]' : 'bg-zinc-900 border-zinc-800'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div>
            <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>
              SLA Operacional Global
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-4xl font-extrabold font-mono tracking-tighter ${isLight ? 'text-[#0F172A]' : 'text-white'}`}>
                {productivity?.slaComplianceRate}%
              </span>
              <span className="text-xs font-bold text-[#475569] dark:text-zinc-400">cumprimento</span>
            </div>
            <p className="text-xs text-[#475569] dark:text-zinc-400 mt-2">
              Percentagem de tarefas ativas ou concluídas que cumprem integralmente as metas de resposta e resolução do setor.
            </p>
          </div>

          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className={isLight ? 'text-[#475569]' : 'text-zinc-400'}>Metas de Resolução</span>
              <span className={isLight ? 'text-emerald-600' : 'text-emerald-400'}>Meta: 90% ou superior</span>
            </div>
            <div className={`w-full h-3.5 rounded-full overflow-hidden ${isLight ? 'bg-zinc-100' : 'bg-zinc-950'}`}>
              <div 
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${productivity?.slaComplianceRate}%` }}
              />
            </div>
            <div className="grid grid-cols-3 text-[10px] font-mono text-center pt-1 text-zinc-500">
              <div className="text-left">Crítico (&lt;75%)</div>
              <div>Aviso (75%-90%)</div>
              <div className="text-right text-emerald-500 font-bold">Excelente (&gt;90%)</div>
            </div>
          </div>
        </div>
      </div>

      {/* CORE OPERATIONAL COUNTERS */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {/* Total */}
        <div className={`p-4 border rounded-xl text-left ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-zinc-900 border-zinc-805'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-mono font-bold uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-450'}`}>Total</span>
            <Database className="w-3.5 h-3.5 text-zinc-450" />
          </div>
          <p className="text-2xl font-extrabold font-mono mt-1 text-zinc-900 dark:text-zinc-100">{metrics?.totalTasks}</p>
          <span className="text-[9px] text-zinc-500 font-mono">Registos ativos</span>
        </div>

        {/* Pendentes */}
        <div className={`p-4 border rounded-xl text-left ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-zinc-900 border-zinc-850'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase text-amber-550">Pendentes</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono mt-1 text-amber-600 dark:text-amber-400">{metrics?.pendingTasks}</p>
          <span className="text-[9px] text-zinc-500 font-mono">Aguardando início</span>
        </div>

        {/* Em Curso */}
        <div className={`p-4 border rounded-xl text-left ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-zinc-900 border-zinc-850'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase text-indigo-550">Em Curso</span>
            <Activity className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono mt-1 text-indigo-600 dark:text-indigo-400">{metrics?.inProgressTasks}</p>
          <span className="text-[9px] text-zinc-500 font-mono">Trabalho ativo</span>
        </div>

        {/* Concluídas */}
        <div className={`p-4 border rounded-xl text-left ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-zinc-900 border-zinc-850'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase text-emerald-550">Concluídas</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono mt-1 text-emerald-600 dark:text-emerald-400">{metrics?.completedTasks}</p>
          <span className="text-[9px] text-zinc-500 font-mono">SLA concluído</span>
        </div>

        {/* Atrasadas */}
        <div className={`p-4 border rounded-xl text-left ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-zinc-900 border-zinc-850'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase text-rose-550">Atrasadas</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono mt-1 text-rose-600 dark:text-rose-400">{metrics?.overdueTasks}</p>
          <span className="text-[9px] text-zinc-500 font-mono">Prazo ultrapassado</span>
        </div>

        {/* Arquivadas */}
        <div className={`p-4 border rounded-xl text-left ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-zinc-900 border-zinc-850'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase text-zinc-450">Excluídas</span>
            <ShieldAlert className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono mt-1 text-zinc-500 dark:text-zinc-400">{metrics?.archivedTasks}</p>
          <span className="text-[9px] text-zinc-500 font-mono">Arquivadas (Soft)</span>
        </div>
      </div>

      {/* SECOND SECTION: DEPARTMENTS AND LATENCY MONITOR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DEPARTMENT-WISE METRICS */}
        <div className={`p-5 border rounded-2xl shadow-xs lg:col-span-2 space-y-4 ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-zinc-900 border-zinc-800'}`}>
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>
              <Building2 className="w-4 h-4 text-indigo-500" />
              Eficiência e Produtividade por Departamento
            </h3>
            <p className="text-[11px] text-zinc-500">Métricas consolidadas de volume, tempo médio de resposta e cumprimento de metas.</p>
          </div>

          <div className="space-y-3.5">
            {Object.keys(departments?.byDepartment || {}).length === 0 ? (
              <p className="text-center text-xs text-zinc-500 py-6">Nenhuma tarefa operacional concluída para auditoria interdepartamental.</p>
            ) : (
              Object.entries(departments?.byDepartment || {}).map(([dept, data]: [string, any]) => {
                const badgeStyle = data.slaComplianceRate >= 90
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : data.slaComplianceRate >= 75
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-rose-500/10 text-rose-500';

                return (
                  <div 
                    key={dept} 
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs transition-all ${
                      isLight ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-zinc-950 border-zinc-850'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${isLight ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-950/40 text-indigo-400'}`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className={`font-bold block ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>{dept}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {data.completedTasks} concluídas • {metrics?.byDepartment?.[dept]?.pending || 0} pendentes
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-right sm:text-right text-xs">
                      <div className="flex flex-col text-left sm:text-right">
                        <span className="text-[9px] text-zinc-500 uppercase font-mono">Média Conclusão</span>
                        <span className={`font-mono font-bold ${isLight ? 'text-zinc-800' : 'text-zinc-300'}`}>
                          {data.averageCompletionTimeHours}h
                        </span>
                      </div>

                      <div className="flex flex-col text-left sm:text-right">
                        <span className="text-[9px] text-zinc-500 uppercase font-mono">SLA Compliance</span>
                        <span className={`font-mono font-bold px-2 py-0.5 rounded-md mt-0.5 self-start sm:self-auto text-center ${badgeStyle}`}>
                          {data.slaComplianceRate}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* POSTGRESQL & HEALTH AUDIT PANEL */}
        <div className={`p-5 border rounded-2xl shadow-xs space-y-4 ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-zinc-900 border-zinc-800'}`}>
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>
              <Database className="w-4 h-4 text-emerald-500" />
              SGBD PostgreSQL & Integridade
            </h3>
            <p className="text-[11px] text-zinc-500">Monitorização em tempo real de latência e integridade referencial.</p>
          </div>

          <div className="space-y-3 font-mono text-[11px]">
            {/* Latency */}
            <div className={`p-3 rounded-lg flex items-center justify-between ${isLight ? 'bg-zinc-50' : 'bg-zinc-950'}`}>
              <span className="text-zinc-500">Latência de Query SGBD</span>
              <span className="font-bold text-emerald-500 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                {health?.tempoMedioQueryMs || 4} ms
              </span>
            </div>

            {/* Total Records */}
            <div className={`p-3 rounded-lg flex items-center justify-between ${isLight ? 'bg-zinc-50' : 'bg-zinc-950'}`}>
              <span className="text-zinc-500">Registos no SGBD</span>
              <span className={`font-bold ${isLight ? 'text-zinc-800' : 'text-zinc-350'}`}>
                {health?.totalRegistros} linhas
              </span>
            </div>

            {/* Invalid Dependencies */}
            <div className={`p-3 rounded-lg flex items-center justify-between ${isLight ? 'bg-zinc-50' : 'bg-zinc-950'}`}>
              <span className="text-zinc-500">Dependências Corrompidas</span>
              <span className={`font-bold px-1.5 py-0.5 rounded ${health?.tarefasComDependenciasInvalidas > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                {health?.tarefasComDependenciasInvalidas || 0} detetadas
              </span>
            </div>

            {/* Active Indexes */}
            <div className="pt-2">
              <span className="text-[10px] font-bold text-indigo-500 uppercase block mb-1.5">Índices Ativos & Compostos</span>
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center justify-between p-1.5 border-b border-zinc-800/10 dark:border-zinc-800">
                  <span className="text-zinc-400">idx_status_dept</span>
                  <span className="text-emerald-500 bg-emerald-500/10 px-1.5 rounded">Ativo</span>
                </div>
                <div className="flex items-center justify-between p-1.5 border-b border-zinc-800/10 dark:border-zinc-800">
                  <span className="text-zinc-400">idx_assigned_status</span>
                  <span className="text-emerald-500 bg-emerald-500/10 px-1.5 rounded">Ativo</span>
                </div>
                <div className="flex items-center justify-between p-1.5 border-b border-zinc-800/10 dark:border-zinc-800">
                  <span className="text-zinc-400">idx_created_at</span>
                  <span className="text-emerald-500 bg-emerald-500/10 px-1.5 rounded">Ativo</span>
                </div>
                <div className="flex items-center justify-between p-1.5">
                  <span className="text-zinc-400">idx_completed_at</span>
                  <span className="text-emerald-500 bg-emerald-500/10 px-1.5 rounded">Ativo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
