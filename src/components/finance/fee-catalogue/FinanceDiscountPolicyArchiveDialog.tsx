import React, { useState } from 'react';
import type { DiscountPolicySummary } from '../../../modules/finance/discount-policy-model.ts';

export interface FinanceDiscountPolicyArchiveDialogProps {
  policy: DiscountPolicySummary | null;
  onClose: () => void;
  onConfirm: (policyId: string) => Promise<void>;
}

export function FinanceDiscountPolicyArchiveDialog({
  policy,
  onClose,
  onConfirm,
}: FinanceDiscountPolicyArchiveDialogProps) {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 text-zinc-100">
        <h3 className="text-base font-bold text-white mb-2">Arquivar Política?</h3>
        <p className="text-xs text-zinc-400 mb-4">
          A política <span className="font-mono text-white">{policy.code}</span> não poderá mais ser concedida a novas cobranças. Descontos já aplicados permanecem intactos.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
          >
            {submitting ? 'A arquivar...' : 'Confirmar Arquivamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
