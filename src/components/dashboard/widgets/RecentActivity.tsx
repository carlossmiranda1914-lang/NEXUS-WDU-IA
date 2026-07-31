import React, { memo } from 'react';
import { RefreshCw, Loader2, Clock } from 'lucide-react';

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

interface RecentActivityProps {
  logs: LogRecord[];
  isLoadingLogs: boolean;
  onRefreshLogs: () => void;
  theme: string;
}

function RecentActivity({
  logs,
  isLoadingLogs,
  onRefreshLogs,
  theme
}: RecentActivityProps) {
  const isLight = theme === 'light';

  return (
    <section 
      id="recent_activity_logs_section"
      className={`p-6 rounded-2xl border ${
        isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${
            isLight ? 'bg-zinc-100 border-zinc-200 text-indigo-600' : 'bg-zinc-950 border-zinc-850 text-indigo-400'
          }`}>
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className={`text-base font-bold font-display ${isLight ? 'text-zinc-900' : 'text-white'}`}>
              Atividade Recente do Sistema
            </h3>
            <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Histórico em tempo real de matrículas, emissão de faturas e fluxos de aprovação escolar.
            </p>
          </div>
        </div>

        <button 
          onClick={onRefreshLogs}
          disabled={isLoadingLogs}
          className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition border ${
            isLight 
              ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-350 text-zinc-800' 
              : 'bg-zinc-950 border-zinc-850 hover:bg-zinc-950/80 hover:border-zinc-800 text-zinc-300'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
          Sincronizar
        </button>
      </div>

      <div className={`mt-4 p-4 rounded-xl border font-mono text-[11px] leading-relaxed max-h-[300px] overflow-y-auto space-y-3.5 ${
        isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-zinc-850'
      }`}>
        {isLoadingLogs ? (
          <div className="flex items-center justify-center py-12 gap-2 text-zinc-550">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            <span>Sincronizando diário de auditoria...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 text-zinc-500">
            <span>Nenhuma atividade recente detetada na base de dados escolar.</span>
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

            // Format timestamp or default to current time
            const timestampStr = lg.created_at || lg.timestamp;
            const displayTime = timestampStr 
              ? new Date(timestampStr).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
              : new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

            const friendlyRole = lg.userRole === 'admin' ? 'Administrador' :
                                 lg.userRole === 'director' ? 'Direção' :
                                 lg.userRole === 'secretariat' ? 'Secretaria' :
                                 lg.userRole === 'financial' ? 'Finanças' :
                                 lg.userRole === 'teacher' ? 'Professor' : 'Utilizador';

            return (
              <div 
                key={`${lg.id || 'log'}-${idx}`} 
                className={`border-b border-dashed pb-2.5 flex flex-col md:flex-row md:items-start gap-1.5 md:gap-4 hover:opacity-100 opacity-90 transition ${
                  isLight ? 'border-zinc-200' : 'border-zinc-850/60'
                }`}
              >
                <div className="text-zinc-500 shrink-0 font-sans font-medium text-[10px]">
                  {displayTime}
                </div>
                
                <div className="shrink-0 flex items-center gap-1.5 font-sans">
                  <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold border ${
                    isLight 
                      ? 'bg-zinc-200/60 text-zinc-700 border-zinc-300' 
                      : 'bg-zinc-850 text-zinc-300 border-zinc-750'
                  }`}>
                    {friendlyRole}
                  </span>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded text-[8px] font-semibold uppercase tracking-wider">
                    {lg.action}
                  </span>
                </div>

                <div className="flex-1 space-y-0.5 font-sans">
                  <p className={`text-xs leading-relaxed font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>
                    {cleanDetails}
                  </p>
                  <p className="text-[9px] text-zinc-500 font-normal">
                    Operador: {lg.userName || 'Sistema Automático'}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default memo(RecentActivity);
