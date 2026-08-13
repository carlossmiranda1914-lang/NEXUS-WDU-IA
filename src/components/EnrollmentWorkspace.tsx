import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardList, LoaderCircle, Plus, RefreshCw, UserRoundPlus } from 'lucide-react';
import { auth } from '../lib/firebase.ts';

type EnrollmentStatus = 'draft' | 'under_review' | 'awaiting_documents' | 'validated' | 'blocked' | 'active' | 'cancelled';
type ActiveAcademicYear = { id: string; name: string; startsOn: string; endsOn: string; status: 'active' };
type Offer = { id: string; name: string; code: string; academic_year_id: string; academic_year_name: string };
type Enrollment = { id: string; status: EnrollmentStatus; student_name: string; guardian_name: string | null; offer_name: string; academic_year_name: string; created_at: string; updated_at: string };

const statusLabels: Record<EnrollmentStatus, string> = {
  draft: 'Rascunho', under_review: 'Em análise', awaiting_documents: 'Aguardar documentos',
  validated: 'Validada', blocked: 'Bloqueada', active: 'Ativa', cancelled: 'Cancelada',
};
const statusStyle: Record<EnrollmentStatus, string> = {
  draft: 'bg-zinc-700 text-zinc-100', under_review: 'bg-blue-500/20 text-blue-300', awaiting_documents: 'bg-amber-500/20 text-amber-200',
  validated: 'bg-emerald-500/20 text-emerald-300', blocked: 'bg-rose-500/20 text-rose-200', active: 'bg-emerald-500 text-zinc-950', cancelled: 'bg-zinc-800 text-zinc-400',
};

async function request(path: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Inicie sessão para aceder às matrículas.');
  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.');
  return body;
}

export default function EnrollmentWorkspace() {
  const [academicYear, setAcademicYear] = useState<ActiveAcademicYear | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [offerId, setOfferId] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [context, list] = await Promise.all([request('/api/enrollments/context'), request('/api/enrollments')]);
      const nextOffers = context.offers || [];
      setAcademicYear(context.academicYear || null);
      setOffers(nextOffers);
      setEnrollments(list.enrollments || []);
      setOfferId((current) => nextOffers.some((offer: Offer) => offer.id === current) ? current : nextOffers[0]?.id || '');
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a área de matrículas.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createDraft(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError(null); setNotice(null);
    try {
      const result = await request('/api/enrollments/drafts', { method: 'POST', body: JSON.stringify({ studentName, guardianName: guardianName || undefined, offerId }) });
      setEnrollments((current) => [result.enrollment, ...current]);
      setStudentName(''); setGuardianName(''); setNotice('Rascunho criado. A matrícula permanece em rascunho até ser analisada pela Secretaria.');
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Não foi possível criar o rascunho.'); }
    finally { setSubmitting(false); }
  }

  return (
    <section className="space-y-6" aria-label="Matrículas institucionais">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Secretaria · dados institucionais</p>
          <h1 className="text-2xl font-bold text-white">Matrículas</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">Processos reais da instituição selecionada. O ano letivo é definido pela Administração/Direção e aqui é apenas consumido como contexto operacional.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/5 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </header>

      {error && <div role="alert" className="flex gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100"><AlertCircle className="h-5 w-5 shrink-0" /><div><strong>Não foi possível concluir a operação.</strong><p className="mt-1 text-rose-200">{error}</p></div></div>}
      {notice && <div role="status" className="flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"><CheckCircle2 className="h-5 w-5 shrink-0" />{notice}</div>}

      {academicYear && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100"><strong>Ano letivo ativo:</strong> {academicYear.name} <span className="text-emerald-200/70">({academicYear.startsOn} a {academicYear.endsOn})</span></div>}

      {loading ? <div className="flex min-h-56 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-zinc-900 text-sm text-zinc-300"><LoaderCircle className="h-5 w-5 animate-spin" /> A carregar dados institucionais…</div> : !academicYear ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6"><h2 className="font-semibold text-amber-100">Sem ano letivo ativo</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/80">A instituição ainda não tem um ano letivo ativo. A Administração ou Direção deve ativar um ano letivo antes de a Secretaria poder iniciar novas matrículas.</p></div>
      ) : offers.length === 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6"><h2 className="font-semibold text-amber-100">Ano letivo ativo sem ofertas</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/80">O ano letivo {academicYear.name} está ativo, mas ainda não existem ofertas de matrícula ativas associadas. A Secretaria pode consultar o contexto, mas não pode criar matrículas até existir uma oferta operacional.</p></div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <form onSubmit={createDraft} className="rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2"><UserRoundPlus className="h-5 w-5 text-emerald-400" /><div><h2 className="font-semibold text-white">Nova matrícula</h2><p className="text-xs text-zinc-400">Cria um rascunho institucional auditável no contexto do ano letivo ativo.</p></div></div>
            <div className="space-y-4">
              <label className="block text-xs font-medium text-zinc-300">Aluno<input required minLength={3} maxLength={160} value={studentName} onChange={(event) => setStudentName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400" placeholder="Nome completo" /></label>
              <label className="block text-xs font-medium text-zinc-300">Encarregado de educação <span className="text-zinc-500">(opcional nesta fase)</span><input maxLength={160} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400" placeholder="Nome completo" /></label>
              <label className="block text-xs font-medium text-zinc-300">Oferta<select required value={offerId} onChange={(event) => setOfferId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400">{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.name}</option>)}</select></label>
              <button disabled={submitting || !offerId} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />{submitting ? 'A criar…' : 'Criar rascunho'}</button>
            </div>
          </form>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900"><div className="flex items-center gap-2 border-b border-white/10 px-5 py-4"><ClipboardList className="h-5 w-5 text-emerald-400" /><h2 className="font-semibold text-white">Processos da instituição</h2></div>{enrollments.length === 0 ? <div className="p-8 text-center text-sm text-zinc-400">Ainda não existem matrículas nesta instituição. Crie o primeiro rascunho quando tiver os dados necessários.</div> : <ul className="divide-y divide-white/10">{enrollments.map((enrollment) => <li key={enrollment.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-white">{enrollment.student_name}</p><p className="mt-1 text-xs text-zinc-400">{enrollment.offer_name} · {enrollment.academic_year_name}{enrollment.guardian_name ? ` · Encarregado: ${enrollment.guardian_name}` : ''}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[enrollment.status]}`}>{statusLabels[enrollment.status]}</span></li>)}</ul>}</div>
        </div>
      )}
    </section>
  );
}
