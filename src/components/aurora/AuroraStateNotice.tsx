import React from 'react';

export type AuroraStateTone = 'info' | 'success' | 'warning' | 'danger';

const toneClass: Record<AuroraStateTone, string> = {
  info: 'border-[var(--color-state-info)]/30 bg-[var(--color-state-info)]/10 text-[var(--color-text-primary)]',
  success: 'border-[var(--color-state-success)]/30 bg-[var(--color-state-success)]/10 text-[var(--color-text-primary)]',
  warning: 'border-[var(--color-state-warning)]/40 bg-[var(--color-state-warning)]/10 text-[var(--color-text-primary)]',
  danger: 'border-[var(--color-state-danger)]/30 bg-[var(--color-state-danger)]/10 text-[var(--color-text-primary)]',
};

export function AuroraStateNotice({ tone, title, children, action }: { tone: AuroraStateTone; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  const role = tone === 'danger' ? 'alert' : 'status';
  return <section role={role} className={`flex items-start justify-between gap-4 rounded-xl border p-4 text-sm ${toneClass[tone]}`}>
    <div><strong className="block font-semibold">{title}</strong><div className="mt-1">{children}</div></div>{action && <div className="shrink-0">{action}</div>
  </section>;
}
