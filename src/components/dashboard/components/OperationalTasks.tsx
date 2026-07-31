import React, { memo, useMemo } from 'react';
import { CheckSquare, Loader2, Trash2 } from 'lucide-react';
import { TodoTask } from '../types/dashboard.types';

interface OperationalTasksProps {
  isLight: boolean;
  isLoadingTasks: boolean;
  todoTasks: TodoTask[];
  onToggleTaskStatus: (taskId: string, currentStatus: string) => void;
  onDeleteTask: (taskId: string) => void;
  onViewAllTasks: () => void;
}

function OperationalTasks({
  isLight,
  isLoadingTasks,
  todoTasks,
  onToggleTaskStatus,
  onDeleteTask,
  onViewAllTasks,
}: OperationalTasksProps) {
  const pendingCount = useMemo(() => 
    todoTasks.filter(t => t.status !== 'Concluída').length,
    [todoTasks]
  );

  return (
    <div 
      id="dashboard_operational_tasks_container"
      className={`p-6 rounded-2xl border flex flex-col justify-between ${
        isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
      }`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <h3 className={`text-sm font-bold font-display flex items-center gap-2 ${isLight ? 'text-zinc-900' : 'text-zinc-150'}`}>
            <CheckSquare className="w-4.5 h-4.5 text-indigo-400" />
            Tarefas Operativas Ativas
          </h3>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
            isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
          }`}>
            {pendingCount} Pendentes
          </span>
        </div>

        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
          {isLoadingTasks ? (
            <div className="flex items-center justify-center py-8 gap-2 text-zinc-550">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span className="text-xs">A carregar tarefas...</span>
            </div>
          ) : todoTasks.length === 0 ? (
            <p className="text-xs text-zinc-500 italic text-center py-6 bg-zinc-50 dark:bg-zinc-950/40 rounded border border-zinc-200 dark:border-zinc-900">
              Nenhuma tarefa operacional pendente na pauta escolar.
            </p>
          ) : (
            todoTasks.map((tk) => {
              const isCompleted = tk.status === 'Concluída';
              const isHigh = tk.priority === 'Alta' || tk.priority === 'Urgente' || tk.priority === 'Crítica';
              return (
                <div 
                  key={tk.id} 
                  className={`p-3 rounded-xl border flex items-start gap-2.5 transition ${
                    isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-zinc-850'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={isCompleted}
                    onChange={() => onToggleTaskStatus(tk.id, tk.status)}
                    className="mt-0.5 rounded border-zinc-300 dark:border-zinc-850 bg-white dark:bg-zinc-900 text-emerald-500 focus:ring-opacity-0 cursor-pointer w-3.5 h-3.5 shrink-0" 
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-xs font-semibold truncate ${isCompleted ? 'line-through text-zinc-500' : isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>
                      {tk.title}
                    </h4>
                    <p className={`text-[10px] mt-0.5 line-clamp-2 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {tk.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-[8px] font-mono font-bold">
                      <span className={`uppercase px-1 py-0.2 rounded ${
                        isHigh ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {tk.priority}
                      </span>
                      <span className="text-zinc-500">{tk.dueDate}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => onDeleteTask(tk.id)}
                    className="text-zinc-400 hover:text-rose-500 p-0.5 rounded transition shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      <button 
        onClick={onViewAllTasks}
        className={`w-full mt-4 py-2 rounded-xl text-xs font-bold text-center cursor-pointer border ${
          isLight ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-350 text-zinc-800' : 'bg-zinc-950/80 border-zinc-850 hover:bg-zinc-950 hover:border-zinc-800 text-zinc-250'
        }`}
      >
        Ver Quadro Completo
      </button>
    </div>
  );
}

export default memo(OperationalTasks);
