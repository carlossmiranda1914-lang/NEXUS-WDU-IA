import { useState, type ComponentProps } from 'react';
import AcademicYearManagement from './AcademicYearManagement';
import SystemConfigLegacy from './SystemConfigLegacy';

type Props = ComponentProps<typeof SystemConfigLegacy>;
type View = 'settings' | 'academic-year';

export default function SystemConfig(props: Props) {
  const canManageAcademicYear = props.currentRole === 'admin' || props.currentRole === 'director';
  const [view, setView] = useState<View>('settings');
  const unavailable = (
    <section role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-zinc-200">
      <h2 className="font-semibold text-amber-200">Configurações operacionais indisponíveis</h2>
      <p className="mt-2">A administração legada de utilizadores, permissões, sincronização e reposição de dados não está ligada a uma autoridade institucional autorizada. Nenhuma alteração foi aplicada.</p>
    </section>
  );

  if (!canManageAcademicYear) {
    return unavailable;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto border-b border-zinc-800 text-xs font-semibold" role="tablist" aria-label="Configurações institucionais">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'settings'}
          onClick={() => setView('settings')}
          className={`border-b-2 px-1 pb-3 transition-colors ${view === 'settings' ? 'border-indigo-500 text-indigo-300' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          Configurações atuais
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'academic-year'}
          onClick={() => setView('academic-year')}
          className={`border-b-2 px-1 pb-3 transition-colors ${view === 'academic-year' ? 'border-emerald-500 text-emerald-300' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          Ano Letivo
        </button>
      </div>

      {view === 'academic-year' ? (
        <AcademicYearManagement currentRole={props.currentRole} firebaseUser={props.firebaseUser} />
      ) : (
        unavailable
      )}
    </div>
  );
}
