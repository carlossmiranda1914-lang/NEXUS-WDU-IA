import React, { useState, useRef, useEffect } from 'react';
import { Trash2, X, AlertCircle, AlertTriangle, ShieldCheck, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import type { Theme, DocumentDto } from './types.ts';
import { authorizeDeletion, executeDeletion, reconcileDeletion, generateIdempotencyKey } from './api.ts';

interface DocumentDeletionModalProps {
  isOpen: boolean;
  theme: Theme;
  document: DocumentDto;
  onClose: () => void;
  onSuccess: () => void;
}

type DeletionStage = 'confirm' | 'authorizing' | 'authorized' | 'executing' | 'completed' | 'reconcile' | 'error';

export default function DocumentDeletionModal({
  isOpen,
  theme,
  document,
  onClose,
  onSuccess,
}: DocumentDeletionModalProps) {
  const isLight = theme === 'light';

  const [stage, setStage] = useState<DeletionStage>('confirm');
  const [authorizationId, setAuthorizationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  const authIdemKeyRef = useRef<string>(generateIdempotencyKey('del-auth'));
  const execIdemKeyRef = useRef<string>(generateIdempotencyKey('del-exec'));

  const activeHoldCount = document.activeHolds.length;
  const isBlockedByHold = activeHoldCount > 0;

  useEffect(() => {
    if (isOpen) {
      setStage('confirm');
      setAuthorizationId(null);
      setErrorMessage(null);
      setReconciliationRequired(false);
      setLoading(false);
      authIdemKeyRef.current = generateIdempotencyKey('del-auth');
      execIdemKeyRef.current = generateIdempotencyKey('del-exec');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuthorize = async () => {
    setLoading(true);
    setErrorMessage(null);
    setStage('authorizing');

    try {
      const res = await authorizeDeletion(
        document.id,
        document.currentVersion?.id,
        authIdemKeyRef.current,
      );

      setAuthorizationId(res.authorizationId);
      setStage('authorized');
    } catch (err) {
      setStage('error');
      setErrorMessage(err instanceof Error ? err.message : 'Falha na autorização de eliminação.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!authorizationId) return;

    setLoading(true);
    setErrorMessage(null);
    setStage('executing');

    try {
      const res = await executeDeletion(
        document.id,
        authorizationId,
        execIdemKeyRef.current,
      );

      if (res.reconciliationRequired) {
        setReconciliationRequired(true);
        setStage('reconcile');
      } else {
        setStage('completed');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err) {
      setStage('error');
      setErrorMessage(err instanceof Error ? err.message : 'Falha na execução de eliminação.');
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!authorizationId) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await reconcileDeletion(document.id, authorizationId);
      if (res.reconciliationRequired) {
        setReconciliationRequired(true);
        setStage('reconcile');
        setErrorMessage(
          'A reconciliação ainda é necessária: a confirmação física de expurgo no armazenamento permanece pendente.',
        );
      } else {
        setReconciliationRequired(false);
        setStage('completed');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err) {
      setStage('error');
      setErrorMessage(err instanceof Error ? err.message : 'Falha na reconciliação de eliminação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deletion-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
    >
      <div
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
          isLight
            ? 'bg-white border-zinc-200 text-zinc-900'
            : 'bg-zinc-900 border-white/10 text-zinc-100'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200/50 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="deletion-modal-title" className="text-lg font-bold">
                Eliminação Governada de Documento
              </h2>
              <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Processo de expurgo governado com integridade criptográfica
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isLight
                ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-600'
                : 'border-white/10 hover:bg-white/5 text-zinc-400'
            } disabled:opacity-40`}
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {isBlockedByHold ? (
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4" />
                Eliminação Bloqueada por Bloqueio Ativo
              </div>
              <p className="leading-relaxed">
                Este documento possui <strong>{activeHoldCount} bloqueio(s) de retenção ativo(s)</strong>.
                A eliminação governada é estritamente proibida enquanto houver impedimento legal ou administrativo em vigor.
              </p>
            </div>
          ) : (
            <>
              {stage === 'confirm' && (
                <div className="space-y-3">
                  <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                    isLight ? 'bg-slate-50 border-zinc-200 text-zinc-700' : 'bg-zinc-950 border-white/5 text-zinc-300'
                  }`}>
                    <p><span className="font-semibold">Documento:</span> {document.category} (ID: {document.id.slice(0, 8)}...)</p>
                    <p><span className="font-semibold">Versão Atual:</span> v{document.currentVersion?.versionNumber || 1}</p>
                    <p><span className="font-semibold">Política de Retenção:</span> {document.retention ? `Retenção até ${document.retention.retainUntil}` : 'Sem política explícita'}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      A eliminação é um ato irreversível. Serão destruídos os ficheiros físicos de armazenamento e os dados pessoais serão pseudonimizados criptograficamente.
                    </p>
                  </div>
                </div>
              )}

              {stage === 'authorized' && (
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    Autorização de Eliminação Aprovada
                  </div>
                  <p className="leading-relaxed">
                    A política de retenção autorizou a eliminação. Clique em <strong>Executar Eliminação</strong> para concluir a destruição física do conteúdo.
                  </p>
                </div>
              )}

              {stage === 'reconcile' && (
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    Reconciliação Operacional Necessária
                  </div>
                  <p className="leading-relaxed">
                    A eliminação física requer confirmação adicional de integridade no armazenamento. Clique em <strong>Reconciliar</strong>.
                  </p>
                </div>
              )}

              {stage === 'completed' && (
                <div className="py-6 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <p className="text-base font-bold text-emerald-600">Eliminação Executada com Sucesso</p>
                </div>
              )}

              {errorMessage && (
                <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-200/50 dark:border-white/5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isLight
                ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                : 'border-white/10 bg-zinc-800 text-zinc-300 hover:bg-white/5'
            } disabled:opacity-40`}
          >
            {stage === 'completed' ? 'Fechar' : 'Cancelar'}
          </button>

          {!isBlockedByHold && stage === 'confirm' && (
            <button
              type="button"
              onClick={handleAuthorize}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Autorizar Eliminação
            </button>
          )}

          {!isBlockedByHold && stage === 'authorized' && (
            <button
              type="button"
              onClick={handleExecute}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Executar Eliminação Imediata
            </button>
          )}

          {!isBlockedByHold && stage === 'reconcile' && (
            <button
              type="button"
              onClick={handleReconcile}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Reconciliar Eliminação
            </button>
          )}

          {stage === 'error' && (
            <button
              type="button"
              onClick={reconciliationRequired ? handleReconcile : authorizationId ? handleExecute : handleAuthorize}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
