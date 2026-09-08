import React, { useState } from 'react';
import type { DiscountPolicySummary } from '../../../modules/finance/discount-policy-model.ts';

export interface FinanceDiscountPolicyArchiveDialogProps {
  policy: DiscountPolicySummary | null;
  theme?: string;
  onClose: () => void;
  onConfirm: (policyId: string) => Promise<void>;
}

export function FinanceDiscountPolicyArchiveDialog({
  policy,
  theme = 'light',
  onClose,
  onConfirm,
}: FinanceDiscountPolicyArchiveDialogProps) {
  const isLight = theme === 'light';
  const [submitting, setSubmitting] = useState(false);

  if (!policy) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(policy.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Confirmar arquivamento de ${policy.code}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl transition-all ${
          isLight
            ? 'bg-white border-zinc-200 text-zinc-900'
            : 'bg-zinc-900 border-zinc-800 text-zinc-100'
        }`}
      >
        {/* Financial Header Grammar (UX-01) */}
        <div
          className={`flex items-start justify-between border-b px-6 py-4 ${
            isLight ? 'border-zinc-100 bg-zinc-50/70' : 'border-zinc-800 bg-zinc-950/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center justify-center h-9 w-9 rounded-xl font-bold text-sm ${
                isLight ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
              }`}
            >
              📦
            </span>
            <div>
              <h3 className="text-base font-bold tracking-tight">Arquivar Política?</h3>
              <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Desativação da política para novas concessões.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors ${
              isLight ? 'hover:bg-zinc-100' : 'hover:bg-zinc-800'
            }`}
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* Policy Context Card */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isLight ? 'bg-zinc-50 border-zinc-200/80 text-zinc-800' : 'bg-zinc-950/60 border-zinc-800 text-zinc-200'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold">{policy.code}</span>
                <span className="font-medium">{policy.latestVersion.name}</span>
              </div>
              <p className={`text-[11px] mt-0.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Versão {policy.latestVersion.version}
              </p>
            </div>
            <span className="font-mono font-bold text-sm">
              {policy.latestVersion.calculationMode === 'percentage'
                ? `${policy.latestVersion.value}%`
                : `${policy.latestVersion.value} ${policy.latestVersion.currency || 'EUR'}`}
            </span>
          </div>

          {/* Consequence Notice */}
          <div
            className={`p-3 rounded-xl border text-xs ${
              isLight
                ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                : 'bg-amber-950/30 border-amber-800/80 text-amber-300'
            }`}
          >
            <p className="font-semibold mb-1">Impacto Financeiro:</p>
            <p className="leading-relaxed">
              A política <strong className="font-mono">{policy.code}</strong> não poderá mais ser concedida a novas cobranças. Descontos e compensações históricas já registados em PostgreSQL permanecem imutáveis.
            </p>
          </div>

          {/* Action Footer */}
          <div
            className={`flex items-center justify-end gap-3 pt-4 border-t ${
              isLight ? 'border-zinc-100' : 'border-zinc-800'
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                isLight
                  ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirm}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              {submitting ? 'A arquivar...' : 'Confirmar Arquivamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
