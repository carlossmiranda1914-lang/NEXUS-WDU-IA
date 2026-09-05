import React, { useState } from 'react';
import type { ManualPaymentMethod, Payment } from '../../../modules/finance/payment-model.ts';
import { paymentClient } from '../../../modules/finance/payment-client.ts';

export interface FinancePaymentCreateViewProps {
  theme?: string;
  onSuccess: (payment: Payment) => void;
  onCancel: () => void;
}

export function FinancePaymentCreateView({
  theme = 'light',
  onSuccess,
  onCancel,
}: FinancePaymentCreateViewProps) {
  const isLight = theme === 'light';

  const [method, setMethod] = useState<ManualPaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [manualEvidenceRef, setManualEvidenceRef] = useState('');
  const [notes, setNotes] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const num = Number.parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) {
      setError('Introduza um montante positivo válido.');
      return;
    }

    if ((method === 'bank_transfer' || method === 'external_reference') && !manualEvidenceRef.trim()) {
      setError('Referência de comprovativo/transferência é obrigatória para este método.');
      return;
    }

    setShowReview(true);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await paymentClient.confirmManualPayment({
        method,
        amount: amount.trim(),
        currency: currency.trim(),
        manualEvidenceRef: manualEvidenceRef.trim() || undefined,
        notes: notes.trim() || undefined,
        effectiveAt: new Date(effectiveDate),
      });
      onSuccess(res.payment);
    } catch (err: any) {
      setError(err?.message || 'Falha ao confirmar recebimento.');
      setShowReview(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
            Registar Recebimento Manual / Offline
          </h2>
          <p className={`text-sm ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Registe a entrada de valores recebidos por numerário ou transferência.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className={`px-3 py-1.5 text-sm rounded-lg border ${
            isLight ? 'border-zinc-300 text-zinc-600 hover:bg-zinc-50' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          Voltar à Lista
        </button>
      </div>

      {/* Info notice */}
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-3">
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <span className="font-semibold">Princípio de Não-Alocação:</span> Este registo cria uma prova de valor recebido (estado <em>Confirmado / Não aplicado</em>). O montante não liquidará automaticamente obrigações financeiras até à execução da respetiva alocação.
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Form */}
      {!showReview ? (
        <form onSubmit={handleValidate} className={`p-6 rounded-xl border space-y-5 ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'}`}>
          <div>
            <label className="block text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
              Método de Pagamento
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as ManualPaymentMethod)}
              data-testid="finance-payment-method-select"
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-emerald-500 ${
                isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
              }`}
            >
              <option value="cash">Numerário (Caixa)</option>
              <option value="bank_transfer">Transferência Bancária</option>
              <option value="external_reference">Referência Externa Verificada</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
                Montante
              </label>
              <input
                type="text"
                placeholder="Ex: 150.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="finance-payment-amount-input"
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-emerald-500 font-mono ${
                  isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
                Moeda
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                data-testid="finance-payment-currency-select"
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-emerald-500 font-semibold ${
                  isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                }`}
              >
                <option value="EUR">EUR (€)</option>
                <option value="AOA">AOA (Kz)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
              Referência / Comprovativo
              {method !== 'cash' && <span className="text-rose-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              placeholder={method === 'cash' ? 'Opcional para numerário' : 'Ex: TRF-BFA-992211'}
              value={manualEvidenceRef}
              onChange={(e) => setManualEvidenceRef(e.target.value)}
              data-testid="finance-payment-ref-input"
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-emerald-500 ${
                isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
              Data Efetiva
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              data-testid="finance-payment-date-input"
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-emerald-500 ${
                isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
              }`}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
              Notas Operacionais
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Recebido na secretaria polo central"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="finance-payment-notes-input"
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-emerald-500 ${
                isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
              }`}
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className={`px-4 py-2 text-sm font-medium rounded-lg border ${
                isLight ? 'border-zinc-300 text-zinc-700 hover:bg-zinc-50' : 'border-zinc-700 text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="finance-payment-review-btn"
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
            >
              Rever e Confirmar
            </button>
          </div>
        </form>
      ) : (
        /* Review Screen */
        <div className={`p-6 rounded-xl border space-y-5 ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'}`}>
          <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
            Rever Recebimento antes de Gravar
          </h3>

          <div className={`p-4 rounded-lg divide-y ${isLight ? 'bg-zinc-50 divide-zinc-200' : 'bg-zinc-800 divide-zinc-700'}`}>
            <div className="py-2 flex justify-between">
              <span className="text-zinc-500 text-sm">Método:</span>
              <span className="font-semibold text-sm capitalize">{method.replace('_', ' ')}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-zinc-500 text-sm">Montante:</span>
              <span className="font-bold text-base text-emerald-600 dark:text-emerald-400 font-mono">
                {amount} {currency}
              </span>
            </div>
            {manualEvidenceRef && (
              <div className="py-2 flex justify-between">
                <span className="text-zinc-500 text-sm">Comprovativo:</span>
                <span className="font-mono text-sm">{manualEvidenceRef}</span>
              </div>
            )}
            <div className="py-2 flex justify-between">
              <span className="text-zinc-500 text-sm">Data Efetiva:</span>
              <span className="text-sm">{effectiveDate}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-zinc-500 text-sm">Estado resultante:</span>
              <span className="text-sm font-semibold text-emerald-600">Confirmado (Não aplicado)</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowReview(false)}
              disabled={submitting}
              className={`px-4 py-2 text-sm font-medium rounded-lg border ${
                isLight ? 'border-zinc-300 text-zinc-700 hover:bg-zinc-50' : 'border-zinc-700 text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              Corrigir Dados
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              data-testid="finance-payment-confirm-btn"
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors flex items-center gap-2"
            >
              {submitting ? 'A registar...' : 'Confirmar Recebimento'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
