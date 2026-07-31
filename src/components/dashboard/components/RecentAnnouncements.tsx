import React, { memo } from 'react';
import { Announcement } from '../../../types';

interface RecentAnnouncementsProps {
  isLight: boolean;
  announcements: Announcement[];
  onViewCommunications: () => void;
}

function RecentAnnouncements({
  isLight,
  announcements,
  onViewCommunications,
}: RecentAnnouncementsProps) {
  return (
    <section 
      id="dashboard_recent_announcements_section"
      className={`p-6 rounded-2xl border ${
        isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5 shadow-md'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[9px] font-bold tracking-wider text-indigo-400 uppercase font-mono">Canais de Difusão</span>
          <h2 className={`text-base font-semibold font-display mt-0.5 ${isLight ? 'text-zinc-900' : 'text-white'}`}>
            Painel Geral de Comunicados Ativos
          </h2>
          <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Histórico real de avisos publicados para a comunidade escolar.
          </p>
        </div>
        <button 
          onClick={onViewCommunications} 
          className="text-xs text-indigo-500 hover:text-indigo-400 font-semibold cursor-pointer bg-transparent border-none outline-none"
        >
          Portal de Comunicações →
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {announcements.slice(0, 3).map(adv => (
          <div 
            key={adv.id} 
            className={`p-4 rounded-xl border flex flex-col justify-between ${
              isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/45 border-zinc-805'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${
                  isLight ? 'bg-zinc-200 text-zinc-750' : 'bg-zinc-800 text-zinc-300'
                }`}>
                  Canal: {adv.target}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">{adv.date}</span>
              </div>
              <h3 className={`text-xs font-semibold leading-snug line-clamp-1 ${isLight ? 'text-zinc-850' : 'text-zinc-200'}`}>
                {adv.title}
              </h3>
              <p className={`text-[11px] line-clamp-3 leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                {adv.content}
              </p>
            </div>
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-850/80 mt-3 flex items-center justify-between text-[10px] text-zinc-500">
              <span>Por: {adv.author}</span>
              <span className="uppercase font-semibold text-[9px]">{adv.role}</span>
            </div>
          </div>
        ))}
        {announcements.length === 0 && (
          <div className="col-span-3 text-center py-8 text-zinc-500 text-xs">
            Nenhum comunicado ativo publicado na base central.
          </div>
        )}
      </div>
    </section>
  );
}

export default memo(RecentAnnouncements);
