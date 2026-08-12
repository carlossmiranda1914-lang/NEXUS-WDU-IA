import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  UserRoundPlus,
} from 'lucide-react';
import { auth } from '../lib/firebase.ts';
import {
  createEnrollmentIdempotencyKey,
  enrollmentResolutionUi,
  type EnrollmentResolution,
} from '../modules/enrollments/enrollment-ui-model.ts';

type EnrollmentStatus = 'draft' | 'under_review' | 'awaiting_documents' | 'validated' | 'blocked' | 'active' | 'cancelled';
type Offer = { id: string; name: string; code: string; academic_year_id: string; academic_year_name: string };
type Enrollment = { id: string; status: EnrollmentStatus; student_name: string; guardian_name: string | null; offer_name: string; academic_year_name: string; created_at: string; updated_at: string };
type StudentInput = { name: string; birthDate?: string; phone?: string; studentNumber?: string; legacyStudentId?: string };
type DecisionSummary = { id: string; status: string; riskLevel: string; proposedAction: string; reasonCode: string; version: number };

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
  const [offers, setOffers] = useState<Offer[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [legacyStudentId, setLegacyStudentId] = useState('');
  const [offerId, setOfferId] = useState('');
  const [resolution, setResolution] = useState<EnrollmentResolution | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [decision, setDecision] = useState<DecisionSummary | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const [academicYearName, setAcademicYearName] = useState('2026/2027');
  const [startsOn, setStartsOn] = useState('2026-09-01');
  const [endsOn, setEndsOn] = useState('2027-07-31');
  const [offerName, setOfferName] = useState('Ensino regular');
  const [offerCode, setOfferCode] = useState('REG-2026');

  const student = useMemo<StudentInput>(() => ({
    name: studentName.trim(),
    ...(birthDate ? { birthDate } : {}),
    ...(phone.trim() ? { phone: phone.trim() } : {}),
    ...(studentNumber.trim() ? { studentNumber: studentNumber.trim() } : {}),
    ...(legacyStudentId.trim() ? { legacyStudentId: legacyStudentId.trim() } : {}),
  }), [studentName, birthDate, phone, studentNumber, legacyStudentId]);

  const resolutionUi = resolution ? enrollmentResolutionUi(resolution) : null;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [context, list] = await Promise.all([request('/api/enrollments/context'), request('/api/enrollments')]);
      setOffers(context.offers || []); setEnrollments(list.enrollments || []);
      setOfferId((current) => current || context.offers?.[0]?.id || '');
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a área de matrículas.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function resetResolution() {
    setResolution(null);
    setSelectedCandidateId('');
    setDecision(null);
    setIdempotencyKey('');
    setError(null);
    setNotice(null);
  }

  function clearStudentAfterSuccess() {
    setStudentName(''); setBirthDate(''); setPhone(''); setStudentNumber(''); setLegacyStudentId('');
    setResolution(null); setSelectedCandidateId(''); setDecision(null); setIdempotencyKey(''); setError(null);
  }

  async function identifyStudent(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError(null); setNotice(null); setDecision(null); setSelectedCandidateId('');
    try {
      const result = await request('/api/enrollments/person-resolution', {
        method: 'POST', body: JSON.stringify({ student }),
      });
      setResolution(result.resolution);
      setIdempotencyKey(createEnrollmentIdempotencyKey());
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Não foi possível confirmar a identidade do aluno.'); }
    finally { setSubmitting(false); }
  }

  async function startEnrollment() {
    if (!resolutionUi?.canStart || !offerId) return;
    const key = idempotencyKey || createEnrollmentIdempotencyKey();
    if (!idempotencyKey) setIdempotencyKey(key);
    setSubmitting(true); setError(null); setNotice(null);
    try {
      await request('/api/enrollments/intake', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({ offerId, student }),
      });
      setNotice('Matrícula iniciada com sucesso. A identidade foi confirmada novamente pelo servidor antes da criação.');
      clearStudentAfterSuccess();
      await load();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Não foi possível iniciar a matrícula.'); }
    finally { setSubmitting(false); }
  }

  async function proposeDecision(action: 'REUSE_PERSON' | 'CREATE_PERSON') {
    if (!offerId || !resolution) return;
    setSubmitting(true); setError(null); setNotice(null);
    try {
      const body: Record<string, unknown> = { offerId, student, proposedAction: action, evidenceTypes: [] };
      if (action === 'REUSE_PERSON' && selectedCandidateId) body.candidatePersonId = selectedCandidateId;
      const result = await request('/api/enrollments/identity-decisions', { method: 'POST', body: JSON.stringify(body) });
      setDecision(result.decision);
      setNotice('Caso encaminhado para confirmação autorizada. A matrícula não será criada enquanto a decisão necessária não estiver aprovada.');
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Não foi possível encaminhar a confirmação.'); }
    finally { setSubmitting(false); }
  }

  async function saveSetup(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError(null); setNotice(null);
    try {
      await request('/api/enrollments/setup', { method: 'POST', body: JSON.stringify({ academicYearName, startsOn, endsOn, offerName, offerCode }) });
      setSetupOpen(false); setNotice('Ano letivo e oferta guardados. Já pode iniciar matrículas reais.'); await load();
    } catch (setupError) { setError(setupError instanceof Error ? setupError.message : 'Não foi possível guardar a configuração.'); }
    finally { setSubmitting(false); }
  }

  return (
    <section className="space-y-6" aria-label="Matrículas institucionais">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Secretaria · dados institucionais</p>
          <h1 className="text-2xl font-bold text-white">Matrículas</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">Identifique o aluno primeiro. O Nexus reutiliza registos quando é seguro e impede criação automática quando existe dúvida.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/5 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </header>

      {error && <div role="alert" className="flex gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100"><AlertCircle className="h-5 w-5 shrink-0" /><div><strong>Não foi possível concluir a operação.</strong><p className="mt-1 text-rose-200">{error}</p></div></div>}
      {notice && <div role="status" className="flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"><CheckCircle2 className="h-5 w-5 shrink-0" />{notice}</div>}

      {loading ? <div className="flex min-h-56 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-zinc-900 text-sm text-zinc-300"><LoaderCircle className="h-5 w-5 animate-spin" /> A carregar dados institucionais…</div> : offers.length === 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6"><h2 className="font-semibold text-amber-100">Configuração necessária</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/80">Ainda não existe um ano letivo ativo com uma oferta de matrícula nesta instituição. Por segurança, não é possível iniciar uma matrícula sem essa configuração oficial.</p><button type="button" onClick={() => setSetupOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-200"><Settings2 className="h-4 w-4" /> Configurar matrícula</button></div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2"><UserRoundPlus className="h-5 w-5 text-emerald-400" /><div><h2 className="font-semibold text-white">Nova matrícula</h2><p className="text-xs text-zinc-400">1. Identificar · 2. Confirmar · 3. Iniciar</p></div></div>
              {resolution && <button type="button" onClick={resetResolution} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/5"><RotateCcw className="h-3.5 w-3.5" /> Rever dados</button>}
            </div>

            <form onSubmit={identifyStudent} className="space-y-4">
              <label className="block text-xs font-medium text-zinc-300">Nome completo<input required minLength={3} maxLength={160} disabled={Boolean(resolution)} value={studentName} onChange={(event) => { setStudentName(event.target.value); resetResolution(); }} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400 disabled:opacity-60" placeholder="Ex.: Ana Manuel" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-medium text-zinc-300">Data de nascimento <span className="text-zinc-500">(opcional)</span><input type="date" disabled={Boolean(resolution)} value={birthDate} onChange={(event) => { setBirthDate(event.target.value); resetResolution(); }} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400 disabled:opacity-60" /></label>
                <label className="block text-xs font-medium text-zinc-300">Telefone <span className="text-zinc-500">(opcional)</span><input maxLength={40} disabled={Boolean(resolution)} value={phone} onChange={(event) => { setPhone(event.target.value); resetResolution(); }} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400 disabled:opacity-60" placeholder="Contacto disponível" /></label>
                <label className="block text-xs font-medium text-zinc-300">N.º do aluno <span className="text-zinc-500">(se já existir)</span><input maxLength={80} disabled={Boolean(resolution)} value={studentNumber} onChange={(event) => { setStudentNumber(event.target.value); resetResolution(); }} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400 disabled:opacity-60" /></label>
                <label className="block text-xs font-medium text-zinc-300">Referência antiga <span className="text-zinc-500">(opcional)</span><input maxLength={80} disabled={Boolean(resolution)} value={legacyStudentId} onChange={(event) => { setLegacyStudentId(event.target.value); resetResolution(); }} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400 disabled:opacity-60" /></label>
              </div>
              <label className="block text-xs font-medium text-zinc-300">Oferta / ano letivo<select required disabled={Boolean(resolution)} value={offerId} onChange={(event) => { setOfferId(event.target.value); resetResolution(); }} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400 disabled:opacity-60">{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.academic_year_name} · {offer.name}</option>)}</select></label>
              {!resolution && <button disabled={submitting || !offerId} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"><Search className="h-4 w-4" />{submitting ? 'A verificar…' : 'Identificar aluno'}</button>}
            </form>

            {resolution && resolutionUi && <div className={`rounded-xl border p-4 ${resolutionUi.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
              <div className="flex gap-3"><ShieldCheck className={`mt-0.5 h-5 w-5 shrink-0 ${resolutionUi.tone === 'success' ? 'text-emerald-300' : 'text-amber-300'}`} /><div className="min-w-0"><h3 className="font-semibold text-white">{resolutionUi.title}</h3><p className="mt-1 text-sm leading-6 text-zinc-300">{resolutionUi.description}</p></div></div>

              {resolutionUi.showLocalCandidates && resolution.localCandidates?.length ? <div className="mt-4 space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Registos desta escola que podem corresponder</p>{resolution.localCandidates.map((candidate) => <label key={candidate.personId} className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-zinc-950/60 p-3 text-sm text-zinc-200"><input type="radio" name="candidate" value={candidate.personId} checked={selectedCandidateId === candidate.personId} onChange={() => setSelectedCandidateId(candidate.personId)} className="mt-1" /><span><strong className="block text-white">{candidate.name}</strong><span className="text-xs text-zinc-400">{candidate.birthDate ? `Nascimento: ${candidate.birthDate}` : 'Data de nascimento não registada'}</span></span></label>)}</div> : null}

              {resolutionUi.canStart ? <button type="button" onClick={() => void startEnrollment()} disabled={submitting} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-emerald-300 disabled:opacity-50">{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{submitting ? 'A iniciar…' : 'Iniciar matrícula'}</button> : (
                <div className="mt-4 space-y-2">
                  {(resolution.status === 'MULTIPLE_MATCHES' || resolution.status === 'REVIEW_REQUIRED') && resolution.localCandidates?.length ? <button type="button" disabled={!selectedCandidateId || submitting} onClick={() => void proposeDecision('REUSE_PERSON')} className="w-full rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50">Encaminhar registo selecionado para confirmação</button> : null}
                  {resolution.status === 'RESTRICTED_POSSIBLE_MATCH' || resolution.status === 'REUSABLE_MATCH' ? <button type="button" disabled={submitting} onClick={() => void proposeDecision('REUSE_PERSON')} className="w-full rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50">Encaminhar possível correspondência</button> : null}
                  {(resolution.status === 'REVIEW_REQUIRED' || resolution.status === 'MULTIPLE_MATCHES') ? <button type="button" disabled={submitting} onClick={() => void proposeDecision('CREATE_PERSON')} className="w-full rounded-lg border border-amber-400/40 px-4 py-2.5 text-sm font-semibold text-amber-100 disabled:opacity-50">Propor novo registo após confirmação</button> : null}
                </div>
              )}

              {decision && <div className="mt-4 rounded-lg border border-white/10 bg-zinc-950/60 p-3 text-sm text-zinc-300"><p className="font-semibold text-white">Confirmação registada</p><p className="mt-1">Estado: <span className="font-medium text-amber-200">{decision.status.replaceAll('_', ' ')}</span>. Uma autoridade independente deve concluir a decisão quando a política exigir.</p></div>}
            </div>}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900"><div className="flex items-center gap-2 border-b border-white/10 px-5 py-4"><ClipboardList className="h-5 w-5 text-emerald-400" /><h2 className="font-semibold text-white">Processos da instituição</h2></div>{enrollments.length === 0 ? <div className="p-8 text-center text-sm text-zinc-400">Ainda não existem matrículas nesta instituição. Identifique o primeiro aluno quando tiver os dados necessários.</div> : <ul className="divide-y divide-white/10">{enrollments.map((enrollment) => <li key={enrollment.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-white">{enrollment.student_name}</p><p className="mt-1 text-xs text-zinc-400">{enrollment.offer_name} · {enrollment.academic_year_name}{enrollment.guardian_name ? ` · Encarregado: ${enrollment.guardian_name}` : ''}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[enrollment.status]}`}>{statusLabels[enrollment.status]}</span></li>)}</ul>}</div>
        </div>
      )}

      {setupOpen && <div className="rounded-2xl border border-emerald-500/30 bg-zinc-900 p-5"><div className="mb-4"><h2 className="font-semibold text-white">Configuração oficial de matrícula</h2><p className="mt-1 text-sm text-zinc-400">Crie o primeiro ano letivo e a primeira oferta desta instituição. Esta ação não cria dados demonstrativos.</p></div><form onSubmit={saveSetup} className="grid gap-4 md:grid-cols-2"><label className="text-xs font-medium text-zinc-300">Ano letivo<input required value={academicYearName} onChange={(event) => setAcademicYearName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white" /></label><label className="text-xs font-medium text-zinc-300">Oferta / curso / turma<input required value={offerName} onChange={(event) => setOfferName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white" /></label><label className="text-xs font-medium text-zinc-300">Início<input required type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white" /></label><label className="text-xs font-medium text-zinc-300">Fim<input required type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white" /></label><label className="text-xs font-medium text-zinc-300 md:col-span-2">Código interno da oferta<input required value={offerCode} onChange={(event) => setOfferCode(event.target.value.toUpperCase())} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white" /></label><div className="flex gap-3 md:col-span-2"><button disabled={submitting} className="rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50">{submitting ? 'A guardar…' : 'Guardar configuração'}</button><button type="button" onClick={() => setSetupOpen(false)} className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-200">Cancelar</button></div></form></div>}
    </section>
  );
}
