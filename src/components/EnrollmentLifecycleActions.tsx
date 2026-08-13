import { useState } from 'react';
import { allowedOperationalTransitions } from '../modules/enrollments/enrollment-workflow-actions.ts';
import type { EnrollmentStatus } from '../modules/enrollments/enrollment-policy.ts';

const LABELS: Partial<Record<EnrollmentStatus, string>> = {
  under_review: 'Iniciar verificação',
  awaiting_documents: 'Aguardar documentos',
  validated: 'Marcar como verificada',
  blocked: 'Marcar bloqueio',
  cancelled: 'Cancelar processo',
};

export default function EnrollmentLifecycleActions({ status, onTransition }: { status: EnrollmentStatus; onTransition: (toStatus: EnrollmentStatus) => Promise<void> }) {
  const [busy, setBusy] = useState<EnrollmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targets = allowedOperationalTransitions('secretariat', status).filter((target) => target !== 'active');

  if (targets.length === 0) return null;

  async function run(target: EnrollmentStatus) {
    setBusy(target);
    setError(null);
    try { await onTransition(target); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a matrícula.'); }
    finally { setBusy(null); }
  }

  return <div className="mt-5 border-t border-white/10 pt-4">
    <p className="text-xs font-semibold">Ações do processo</p>
    <div className="mt-3 flex flex-wrap gap-2">{targets.map((target) => <button key={target} type="button" disabled={busy !== null} onClick={() => void run(target)} className="min-h-11 rounded-lg border border-white/10 px-3.5 py-2 text-xs font-semibold disabled:opacity-50">{busy === target ? 'A atualizar…' : LABELS[target] || target}</button>)}</div>
    {status === 'validated' && <p className="mt-3 text-xs text-zinc-500">A ativação é uma decisão reservada à Administração ou Direção.</p>}
    {error && <p role="alert" className="mt-3 text-xs text-rose-500">{error}</p>}
  </div>;
}
