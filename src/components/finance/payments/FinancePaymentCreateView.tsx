import React, { useEffect, useState } from 'react';
import type { ManualPaymentMethod, Payment } from '../../../modules/finance/payment-model.ts';
import { paymentClient } from '../../../modules/finance/payment-client.ts';
import { Money } from '../../../modules/finance/money.ts';
import type { FinancialAccount } from '../../../modules/finance/financial-account-model.ts';
import { FinanceOperationalContextClient } from '../../../modules/finance/finance-operational-context-client.ts';

export interface FinancePaymentCreateViewProps {
  theme?: string;
  financialAccount?: { id: string; accountNumber: string; name: string };
  payerPerson?: { personId: string; displayName: string } | null;
  defaultCurrency?: string;
  currencyOptions?: readonly string[];
  onSuccess: (payment: Payment) => void;
  onCancel: () => void;
}

const financialAccountClient = new FinanceOperationalContextClient();

export function FinancePaymentCreateView({
  theme = 'light',
  financialAccount,
  payerPerson,
  defaultCurrency,
  currencyOptions,
  onSuccess,
  onCancel,
}: FinancePaymentCreateViewProps) {
  const isLight = theme === 'light';

  const [method, setMethod] = useState<ManualPaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const supportedCurrencies = currencyOptions ? [...new Set(currencyOptions)] : [];
  const [currency, setCurrency] = useState(defaultCurrency && supportedCurrencies.includes(defaultCurrency) ? defaultCurrency : '');
  const [manualEvidenceRef, setManualEvidenceRef] = useState('');
  const [notes, setNotes] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [activeAccounts, setActiveAccounts] = useState<FinancialAccount[]>([]);
  const [selectedFinancialAccountId, setSelectedFinancialAccountId] = useState('');
  const [accountsLoading, setAccountsLoading] = useState(!financialAccount);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const selectedFinancialAccount = financialAccount ?? activeAccounts.find(account => account.id === selectedFinancialAccountId);
  const loadActiveAccounts = async () => {
    if (financialAccount) return;
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const accounts = await financialAccountClient.listFinancialAccounts('active');
      setActiveAccounts(accounts.filter(account => account.status === 'active'));
    } catch (err: any) {
      setActiveAccounts([]);
      setAccountsError(err?.message || 'Não foi possível carregar as contas financeiras ativas.');
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    void loadActiveAccounts();
  }, [financialAccount]);

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedFinancialAccount) {
      setError(accountsError
        ? 'Não é possível avançar enquanto as contas financeiras ativas não estiverem disponíveis.'
        : 'Selecione a conta financeira de destino para confirmar o recebimento.');
      return;
    }
    if (!currency) {
      setError('Selecione a moeda configurada para esta instituição.');
      return;
    }
    try {
      if (Money.parse(amount.trim(), currency).compare(Money.parse('0', currency)) <= 0) throw new Error('non-positive');
    } catch {
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
    if (!selectedFinancialAccount) {
      setError('Selecione a conta financeira de destino para confirmar o recebimento.');
      setShowReview(false);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await paymentClient.confirmManualPayment({
        method,
        amount: amount.trim(),
        currency: currency.trim(),
        financialAccountId: selectedFinancialAccount.id,
        payerPersonId: payerPerson?.personId,
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
            Registar recebimento
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
          Voltar
        </button>
      </div>

      {/* Context Banner: Selected Financial Account and Payer */}
      {selectedFinancialAccount && (
        <div
          data-testid="finance-payment-account-context"
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-850 border-zinc-750'
          }`}
        >
          <div>
            <span className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Conta financeira de destino
            </span>
            <p className={`text-sm font-bold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
              {selectedFinancialAccount.accountNumber} — {selectedFinancialAccount.name}
            </p>
          </div>
          {payerPerson && (
            <div className="sm:text-right">
              <span className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Responsável / Pagador
              </span>
              <p className={`text-sm font-medium ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>
                {payerPerson.displayName}
              </p>
            </div>
          )}
        </div>
      )}

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
            {!financialAccount && (
              <>
                <label className="block text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
                  Conta financeira de destino
                </label>
                {accountsLoading ? (
                  <p data-testid="finance-payment-account-loading" className="text-sm text-zinc-500">A carregar contas financeiras ativas…</p>
                ) : accountsError ? (
                  <div data-testid="finance-payment-account-load-error" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    <p>Não foi possível carregar as contas financeiras ativas.</p>
                    <button type="button" onClick={() => void loadActiveAccounts()} className="mt-2 rounded border border-rose-300 bg-white px-3 py-1 font-medium">Tentar novamente</button>
                  </div>
                ) : activeAccounts.length === 0 ? (
                  <p data-testid="finance-payment-account-empty" className="text-sm text-amber-700">Não existem contas financeiras ativas disponíveis para receber este valor.</p>
                ) : (
                  <select
                    value={selectedFinancialAccountId}
                    onChange={(e) => setSelectedFinancialAccountId(e.target.value)}
                    data-testid="finance-payment-account-select"
                    className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-emerald-500 ${
                      isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                    }`}
                  >
                    <option value="">Selecione a conta financeira de destino</option>
                    {activeAccounts.map(account => <option key={account.id} value={account.id}>{account.accountNumber} — {account.name}</option>)}
                  </select>
                )}
              </>
            )}
          </div>

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
                <option value="">Selecione a moeda configurada</option>
                {supportedCurrencies.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
              Referência do pagamento
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
              Data do recebimento
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
            {selectedFinancialAccount && (
              <div className="py-2 flex justify-between">
                <span className="text-zinc-500 text-sm">Conta financeira:</span>
                <span className="font-semibold text-sm">{selectedFinancialAccount.accountNumber} — {selectedFinancialAccount.name}</span>
              </div>
            )}
            {payerPerson && (
              <div className="py-2 flex justify-between">
                <span className="text-zinc-500 text-sm">Pagador:</span>
                <span className="font-semibold text-sm">{payerPerson.displayName}</span>
              </div>
            )}
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
                <span className="text-zinc-500 text-sm">Referência do pagamento:</span>
                <span className="font-mono text-sm">{manualEvidenceRef}</span>
              </div>
            )}
            <div className="py-2 flex justify-between">
              <span className="text-zinc-500 text-sm">Data do recebimento:</span>
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
