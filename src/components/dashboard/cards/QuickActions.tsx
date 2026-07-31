import React, { memo, useMemo } from 'react';
import { 
  UserPlus, Megaphone, FilePlus2, PenTool, ClipboardCheck, CheckSquare, Sparkles 
} from 'lucide-react';

interface QuickActionsProps {
  setCurrentTab: (tab: string) => void;
  onQuickAction?: (actionType: string) => void;
  theme: string;
}

function QuickActions({
  setCurrentTab,
  onQuickAction,
  theme
}: QuickActionsProps) {
  const isLight = theme === 'light';

  const actions = useMemo(() => [
    {
      title: 'Matricular Aluno',
      desc: 'Iniciar novo processo de admissão e dossiê',
      icon: UserPlus,
      color: 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15',
      action: () => {
        if (onQuickAction) {
          onQuickAction('add-student');
        } else {
          setCurrentTab('students');
        }
      }
    },
    {
      title: 'Lançar Comunicado',
      desc: 'Emitir aviso para turmas ou toda a comunidade',
      icon: Megaphone,
      color: 'bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/15',
      action: () => setCurrentTab('communications')
    },
    {
      title: 'Faturação / Mensalidades',
      desc: 'Emitir faturas de propinas e relatórios financeiros',
      icon: FilePlus2,
      color: 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/15',
      action: () => setCurrentTab('financials')
    },
    {
      title: 'Assinatura Digital',
      desc: 'Enviar contrato ou termo para assinatura digital',
      icon: PenTool,
      color: 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/15',
      action: () => setCurrentTab('signatures')
    },
    {
      title: 'Aprovações Internas',
      desc: 'Verificar solicitações e fluxogramas pendentes',
      icon: ClipboardCheck,
      color: 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/15',
      action: () => setCurrentTab('approvals')
    },
    {
      title: 'Plano de Tarefas',
      desc: 'Criar ou atribuir tarefas escolares e operativas',
      icon: CheckSquare,
      color: 'bg-sky-500/10 text-sky-500 hover:bg-sky-500/15',
      action: () => setCurrentTab('tasks')
    }
  ], [onQuickAction, setCurrentTab]);

  return (
    <div 
      id="quick_actions_management"
      className={`p-6 rounded-2xl border ${
        isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-emerald-500" />
        <h3 className={`text-sm font-bold font-display ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
          Ações Rápidas de Gestão
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {actions.map((act, idx) => {
          const Icon = act.icon;
          return (
            <button
              key={idx}
              onClick={act.action}
              className={`p-3 rounded-xl border flex flex-col items-start text-left cursor-pointer transition-all duration-150 ${
                isLight 
                  ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 hover:border-zinc-300' 
                  : 'bg-zinc-950/40 hover:bg-zinc-950/80 border-zinc-850 hover:border-zinc-800'
              }`}
            >
              <span className={`p-2 rounded-lg mb-3 flex items-center justify-center ${act.color}`}>
                <Icon className="w-4 h-4" />
              </span>
              <h4 className={`text-xs font-bold leading-tight ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>
                {act.title}
              </h4>
              <p className={`text-[9px] mt-1 leading-snug line-clamp-2 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {act.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(QuickActions);
