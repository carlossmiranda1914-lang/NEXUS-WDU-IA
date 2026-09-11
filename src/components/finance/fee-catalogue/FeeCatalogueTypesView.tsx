import React, { useState, useEffect, useCallback } from 'react';
import {
  feeCatalogueClient,
  FeeCatalogueApiError,
  type FeeTypeRecord,
} from '../../../modules/finance/fee-catalogue-client.ts';

export interface FeeCatalogueTypesViewProps {
  onBack: () => void;
}

export function FeeCatalogueTypesView({ onBack }: FeeCatalogueTypesViewProps) {
  const [types, setTypes] = useState<FeeTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [codePrefix, setCodePrefix] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await feeCatalogueClient.listTypes('all')) as FeeTypeRecord[];
      setTypes(data);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar tipos de emolumento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = displayName.trim();
    const cleanPrefix = codePrefix.trim().toUpperCase();

    if (!cleanName) {
      setFormError('O nome do tipo de emolumento é obrigatório.');
      return;
    }
    if (!cleanPrefix || !/^[A-Z0-9]{2,8}$/.test(cleanPrefix)) {
      setFormError('O prefixo deve ter entre 2 e 8 caracteres alfanuméricos (ex: LAB, CURS).');
      return;
    }

    setSubmitting(true);
    try {
      await feeCatalogueClient.createType({
        displayName: cleanName,
        codePrefix: cleanPrefix,
      });
      setDisplayName('');
      setCodePrefix('');
      await loadTypes();
    } catch (err: any) {
      if (err instanceof FeeCatalogueApiError && err.status === 409) {
        setFormError(`Já existe um tipo com o prefixo ${cleanPrefix} nesta instituição.`);
      } else {
        setFormError(err?.message || 'Erro ao criar tipo de emolumento');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: FeeTypeRecord) => {
    setError(null);
    try {
      await feeCatalogueClient.setTypeStatus(item.id, item.status === 'inactive');
      await loadTypes();
    } catch (err: any) {
      setError(err?.message || 'Erro ao alterar estado do tipo');
    }
  };

  return (
    <main className="p-6 max-w-4xl mx-auto text-zinc-100">
      {/* Top contextual back navigation & header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mb-3 font-medium cursor-pointer"
        >
          <span>←</span> Catálogo de Emolumentos
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800 gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Tipos de Emolumento</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Classificações financeiras institucionais e prefixos para geração automática de referências operacionais.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold uppercase tracking-wider text-rose-400 text-[10px]">Erro Operacional</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Add Custom Fee Type Card */}
      <section className="mb-8 border border-zinc-800 rounded-xl p-5 bg-zinc-900/40 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Novo Tipo Personalizado
        </h3>

        {formError && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-start justify-between gap-2">
            <p>{formError}</p>
            <button
              type="button"
              onClick={() => setFormError(null)}
              className="text-rose-400 hover:text-rose-200 text-xs px-1.5"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-400 mb-1 font-medium">Nome do Tipo</label>
            <input
              required
              value={displayName}
              placeholder="Ex: Laboratório de Informática"
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm focus:border-emerald-500 focus:outline-hidden text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1 font-medium">Prefixo do Código</label>
            <input
              required
              maxLength={8}
              value={codePrefix}
              placeholder="Ex: LAB"
              onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
              className="w-full p-2.5 border border-zinc-700 rounded-lg bg-zinc-950 text-sm font-mono uppercase focus:border-emerald-500 focus:outline-hidden text-white"
            />
          </div>

          <div className="sm:col-span-3 flex items-center justify-between pt-1">
            <span className="text-[11px] text-zinc-500 font-mono">
              {codePrefix.trim() ? `Referência gerada: ${codePrefix.trim().toUpperCase()}-000001` : 'Prefixo gera códigos automáticos (ex: PROP-000001)'}
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {submitting ? 'A registar...' : '+ Adicionar Tipo'}
            </button>
          </div>
        </form>
      </section>

      {/* Types List */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Tipos Disponíveis ({types.length})
        </h3>

        {loading && (
          <div className="py-12 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-zinc-400">A carregar tipos registados...</p>
          </div>
        )}

        {!loading && types.length > 0 && (
          <div className="border border-zinc-800 rounded-xl divide-y divide-zinc-800/80 bg-zinc-900/30 overflow-hidden">
            {types.map((t) => (
              <div key={t.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-xs px-2.5 py-1 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold">
                    {t.codePrefix}
                  </span>
                  <span className="text-sm font-medium text-zinc-100">{t.displayName}</span>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${
                    t.source === 'nexus_base'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  }`}>
                    {t.source === 'nexus_base' ? 'Nexus Base' : 'Instituição'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    t.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                  }`}>
                    {t.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => void handleToggleStatus(t)}
                    className={`px-3 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                      t.status === 'active'
                        ? 'border-zinc-700 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-300'
                        : 'border-emerald-700/60 hover:bg-emerald-950/40 text-emerald-400'
                    }`}
                  >
                    {t.status === 'active' ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end pt-6">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
        >
          Voltar ao catálogo
        </button>
      </div>
    </main>
  );
}

export default FeeCatalogueTypesView;
