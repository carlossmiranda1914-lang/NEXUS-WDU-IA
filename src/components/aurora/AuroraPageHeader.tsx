import React from 'react';

export interface AuroraPageHeaderProps {
  title: string;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * A domain-neutral orientation header for material operational surfaces.
 * It communicates context and exposes only the actions supplied by the
 * authoritative feature surface.
 */
export function AuroraPageHeader({ title, description, eyebrow, actions }: AuroraPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--color-border-default)] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-secondary)]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
