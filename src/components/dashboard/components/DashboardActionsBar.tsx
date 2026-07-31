import React, { memo } from 'react';
import { Landmark, RefreshCw, Plus } from 'lucide-react';

interface DashboardActionsBarProps {
  isLoadingLogs: boolean;
  onRefreshLogs: () => void;
  onQuickAction: (actionType: string) => void;
}

function DashboardActionsBar({
  isLoadingLogs,
  onRefreshLogs,
  onQuickAction,
}: DashboardActionsBarProps) {
  return (
    <div 
      id="dashboard_actions_bar"
      className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <Landmark className="text-indigo-400 w-4 h-4 shrink-0" />
        <span className="text-xs font-bold text-zinc-100">Suite Operativa de Decisão Académica</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onRefreshLogs}
          className="flex items-center gap-1.5 text-zinc-350 hover:text-white bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 text-xs px-3.5 py-2 rounded-lg transition-colors cursor-pointer font-mono font-bold"
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
  );
}

export default memo(DashboardActionsBar);
