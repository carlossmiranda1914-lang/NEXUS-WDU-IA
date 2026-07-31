import React, { memo } from 'react';
import { KPIMetrics } from '../types/dashboard.types';

interface DashboardHeaderProps {
  metrics: KPIMetrics;
}

function DashboardHeader({ metrics }: DashboardHeaderProps) {
  const { totalStudents, averageAttendance, averageGrade } = metrics;

  return (
    <section 
      id="dashboard_header_section"
      className="flex flex-col xl:flex-row xl:items-end justify-between border-b border-zinc-850 pb-6 gap-6"
    >
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
      <div className="flex flex-wrap gap-4 sm:gap-6 xl:text-right">
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
  );
}

export default memo(DashboardHeader);
