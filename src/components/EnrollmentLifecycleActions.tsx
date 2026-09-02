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

export default function EnrollmentLifecycleActions({ status, light, onTransition, canActivate = false, onActivate, activatedStudentRef, onOpenStudentRecord }: { status: EnrollmentStatus; light: boolean; onTransition: (toStatus: EnrollmentStatus) => Promise<void>; canActivate?: boolean; onActivate?: () => Promise<string>; activatedStudentRef?: string | null; onOpenStudentRecord?: (studentRef: string) => void }) {
  const [busy, setBusy] = useState<EnrollmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targets = allowedOperationalTransitions('secretariat', status).filter((target) => target !== 'active');
  const canOpenStudentRecord = Boolean(activatedStudentRef && onOpenStudentRecord);

  if (targets.length === 0 && status !== 'validated' && !canOpenStudentRecord) return null;

  async function run(target: EnrollmentStatus) {
    setBusy(target);
    setError(null);
    try { await onTransition(target); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a matrícula.'); }
    finally { setBusy(null); }
  }

  async function activate() {
    if (!onActivate) return;
    setBusy('validated');
    setError(null);
    try { await onActivate(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível ativar a matrícula.'); }
    finally { setBusy(null); }
  }

  return <div className={`mt-5 border-t pt-4 ${light ? 'border-zinc-200' : 'border-white/10'}`}>
    <p className={`text-xs font-semibold ${light ? 'text-zinc-800' : 'text-zinc-200'}`}>Ações do processo</p>
    <div className="mt-3 flex flex-wrap gap-2">{targets.map((target) => <button key={target} type="button" disabled={busy !== null} onClick={() => void run(target)} className={`min-h-11 rounded-lg border px-3.5 py-2 text-xs font-semibold disabled:opacity-50 ${light ? 'border-zinc-200 text-zinc-700 hover:bg-zinc-50' : 'border-white/10 text-zinc-200 hover:bg-white/5'}`}>{busy === target ? 'A atualizar…' : LABELS[target] || target}</button>)}</div>
    {status === 'validated' && (canActivate ? <button type="button" disabled={busy !== null} onClick={() => void activate()} className="mt-3 min-h-11 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">{busy === 'validated' ? 'A ativar…' : 'Ativar aluno'}</button> : <p className="mt-3 text-xs text-zinc-500">A ativação é uma decisão reservada à Administração ou Direção.</p>)}
    {canOpenStudentRecord && <button type="button" onClick={() => onOpenStudentRecord(activatedStudentRef!)} className="mt-3 block min-h-11 rounded-lg border border-emerald-600/30 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10">Abrir Registo do Aluno</button>}
    {error && <p role="alert" className="mt-3 text-xs text-rose-500">{error}</p>}
  </div>;
}
