import { useCallback, useEffect, useState } from 'react';
import type { EnrollmentOperationalStatus } from '../modules/enrollments/enrollment-operations-model.ts';
import type { EnrollmentDocumentStatus } from '../modules/enrollments/enrollment-document-policy.ts';
import EnrollmentRegistrationPanel from './EnrollmentRegistrationPanel.tsx';

type DocumentRecord = {
  id: string;
  document_type: string;
  required: boolean;
  source_requirement_id: string | null;
  status: EnrollmentDocumentStatus;
  evidence_reference: string | null;
  verified_by: string | null;
  verified_at: string | null;
};

type Request = (path: string, options?: RequestInit) => Promise<any>;

const STATUS_LABELS: Record<EnrollmentDocumentStatus, string> = {
  pending: 'Pendente',
  submitted: 'Recebido',
  verified: 'Verificado',
  rejected: 'Rejeitado',
};

const STATUS_CLASS: Record<EnrollmentDocumentStatus, string> = {
  pending: 'border-amber-500/25 bg-amber-500/10 text-amber-500',
  submitted: 'border-blue-500/25 bg-blue-500/10 text-blue-500',
  verified: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500',
  rejected: 'border-rose-500/25 bg-rose-500/10 text-rose-500',
};

const MUTABLE_ENROLLMENT_STATUSES: EnrollmentOperationalStatus[] = ['draft', 'under_review', 'awaiting_documents', 'blocked'];

export default function EnrollmentDocumentChecklist({ enrollmentId, enrollmentStatus, light, request, onChanged }: { enrollmentId: string; enrollmentStatus: EnrollmentOperationalStatus; light: boolean; request: Request; onChanged?: () => void | Promise<void> }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [evidenceById, setEvidenceById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await request(`/api/enrollments/${enrollmentId}/documents`);
      setDocuments(Array.isArray(result.documents) ? result.documents : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os documentos da matrícula.');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, request]);

  useEffect(() => { void load(); }, [load]);

  const mutable = MUTABLE_ENROLLMENT_STATUSES.includes(enrollmentStatus);

  async function transition(document: DocumentRecord, toStatus: EnrollmentDocumentStatus) {
    const evidenceReference = evidenceById[document.id]?.trim();
    if (toStatus === 'submitted' && !evidenceReference) {
      setError('Indique uma referência da evidência antes de marcar o documento como recebido.');
      return;
    }
    setBusyId(document.id);
    setError(null);
    try {
      await request(`/api/enrollments/${enrollmentId}/documents/${document.id}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ toStatus, ...(toStatus === 'submitted' ? { evidenceReference } : {}) }),
      });
      await load();
      await onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o documento.');
    } finally {
      setBusyId(null);
    }
  }

  return <>
    <EnrollmentRegistrationPanel enrollmentId={enrollmentId} enrollmentStatus={enrollmentStatus} light={light} request={request} onChanged={onChanged} />
    <section className={`mt-6 rounded-2xl border p-4 ${light ? 'border-zinc-200 bg-white' : 'border-white/10 bg-zinc-950/40'}`} aria-label="Documentos da matrícula">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className={`text-sm font-semibold ${light ? 'text-zinc-900' : 'text-white'}`}>Documentos da matrícula</h3><p className={`mt-1 text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>Checklist capturada para este processo. Documentos obrigatórios precisam estar verificados antes da validação.</p></div>
        {!loading && <span className={`shrink-0 text-xs font-semibold ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{documents.filter((item) => item.status === 'verified').length}/{documents.length}</span>}
      </div>
      {loading ? <p className={`mt-4 text-xs ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>A carregar documentos…</p> : documents.length === 0 ? <div className={`mt-4 rounded-xl border p-3 text-xs leading-5 ${light ? 'border-zinc-200 bg-slate-50 text-zinc-500' : 'border-white/10 bg-zinc-900 text-zinc-400'}`}>Nenhum documento está registado neste processo. O sistema não assume automaticamente que a política documental está configurada.</div> : <div className="mt-4 space-y-3">
        {documents.map((document) => {
          const canSubmit = mutable && (document.status === 'pending' || document.status === 'rejected');
          const canReview = mutable && document.status === 'submitted';
          return <article key={document.id} className={`rounded-xl border p-3 ${light ? 'border-zinc-200 bg-slate-50' : 'border-white/10 bg-zinc-900'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className={`break-words text-sm font-semibold ${light ? 'text-zinc-900' : 'text-white'}`}>{document.document_type}</p><p className={`mt-1 text-[11px] ${document.required ? 'text-amber-500' : light ? 'text-zinc-500' : 'text-zinc-400'}`}>{document.required ? 'Obrigatório' : 'Opcional'}</p></div><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[document.status]}`}>{STATUS_LABELS[document.status]}</span></div>
            {document.evidence_reference && <p className={`mt-3 break-all text-xs ${light ? 'text-zinc-600' : 'text-zinc-300'}`}>Evidência: {document.evidence_reference}</p>}
            {canSubmit && <div className="mt-3 space-y-2"><input aria-label={`Referência da evidência para ${document.document_type}`} value={evidenceById[document.id] || ''} onChange={(event) => setEvidenceById((current) => ({ ...current, [document.id]: event.target.value }))} placeholder="Referência, protocolo ou localização da evidência" className={`min-h-11 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 ${light ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/10 bg-zinc-950 text-white'}`} /><button type="button" disabled={busyId !== null} onClick={() => void transition(document, 'submitted')} className="min-h-11 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50">{busyId === document.id ? 'A atualizar…' : document.status === 'rejected' ? 'Reenviar evidência' : 'Marcar como recebido'}</button></div>}
            {canReview && <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busyId !== null} onClick={() => void transition(document, 'verified')} className="min-h-11 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50">Verificar</button><button type="button" disabled={busyId !== null} onClick={() => void transition(document, 'rejected')} className={`min-h-11 rounded-lg border px-3.5 py-2 text-xs font-semibold disabled:opacity-50 ${light ? 'border-zinc-200 text-zinc-700' : 'border-white/10 text-zinc-200'}`}>Rejeitar</button></div>}
          </article>;
        })}
      </div>}
      {!mutable && !loading && documents.length > 0 && <p className={`mt-4 text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>A checklist está em modo de consulta porque este processo já não aceita alterações documentais.</p>}
      {error && <p role="alert" className="mt-4 text-xs text-rose-500">{error}</p>}
    </section>
  </>;
}
