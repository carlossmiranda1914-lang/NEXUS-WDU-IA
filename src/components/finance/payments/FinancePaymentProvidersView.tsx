import React, { useState, useEffect } from 'react';
import type { PaymentProviderConfigPublicProjection, PaymentProviderKey } from '../../../modules/finance/payment-provider-model.ts';
import { paymentClient } from '../../../modules/finance/payment-client.ts';

export interface FinancePaymentProvidersViewProps {
  theme?: string;
  onBack: () => void;
}

export function FinancePaymentProvidersView({
  theme = 'light',
  onBack,
}: FinancePaymentProvidersViewProps) {
  const isLight = theme === 'light';

  const [configs, setConfigs] = useState<PaymentProviderConfigPublicProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await paymentClient.listProviderConfigs();
      setConfigs(list);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar configurações de provedores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const defaultProviders: Array<{
    key: PaymentProviderKey;
    title: string;
    description: string;
    contractStatus: string;
    regionalRail: string;
  }> = [
    {
      key: 'adyen',
      title: 'Adyen Payment Gateway',
      description: 'Cartão de crédito/débito internacional e MB WAY (Portugal / Global).',
      contractStatus: 'SANDBOX',
      regionalRail: 'Global / Portugal',
    },
    {
      key: 'emis_multicaixa',
      title: 'EMIS / Rede MULTICAIXA',
      description: 'MULTICAIXA Express, GPO e Pagamento por Referência (Angola).',
      contractStatus: 'AWAITING_AUTHORIZED_PROTOCOL',
      regionalRail: 'Angola (AOA)',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
            Provedores de Pagamento
          </h2>
          <p className={`text-sm ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Configuração institucional de gateways e canais de pagamento autorizados.
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          data-testid="finance-providers-back-btn"
          className={`px-3 py-1.5 text-sm rounded-lg border ${
            isLight ? 'border-zinc-300 text-zinc-600 hover:bg-zinc-50' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          Voltar a Recebimentos
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-zinc-500">A carregar provedores...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {defaultProviders.map((def) => {
            const currentCfg = configs.find((c) => c.providerKey === def.key);
            const isActive = currentCfg?.status === 'active';

            return (
              <div
                key={def.key}
                data-testid={`provider-card-${def.key}`}
                className={`p-6 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                  isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">{def.title}</h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-mono">
                      {def.contractStatus}
                    </span>
                    {isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                        Inativo
                      </span>
                    )}
                  </div>

                  <p className={`text-sm ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    {def.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 pt-1">
                    <div><strong>Região:</strong> {def.regionalRail}</div>
                    {currentCfg && (
                      <>
                        <div><strong>Ambiente:</strong> {currentCfg.environment}</div>
                        <div><strong>Moedas:</strong> {currentCfg.supportedCurrencies.join(', ')}</div>
                        <div><strong>Métodos:</strong> {currentCfg.enabledMethods.join(', ')}</div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <span className="text-xs text-zinc-400 italic">
                    Credenciais geridas em cofre seguro no servidor.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
