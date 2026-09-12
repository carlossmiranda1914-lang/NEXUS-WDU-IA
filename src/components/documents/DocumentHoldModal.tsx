import React, { useState, useRef, useEffect } from 'react';
import { Shield, X, AlertCircle, CheckCircle2, Lock, Unlock, Loader2 } from 'lucide-react';
import type { Theme, DocumentDto, HoldDto } from './types.ts';
import { placeHold, releaseHold, generateIdempotencyKey } from './api.ts';

interface DocumentHoldModalProps {
  isOpen: boolean;
  theme: Theme;
  document: DocumentDto;
  mode: 'place' | 'release';
  targetHold?: HoldDto | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DocumentHoldModal({
  isOpen,
  theme,
  document,
  mode,
  targetHold,
  onClose,
  onSuccess,
}: DocumentHoldModalProps) {
  const isLight = theme === 'light';

  const [holdType, setHoldType] = useState<'legal' | 'administrative'>('legal');
  const [authority, setAuthority] = useState('');
  const [reason, setReason] = useState('');
  const [releaseReason, setReleaseReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey(mode === 'place' ? 'hold' : 'rel-hold'));

  useEffect(() => {
    if (isOpen) {
      setHoldType('legal');
      setAuthority('');
      setReason('');
      setReleaseReason('');
      setLoading(false);
      setErrorMessage(null);
      idempotencyKeyRef.current = generateIdempotencyKey(mode === 'place' ? 'hold' : 'rel-hold');
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (mode === 'place') {
        if (!authority.trim() || authority.trim().length < 4) {
          throw new Error('A autoridade emitente é obrigatória (mínimo 4 caracteres).');
        }
        if (!reason.trim() || reason.trim().length < 4) {
          throw new Error('O motivo do bloqueio é obrigatório (mínimo 4 caracteres).');
        }

        await placeHold(
          document.id,
          document.currentVersion?.id,
          holdType,
          authority.trim(),
          reason.trim(),
          idempotencyKeyRef.current,
        );
      } else {
        if (!targetHold) {
          throw new Error('Nenhum bloqueio selecionado para libertação.');
        }
        if (!releaseReason.trim() || releaseReason.trim().length < 4) {
          throw new Error('O motivo de libertação é obrigatório (mínimo 4 caracteres).');
        }

        await releaseHold(
          document.id,
          targetHold.id,
          targetHold.versionId,
          releaseReason.trim(),
          idempotencyKeyRef.current,
        );
      }

      onSuccess();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha na operação de bloqueio de retenção.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hold-modal-title"
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
            <div
              className={`p-2 rounded-lg ${
                mode === 'place'
                  ? isLight
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-amber-500/10 text-amber-400'
                  : isLight
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              {mode === 'place' ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="hold-modal-title" className="text-lg font-bold">
                {mode === 'place' ? 'Aplicar Bloqueio de Retenção' : 'Libertar Bloqueio de Retenção'}
              </h2>
              <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {mode === 'place'
                  ? 'Impede a eliminação e suspende expiração de retenção'
                  : 'Remove o impedimento legal/administrativo ativo'}
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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {mode === 'place' ? (
            <>
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                  Tipo de Bloqueio
                </label>
                <select
                  value={holdType}
                  onChange={(e) => setHoldType(e.target.value as 'legal' | 'administrative')}
                  className={`w-full h-11 px-3 rounded-lg border text-sm outline-none ${
                    isLight
                      ? 'bg-white border-zinc-200 text-zinc-900'
                      : 'bg-zinc-800 border-white/10 text-zinc-100'
                  }`}
                >
                  <option value="legal">Legal (Ordem Judicial / Requisitório Legal)</option>
                  <option value="administrative">Administrativo (Auditoria / Inquérito Interno)</option>
                </select>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                  Autoridade Emitente <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={authority}
                  onChange={(e) => setAuthority(e.target.value)}
                  placeholder="ex: Tribunal Provincial de Luanda / Comissão de Auditoria"
                  className={`w-full h-11 px-3 rounded-lg border text-sm outline-none ${
                    isLight
                      ? 'bg-white border-zinc-200 text-zinc-900'
                      : 'bg-zinc-800 border-white/10 text-zinc-100'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                  Motivo e Fundamentação <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  minLength={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Descreva a fundamentação legal ou administrativa para retenção obrigatória..."
                  className={`w-full p-3 rounded-lg border text-sm outline-none ${
                    isLight
                      ? 'bg-white border-zinc-200 text-zinc-900'
                      : 'bg-zinc-800 border-white/10 text-zinc-100'
                  }`}
                />
              </div>
            </>
          ) : (
            <>
              {targetHold && (
                <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                  isLight ? 'bg-slate-50 border-zinc-200 text-zinc-700' : 'bg-zinc-950 border-white/5 text-zinc-300'
                }`}>
                  <p><span className="font-semibold">Bloqueio:</span> {targetHold.holdType.toUpperCase()}</p>
                  <p><span className="font-semibold">Autoridade:</span> {targetHold.authority}</p>
                  <p><span className="font-semibold">Motivo original:</span> {targetHold.reason}</p>
                </div>
              )}

              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                  Motivo da Libertação <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  minLength={4}
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  placeholder="Fundamente o encerramento do processo ou a resolução do inquérito..."
                  className={`w-full p-3 rounded-lg border text-sm outline-none ${
                    isLight
                      ? 'bg-white border-zinc-200 text-zinc-900'
                      : 'bg-zinc-800 border-white/10 text-zinc-100'
                  }`}
                />
              </div>
            </>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          )}

          <div className="pt-4 border-t border-zinc-200/50 dark:border-white/5 flex items-center justify-end gap-2.5">
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
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1.5 ${
                mode === 'place'
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-emerald-700 hover:bg-emerald-600'
              } disabled:opacity-40`}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {mode === 'place' ? 'Aplicar Bloqueio' : 'Libertar Bloqueio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
