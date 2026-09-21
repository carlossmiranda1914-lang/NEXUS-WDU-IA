import React from 'react';
import type { FinanceOperationalContext } from '../../../modules/finance/finance-operational-context-model.ts';
import type { FinancialAccount } from '../../../modules/finance/financial-account-model.ts';

export interface FinanceOperationalContextHeaderProps {
  theme?: string;
  context: FinanceOperationalContext;
  accounts: FinancialAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  onClearAccount?: () => void;
  onRegisterPayment: () => void;
  loading?: boolean;
}

export function FinanceOperationalContextHeader({
  theme = 'light',
  context,
  accounts,
  selectedAccountId,
  onSelectAccount,
  onClearAccount,
  onRegisterPayment,
  loading = false,
}: FinanceOperationalContextHeaderProps) {
  const isLight = theme === 'light';
  const { financialAccount, responsiblePerson, students } = context;

  return (
    <div
      data-testid="finance-operational-header"
      className={`p-6 rounded-xl border transition-all ${
        isLight
          ? 'bg-white border-zinc-200 shadow-sm'
          : 'bg-zinc-900 border-zinc-800'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Account Identification & Selector */}
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`px-2.5 py-1 text-xs font-semibold rounded-md uppercase tracking-wider ${
                isLight ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              Conta financeira
            </span>

            <span
              data-testid="finance-account-status-badge"
              className={`px-2.5 py-1 text-xs font-medium rounded-full flex items-center gap-1.5 ${
                financialAccount.status === 'active'
                  ? isLight
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/60'
                  : isLight
                  ? 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  financialAccount.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-400'
                }`}
              />
              {financialAccount.status === 'active' ? 'Ativa' : 'Inativa'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h2
              data-testid="finance-account-title"
              className={`text-xl font-bold tracking-tight ${
                isLight ? 'text-zinc-900' : 'text-zinc-50'
              }`}
            >
              {financialAccount.accountNumber} — {financialAccount.name}
            </h2>

            {accounts.length > 1 && (
              <div className="sm:ml-4">
                <select
                  value={selectedAccountId}
                  onChange={(e) => onSelectAccount(e.target.value)}
                  disabled={loading}
                  data-testid="finance-account-selector"
                  className={`text-sm rounded-lg px-3 py-1.5 border font-medium outline-none transition-colors ${
                    isLight
                      ? 'bg-zinc-50 border-zinc-300 text-zinc-800 focus:border-emerald-600'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-200 focus:border-emerald-400'
                  }`}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountNumber} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {onClearAccount && (
              <button
                type="button"
                onClick={onClearAccount}
                data-testid="finance-switch-account-btn"
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                  isLight
                    ? 'border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                    : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                Trocar de conta
              </button>
            )}
          </div>
        </div>

        {/* Primary Action: Registar recebimento */}
        <div>
          <button
            type="button"
            onClick={onRegisterPayment}
            disabled={financialAccount.status !== 'active' || loading}
            data-testid="finance-register-payment-button"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Registar recebimento
          </button>
        </div>
      </div>

      {/* Contextual Parties: Responsável Financeiro + Alunos Associados */}
      <div className={`mt-6 pt-5 border-t grid grid-cols-1 md:grid-cols-2 gap-6 ${
        isLight ? 'border-zinc-100' : 'border-zinc-800/80'
      }`}>
        {/* Responsável Financeiro */}
        <div>
          <span className={`text-xs font-semibold uppercase tracking-wider ${
            isLight ? 'text-zinc-500' : 'text-zinc-400'
          }`}>
            Responsável financeiro
          </span>
          <div className="mt-1.5 flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950 text-emerald-300'
            }`}>
              {responsiblePerson?.displayName ? responsiblePerson.displayName.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <p
                data-testid="finance-responsible-person-name"
                className={`text-sm font-medium ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}
              >
                {responsiblePerson?.displayName || 'Não atribuído'}
              </p>
              {responsiblePerson?.role && (
                <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  {responsiblePerson.role === 'primary_debtor' ? 'Responsável principal' : responsiblePerson.role}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Alunos Associados */}
        <div>
          <span className={`text-xs font-semibold uppercase tracking-wider ${
            isLight ? 'text-zinc-500' : 'text-zinc-400'
          }`}>
            Alunos associados
          </span>
          <div className="mt-1.5">
            {students.length === 0 ? (
              <p className={`text-sm italic ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Nenhum aluno associado a esta conta.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {students.map((stu) => (
                  <div
                    key={stu.personId}
                    data-testid={`finance-student-badge-${stu.personId}`}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                      isLight
                        ? 'bg-zinc-50 border-zinc-200 text-zinc-800'
                        : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-200'
                    }`}
                  >
                    <span className="font-medium">{stu.displayName}</span>
                    {stu.enrollmentStatus && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          stu.enrollmentStatus === 'active'
                            ? isLight
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-emerald-900/50 text-emerald-300'
                            : isLight
                            ? 'bg-zinc-200 text-zinc-700'
                            : 'bg-zinc-700 text-zinc-300'
                        }`}
                      >
                        Matrícula: {stu.enrollmentStatus === 'active' ? 'Ativa' : stu.enrollmentStatus}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
