import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, X, AlertCircle, AlertTriangle, ShieldCheck, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import type { Theme, DocumentDto, DocumentOperationalAvailability } from './types.ts';
import { authorizeDeletion, executeDeletion, reconcileDeletion, generateIdempotencyKey } from './api.ts';

interface DocumentDeletionModalProps {
  isOpen: boolean;
  theme: Theme;
  document: DocumentDto;
  operationalAvailability?: DocumentOperationalAvailability;
  onClose: () => void;
  onSuccess: () => void;
}

type DeletionStage = 'confirm' | 'authorizing' | 'authorized' | 'executing' | 'completed' | 'reconcile' | 'error';

export default function DocumentDeletionModal({
  isOpen,
  theme,
  document,
  operationalAvailability,
  onClose,
  onSuccess,
}: DocumentDeletionModalProps) {
  const isLight = theme === 'light';
  const isDeleteUnavailable = operationalAvailability?.canDelete === false;

  const [stage, setStage] = useState<DeletionStage>('confirm');
  const [authorizationId, setAuthorizationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  const authIdemKeyRef = useRef<string>(generateIdempotencyKey('del-auth'));
  const execIdemKeyRef = useRef<string>(generateIdempotencyKey('del-exec'));

  const activeHoldCount = document.activeHolds.length;
  const isBlockedByHold = activeHoldCount > 0;

  // Escape key closes modal (only when not actively executing)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isBusy = stage === 'authorizing' || stage === 'executing';
      if (e.key === 'Escape' && isOpen && !isBusy) {
        onClose();
      }
    },
    [isOpen, stage, onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
    if (isDeleteUnavailable) {
      setErrorMessage('Eliminação governada ainda não está configurada nesta instalação.');
      return;
    }
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
        }, 1200);
      }
    } catch (err) {
      setStage('error');
      setErrorMessage(err instanceof Error ? err.message : 'Falha na execução da eliminação física.');
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
      if (!res.reconciliationRequired) {
        setStage('completed');
        setTimeout(() => {
          onSuccess();
        }, 1200);
      } else {
        setErrorMessage('A reconciliação ainda acusa discrepâncias de armazenamento. Contacte o administrador.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao reconciliar eliminação.');
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
      onClick={(e) => {
        const isBusy = stage === 'authorizing' || stage === 'executing';
        if (e.target === e.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-all ${
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
              <h2 id="deletion-modal-title" className="text-base font-bold">
                Eliminação Governada de Documento
              </h2>
              <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                DOC-{document.id.slice(0, 8).toUpperCase()} (v{document.currentVersion?.versionNumber || 1})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={stage === 'executing' || stage === 'authorizing'}
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

        <div className="mt-5 space-y-4 text-xs leading-relaxed">
          {isBlockedByHold && (
            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Eliminação Bloqueada por Regra Institucional</p>
                <p className="mt-0.5">
                  Este documento possui <strong>{activeHoldCount} bloqueio(s) de retenção ativo(s)</strong>.
                  Para proceder à eliminação, os bloqueios devem ser formalmente libertados pela respetiva autoridade.
                </p>
              </div>
            </div>
          )}

          {stage === 'confirm' && (
            <div className="space-y-3">
              <p className={isLight ? 'text-zinc-600' : 'text-zinc-300'}>
                O processo de eliminação é <strong>irreversível</strong> e obedece ao protocolo institucional de expurgo de dois passos:
              </p>
              <ol className="list-decimal pl-5 space-y-1.5 text-zinc-500">
                <li>Validação de autoridade, retenção e bloqueios legais;</li>
                <li>Pseudonimização e destruição criptográfica do ficheiro físico.</li>
              </ol>
            </div>
          )}

          {stage === 'authorized' && (
            <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Autorização de Eliminação Concedida</p>
                <p className="mt-0.5">
                  As políticas de retenção confirmam a elegibilidade deste documento para destruição definitiva.
                </p>
              </div>
            </div>
          )}

          {stage === 'completed' && (
            <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
              <p className="font-bold text-sm">Documento Eliminado com Sucesso</p>
              <p className="text-[11px]">O ficheiro físico foi destruído e a versão foi atualizada no arquivo.</p>
            </div>
          )}

          {stage === 'reconcile' && (
            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 space-y-2">
              <p className="font-bold">Reconciliação Pendente</p>
              <p>A eliminação física requer verificação de sincronização adicional.</p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-200/50 dark:border-white/5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={stage === 'executing' || stage === 'authorizing'}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isLight
                ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                : 'border-white/10 bg-zinc-800 text-zinc-300 hover:bg-white/5'
            } disabled:opacity-40`}
          >
            Cancelar
          </button>

          {stage === 'confirm' && (
            <button
              type="button"
              onClick={handleAuthorize}
              disabled={isBlockedByHold || loading || isDeleteUnavailable}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Autorizar Eliminação
            </button>
          )}

          {stage === 'authorized' && (
            <button
              type="button"
              onClick={handleExecute}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-700 hover:bg-rose-600 text-white transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirmar e Destruir Ficheiro
            </button>
          )}

          {stage === 'reconcile' && (
            <button
              type="button"
              onClick={handleReconcile}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all cursor-pointer flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Reconciliar Eliminação
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
