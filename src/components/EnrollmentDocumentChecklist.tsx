import { useCallback, useEffect, useState } from 'react';
import type { EnrollmentOperationalStatus } from '../modules/enrollments/enrollment-operations-model.ts';
import type { EnrollmentDocumentStatus } from '../modules/enrollments/enrollment-document-policy.ts';
import EnrollmentRegistrationPanel from './EnrollmentRegistrationPanel.tsx';
import { auth } from '../lib/firebase.ts';

type DocumentRecord = {
  id: string;
  document_type: string;
  required: boolean;
  source_requirement_id: string | null;
  status: EnrollmentDocumentStatus;
  physical_file_persisted: boolean;
  verified_by: string | null;
  verified_at: string | null;
};

type DocumentReadiness = {
  ready: boolean;
  reason: 'POLICY_NOT_CAPTURED' | 'REQUIREMENTS_NOT_CONFIGURED' | 'REQUIRED_DOCUMENTS_PENDING' | 'REQUIRED_DOCUMENTS_UNVERIFIED' | null;
  configuredRequirementCount: number;
  requiredCount: number;
  pendingCount: number;
  submittedCount: number;
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
  const [readiness, setReadiness] = useState<DocumentReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filesById, setFilesById] = useState<Record<string, File | undefined>>({});
  const [idempotencyById, setIdempotencyById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await request(`/api/enrollments/${enrollmentId}/documents`);
      setDocuments(Array.isArray(result.documents) ? result.documents : []);
      setReadiness(result.readiness || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os documentos da matrícula.');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, request]);

  useEffect(() => { void load(); }, [load]);

  const mutable = MUTABLE_ENROLLMENT_STATUSES.includes(enrollmentStatus);

  async function transition(document: DocumentRecord, toStatus: EnrollmentDocumentStatus) {
    setBusyId(document.id);
    setError(null);
    try {
      await request(`/api/enrollments/${enrollmentId}/documents/${document.id}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ toStatus }),
      });
      await load();
      await onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o documento.');
    } finally {
      setBusyId(null);
    }
  }

  async function upload(document: DocumentRecord) {
    const file = filesById[document.id];
    if (!file) { setError('Selecione um ficheiro PDF, JPG ou PNG.'); return; }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 6 * 1024 * 1024) { setError('Selecione um PDF, JPG ou PNG com até 6 MB.'); return; }
    const key = idempotencyById[document.id] || crypto.randomUUID();
    setIdempotencyById((current) => ({ ...current, [document.id]: key })); setBusyId(document.id); setError(null);
    try {
      await request(`/api/enrollments/${enrollmentId}/documents/${document.id}/file`, { method: 'POST', body: file, headers: { 'Content-Type': file.type, 'Idempotency-Key': key, 'X-File-Name': encodeURIComponent(file.name) } });
      await load(); await onChanged?.(); setFilesById((current) => ({ ...current, [document.id]: undefined })); setIdempotencyById((current) => ({ ...current, [document.id]: '' }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'O ficheiro não foi recebido. Tente novamente.'); } finally { setBusyId(null); }
  }

  async function download(document: DocumentRecord) {
    const user = auth.currentUser; if (!user) { setError('Inicie sessão para abrir o documento.'); return; }
    setBusyId(document.id); setError(null);
    try { const response = await fetch(`/api/enrollments/${enrollmentId}/documents/${document.id}/file`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } }); if (!response.ok) throw new Error('O documento não está disponível.'); const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = globalThis.document.createElement('a'); anchor.href = url; anchor.download = ''; anchor.click(); URL.revokeObjectURL(url); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o documento.'); } finally { setBusyId(null); }
  }

  return <>
    <EnrollmentRegistrationPanel enrollmentId={enrollmentId} enrollmentStatus={enrollmentStatus} light={light} request={request} onChanged={onChanged} />
    <section className={`mt-6 rounded-2xl border p-4 ${light ? 'border-zinc-200 bg-white' : 'border-white/10 bg-zinc-950/40'}`} aria-label="Documentos da matrícula">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className={`break-words text-sm font-semibold leading-5 ${light ? 'text-zinc-900' : 'text-white'}`}>Documentos da matrícula</h3><p className={`mt-1 break-words text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>Envie o ficheiro exigido para cada requisito. PDF, JPG ou PNG até 6 MB.</p></div>
        {!loading && readiness && <span className={`shrink-0 text-xs font-semibold ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{readiness.requiredCount === 0 ? 'Sem obrigatórios' : `${documents.filter((item) => item.required && item.status === 'verified').length}/${readiness.requiredCount}`}</span>}
      </div>
      {loading ? <p className={`mt-4 text-xs ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>A carregar documentos…</p> : readiness?.reason === 'POLICY_NOT_CAPTURED' ? <DocumentReadinessMessage light={light} title="Política documental não capturada" body="Esta matrícula ainda não possui uma política documental institucional capturada. A validação permanece bloqueada." /> : readiness?.reason === 'REQUIREMENTS_NOT_CONFIGURED' ? <DocumentReadinessMessage light={light} title="Requisitos documentais ainda não confirmados" body="Não há requisitos documentais materializados para esta matrícula. O Nexus não assume que zero documentos significa documentação concluída." /> : documents.length === 0 ? <DocumentReadinessMessage light={light} title="Checklist sem itens" body="A checklist ainda não possui requisitos institucionais confirmados; a validação permanece bloqueada." /> : <div className="mt-4 space-y-3">
        {documents.map((document) => {
          const canSubmit = mutable && (document.status === 'pending' || document.status === 'rejected');
          const canReview = mutable && document.status === 'submitted';
          return <article key={document.id} className={`min-w-0 rounded-xl border p-3 ${light ? 'border-zinc-200 bg-slate-50' : 'border-white/10 bg-zinc-900'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className={`break-words text-sm font-semibold ${light ? 'text-zinc-900' : 'text-white'}`}>{document.document_type}</p><p className={`mt-1 text-[11px] ${document.required ? 'text-amber-500' : light ? 'text-zinc-500' : 'text-zinc-400'}`}>{document.required ? 'Obrigatório' : 'Opcional'}</p></div><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[document.status]}`}>{STATUS_LABELS[document.status]}</span></div>
            {document.physical_file_persisted && <button type="button" onClick={() => void download(document)} disabled={busyId !== null} className={`mt-3 min-h-11 rounded-lg border px-3.5 py-2 text-xs font-semibold disabled:opacity-50 ${light ? 'border-zinc-200 text-zinc-700' : 'border-white/10 text-zinc-200'}`}>Abrir ou descarregar</button>}
            {canSubmit && <div className="mt-3 space-y-2"><input aria-label={`Ficheiro para ${document.document_type}`} type="file" accept="application/pdf,image/jpeg,image/png" disabled={busyId !== null} onChange={(event) => setFilesById((current) => ({ ...current, [document.id]: event.target.files?.[0] }))} className={`block w-full text-xs ${light ? 'text-zinc-700' : 'text-zinc-300'}`} />{filesById[document.id] && <p className={`text-xs ${light ? 'text-zinc-600' : 'text-zinc-400'}`}>{filesById[document.id]?.name}</p>}<button type="button" disabled={busyId !== null || !filesById[document.id]} onClick={() => void upload(document)} className="min-h-11 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50">{busyId === document.id ? 'A enviar…' : document.status === 'rejected' ? 'Enviar novo ficheiro' : 'Enviar ficheiro'}</button></div>}
            {canReview && <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busyId !== null} onClick={() => void transition(document, 'verified')} className="min-h-11 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50">Verificar</button><button type="button" disabled={busyId !== null} onClick={() => void transition(document, 'rejected')} className={`min-h-11 rounded-lg border px-3.5 py-2 text-xs font-semibold disabled:opacity-50 ${light ? 'border-zinc-200 text-zinc-700' : 'border-white/10 text-zinc-200'}`}>Rejeitar</button></div>}
          </article>;
        })}
      </div>}
      {!mutable && !loading && documents.length > 0 && <p className={`mt-4 text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>A checklist está em modo de consulta porque este processo já não aceita alterações documentais.</p>}
      {error && <p role="alert" className="mt-4 text-xs text-rose-500">{error}</p>}
    </section>
  </>;
}

function DocumentReadinessMessage({ light, title, body }: { light: boolean; title: string; body: string }) {
  return <div className={`mt-4 rounded-xl border p-3 text-xs leading-5 ${light ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-amber-500/20 bg-amber-500/10 text-amber-200'}`}><p className="font-semibold">{title}</p><p className="mt-1">{body}</p></div>;
}
