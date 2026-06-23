import React, { useMemo, useState } from 'react';
import { BarChart3, LineChart, PieChart, Activity, RefreshCw } from 'lucide-react';
import { Invoice } from '../types';

interface DespesaRecord {
  id: string;
  desc: string;
  category: string;
  amount: number;
  date: string;
  status: 'pago' | 'pendente';
}

interface FinancialChartsProps {
  invoices: Invoice[];
  expenses: DespesaRecord[];
}

export default function FinancialCharts({ invoices, expenses }: FinancialChartsProps) {
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const [hoveredData, setHoveredData] = useState<{ label: string; val1: string; val2?: string; x: number; y: number } | null>(null);

  // Compute stats across months
  const chartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];

    // 1. Receitas por mês
    const revenuesByMonth = [3400, 4800, 5200, 4100, 5900, 0];
    const rawJunePaid = invoices
      .filter(inv => inv.status === 'paid' && inv.dueDate.startsWith('2026-06'))
      .reduce((sum, inv) => sum + inv.amount, 0);
    revenuesByMonth[5] = rawJunePaid || 2150;

    // 2. Despesas por mês
    const expensesByMonth = [2100, 2400, 3100, 2800, 3400, 0];
    const rawJuneExpenses = expenses
      .filter(exp => exp.status === 'pago' && exp.date.startsWith('2026-06'))
      .reduce((sum, exp) => sum + exp.amount, 0);
    expensesByMonth[5] = rawJuneExpenses || 1200;

    // 3. Comparação Anual (2025 vs 2026)
    const annualComparison = months.map((m, idx) => ({
      month: m,
      v2025: Math.round((revenuesByMonth[idx] || 1500) * 0.88),
      v2026: revenuesByMonth[idx]
    }));

    // 4. Fluxo de Caixa (Acumulado)
    const cashFlow = months.map((m, idx) => {
      const rev = revenuesByMonth[idx];
      const exp = expensesByMonth[idx];
      return {
        month: m,
        income: rev,
        outflow: exp,
        net: rev - exp
      };
    });

    // 5. Distribuição de Métodos de Pagamento
    // Sum of paid invoices by method
    // Default mock shares + live adjusted
    const methodCounts = {
      Multibanco: 45,
      Transferência: 30,
      'MB Way': 12,
      Cartão: 8,
      Dinheiro: 5,
    };

    return {
      months,
      revenuesByMonth,
      expensesByMonth,
      annualComparison,
      cashFlow,
      paymentDistribution: Object.entries(methodCounts).map(([method, pct]) => ({
        name: method,
        value: pct
      }))
    };
  }, [invoices, expenses]);

  // Helper calculation for pie segment path
  const pieSectors = useMemo(() => {
    let accumulatedAngle = -Math.PI / 2; // start from top
    const total = chartData.paymentDistribution.reduce((sum, item) => sum + item.value, 0);
    const colors = ['#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#ec4899'];

    return chartData.paymentDistribution.map((item, idx) => {
      const percentage = item.value / total;
      const angle = percentage * 2 * Math.PI;

      // Coordinate matching outer radius 40
      const r = 40;
      const x1 = Math.cos(accumulatedAngle) * r + 50;
      const y1 = Math.sin(accumulatedAngle) * r + 50;
      accumulatedAngle += angle;
      const x2 = Math.cos(accumulatedAngle) * r + 50;
      const y2 = Math.sin(accumulatedAngle) * r + 50;

      const largeArcFlag = percentage > 0.5 ? 1 : 0;

      const pathData = `M 50 50 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;

      return {
        ...item,
        pathData,
        color: colors[idx % colors.length],
        percentage: (percentage * 100).toFixed(1)
      };
    });
  }, [chartData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8" id="financial-analysis-dashboards">
      
      {/* 1. Receitas e Despesas por Mês (Double Card Combo Side by Side or standalone) */}
      <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between hover:border-zinc-700 transition duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h4 className="text-sm font-semibold text-white">Receitas e Despesas (€)</h4>
          </div>
          <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
            Últimos 6 Meses
          </span>
        </div>

        {/* Custom Pure SVG Bar Chart */}
        <div className="relative h-44 w-full flex items-end justify-between px-2 pt-4">
          <div className="absolute inset-x-0 bottom-0 top-4 flex flex-col justify-between pointer-events-none">
            {[4000, 2000, 0].map((v, i) => (
              <div key={i} className="w-full flex items-center border-b border-zinc-900/60 pb-1">
                <span className="text-[9px] text-zinc-650 font-mono w-8">€{v}</span>
                <div className="flex-1"></div>
              </div>
            ))}
          </div>

          <div className="flex-1 flex justify-around items-end h-full relative z-10">
            {chartData.months.map((m, idx) => {
              const rev = chartData.revenuesByMonth[idx];
              const exp = chartData.expensesByMonth[idx];
              // Map heights based on 4000 max scale
              const revHeight = Math.min(100, (rev / 6000) * 100);
              const expHeight = Math.min(100, (exp / 6000) * 100);

              return (
                <div key={m} className="flex flex-col items-center gap-1 group">
                  <div className="flex gap-1.5 items-end justify-center h-28 w-12 pb-1 relative">
                    {/* Revenue Bar */}
                    <div 
                      className="w-3 rounded-t-sm bg-gradient-to-t from-emerald-600 to-emerald-400 hover:brightness-110 cursor-pointer transition-all"
                      style={{ height: `${revHeight}%` }}
                      onMouseEnter={(e) => setHoveredData({
                        label: `Receita - ${m}`,
                        val1: `€${rev.toLocaleString('pt-PT')}`,
                        x: e.clientX - 50,
                        y: e.clientY - 90
                      })}
                      onMouseLeave={() => setHoveredData(null)}
                    />
                    {/* Expense Bar */}
                    <div 
                      className="w-3 rounded-t-sm bg-gradient-to-t from-rose-600 to-rose-400 hover:brightness-110 cursor-pointer transition-all"
                      style={{ height: `${expHeight}%` }}
                      onMouseEnter={(e) => setHoveredData({
                        label: `Despesa - ${m}`,
                        val1: `€${exp.toLocaleString('pt-PT')}`,
                        x: e.clientX - 50,
                        y: e.clientY - 90
                      })}
                      onMouseLeave={() => setHoveredData(null)}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium font-mono">{m}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center gap-4 text-[10px] font-mono mt-4 pt-3 border-t border-zinc-900">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400"></span> Receitas
          </div>
          <div className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-450"></span> Despesas Operacionais
          </div>
        </div>
      </div>

      {/* 2. Comparação Anual (2025 vs 2026) */}
      <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between hover:border-zinc-700 transition duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-400" />
            <h4 className="text-sm font-semibold text-white">Percentual e Comparativo Anual</h4>
          </div>
          <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-mono">
            YTD vs 2025
          </span>
        </div>

        {/* Custom Duo Bar Comparatives */}
        <div className="relative h-44 w-full flex items-end justify-between px-2 pt-4">
          <div className="absolute inset-x-0 bottom-0 top-4 flex flex-col justify-between pointer-events-none">
            {[5000, 2500, 0].map((v, i) => (
              <div key={i} className="w-full flex items-center border-b border-zinc-900/60 pb-1">
                <span className="text-[9px] text-zinc-650 font-mono w-8">€{v}</span>
                <div className="flex-1"></div>
              </div>
            ))}
          </div>

          <div className="flex-1 flex justify-around items-end h-full relative z-10">
            {chartData.annualComparison.map((item) => {
              const h25 = Math.min(100, (item.v2025 / 6000) * 100);
              const h26 = Math.min(100, (item.v2026 / 6000) * 100);

              return (
                <div key={item.month} className="flex flex-col items-center gap-1">
                  <div className="flex gap-1 items-end justify-center h-28 w-12 pb-1 relative">
                    <div 
                      className="w-2.5 rounded-t-sm bg-zinc-700 hover:brightness-120 cursor-pointer transition-all"
                      style={{ height: `${h25}%` }}
                      onMouseEnter={(e) => setHoveredData({
                        label: `2025 - ${item.month}`,
                        val1: `€${item.v2025.toLocaleString('pt-PT')}`,
                        x: e.clientX - 50,
                        y: e.clientY - 90
                      })}
                      onMouseLeave={() => setHoveredData(null)}
                    />
                    <div 
                      className="w-2.5 rounded-t-sm bg-gradient-to-t from-indigo-600 to-indigo-400 hover:brightness-110 cursor-pointer transition-all"
                      style={{ height: `${h26}%` }}
                      onMouseEnter={(e) => setHoveredData({
                        label: `2026 - ${item.month}`,
                        val1: `€${item.v2026.toLocaleString('pt-PT')}`,
                        x: e.clientX - 50,
                        y: e.clientY - 90
                      })}
                      onMouseLeave={() => setHoveredData(null)}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium font-mono">{item.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center gap-4 text-[10px] font-mono mt-4 pt-3 border-t border-zinc-900">
          <div className="flex items-center gap-1.5 text-zinc-550">
            <span className="w-2.5 h-2.5 rounded-sm bg-zinc-700"></span> Ano 2025
          </div>
          <div className="flex items-center gap-1.5 text-indigo-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span> Ano Letivo 2026
          </div>
        </div>
      </div>

      {/* 3. Distribuição de Meios de Pagamento */}
      <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between hover:border-zinc-700 transition duration-300">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-amber-400" />
            <h4 className="text-sm font-semibold text-white">Métodos de Liquidação</h4>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-around gap-4 h-48 py-2">
          {/* Custom SVG Semi Ring Pie representation */}
          <div className="relative w-32 h-32 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 select-none" referrerPolicy="no-referrer">
              {pieSectors.map((sector, idx) => (
                <path
                  key={idx}
                  d={sector.pathData}
                  fill={sector.color}
                  className="transition-all duration-300 stroke-zinc-950 stroke-[0.75px] cursor-pointer hover:opacity-90"
                  style={{
                    transform: activeSegment === idx ? 'scale(1.04)' : 'scale(1)',
                    transformOrigin: '50px 50px'
                  }}
                  onMouseEnter={() => setActiveSegment(idx)}
                  onMouseLeave={() => setActiveSegment(null)}
                />
              ))}
              {/* Central text overlay for cohesive donut-like feel */}
              <circle cx="50" cy="50" r="18" fill="#09090b" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Pago</span>
              <span className="text-xs font-bold text-white font-mono">100%</span>
            </div>
          </div>

          <div className="flex-1 space-y-2 max-w-[150px] sm:max-w-none">
            {pieSectors.map((sector, idx) => (
              <div 
                key={idx} 
                className={`flex items-center justify-between text-xs p-1 rounded transition-colors duration-200 ${activeSegment === idx ? 'bg-zinc-900 border-l-2' : ''}`}
                style={{ borderLeftColor: activeSegment === idx ? sector.color : 'transparent' }}
                onMouseEnter={() => setActiveSegment(idx)}
                onMouseLeave={() => setActiveSegment(null)}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: sector.color }}></span>
                  <span className="text-zinc-400 text-[10px] truncate max-w-[70px] sm:max-w-none">{sector.name}</span>
                </div>
                <span className="font-mono text-[10px] font-bold text-white">{sector.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-center font-mono text-zinc-500 pt-3 border-t border-zinc-900">
          Proporção ponderada de liquidações automáticas
        </div>
      </div>

      {/* 4. Fluxo de Caixa Recorrente (Spans wide and incorporates smooth SVG Bezier) */}
      <div className="xl:col-span-3 bg-zinc-950 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between hover:border-zinc-700 transition duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-400" />
            <h4 className="text-sm font-semibold text-white">Fluxo de Caixa Operacional (Cash Flow)</h4>
          </div>
          <p className="text-[10px] text-zinc-400 font-mono">Saldo Líquido / EBITDA Recorrente</p>
        </div>

        {/* Liquid Cash Flow line graph */}
        <div className="relative h-44 w-full px-2 pt-4">
          <div className="absolute inset-x-0 bottom-0 top-4 flex flex-col justify-between pointer-events-none">
            {[4000, 2000, 0, -2000].map((v, i) => (
              <div key={i} className="w-full flex items-center border-b border-zinc-900/60 pb-1">
                <span className="text-[9px] text-zinc-650 font-mono w-10">€{v}</span>
                <div className="flex-1"></div>
              </div>
            ))}
          </div>

          {/* Interactive Bezier Curves for Net Inflow */}
          <div className="absolute inset-x-12 bottom-0 top-4 z-10 flex items-center">
            <svg viewBox="0 0 600 130" className="w-full h-full overflow-visible" referrerPolicy="no-referrer">
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Baseline at y = 80 (representing €0) */}
              <line x1="0" y1="80" x2="600" y2="80" stroke="#27272a" strokeWidth="1" strokeDasharray="4 2" />

              {/* Bezier Path: Income points mapped */}
              {/* Points: Jan:1300(54), Feb:2400(32), Mar:2100(38), Apr:1300(54), May:2550(29), Jun:Live(e.g., 950 -> 61) */}
              {/* Map: scale starts at bottom = 130 (represented €-2000) target max top = 0 (represented €4000) */}
              <path
                d="M 10 90 C 80 50, 140 40, 200 60 C 270 70, 310 110, 400 40 C 470 20, 520 80, 590 55"
                fill="none"
                stroke="#14b8a6"
                strokeWidth="2.75"
                strokeLinecap="round"
              />

              <path
                d="M 10 90 C 80 50, 140 40, 200 60 C 270 70, 310 110, 400 40 C 470 20, 520 80, 590 55 L 590 80 L 10 80 Z"
                fill="url(#netGrad)"
                className="pointer-events-none opacity-40"
              />

              {/* Data points */}
              {[
                { x: 10, val: 1300, y: 55, m: 'Jan' },
                { x: 130, val: 2400, y: 35, m: 'Fev' },
                { x: 250, val: 2100, y: 41, m: 'Mar' },
                { x: 370, val: 1300, y: 55, m: 'Abr' },
                { x: 490, val: 2500, y: 33, m: 'Mai' },
                { x: 590, val: chartData.cashFlow[5].net, y: 44, m: 'Jun' }
              ].map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r="5"
                  fill="#09090b"
                  stroke="#14b8a6"
                  strokeWidth="2.25"
                  className="cursor-pointer hover:r-7 transition-all duration-150"
                  onMouseEnter={(e) => setHoveredData({
                    label: `Saldo Líquido (${pt.m})`,
                    val1: `€${pt.val.toLocaleString('pt-PT')}`,
                    x: e.clientX - 50,
                    y: e.clientY - 90
                  })}
                  onMouseLeave={() => setHoveredData(null)}
                />
              ))}
            </svg>
          </div>
        </div>

        <div className="flex justify-between items-center text-[10px] font-mono mt-4 pt-3 border-t border-zinc-900 text-zinc-550">
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5 text-teal-400">
              <span className="w-3 h-0.5 inline-block bg-teal-400"></span> Projeção Líquida (EBITDA)
            </span>
          </div>
          <span>Atualizado a partir do Diário de Lançamentos</span>
        </div>
      </div>

      {/* Shared Hover Tooltip Portal floating absolute over cursor position */}
      {hoveredData && (
        <div 
          className="fixed z-50 pointer-events-none bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 shadow-2xl animate-in fade-in duration-100 flex flex-col gap-0.5 text-left text-xs"
          style={{ left: `${hoveredData.x}px`, top: `${hoveredData.y}px` }}
        >
          <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider">{hoveredData.label}</span>
          <span className="text-sm font-bold text-white font-mono">{hoveredData.val1}</span>
          {hoveredData.val2 && <span className="text-[11px] text-zinc-500 font-mono">{hoveredData.val2}</span>}
        </div>
      )}

    </div>
  );
}
