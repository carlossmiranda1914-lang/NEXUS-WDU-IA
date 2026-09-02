import { FormEvent, useMemo, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import EnrollmentEntryIntentSelector from './EnrollmentEntryIntentSelector.tsx';
import EnrollmentEntryForm from './EnrollmentEntryForm.tsx';
import EnrollmentRegistrationPanel from './EnrollmentRegistrationPanel.tsx';
import { getIdentityReviewDecision, listIdentityReviewQueue, requestIdentityReview, resolveExistingStudent, resumeApprovedIdentityReview, startProtectedEnrollment, submitIdentityReviewEvidence, submitIdentityReviewOutcome, type EnrollmentStudentDraft, type PublicIdentityDecision } from '../modules/enrollments/enrollment-intake-client.ts';
import { createLatestIdentityRequestGate } from '../modules/enrollments/identity-review-request-gate.ts';
import { enrollmentRegistrationRequest } from '../modules/enrollments/enrollment-registration-client.ts';

type Offer = { id: string; name: string; academic_year_name: string };
type EntryIntent = 'new' | 'existing';
type Resolution = { status: string; candidateCount?: number };

export default function EnrollmentNewEntryDrawer({ offers, light, onClose, onCreated }: { offers: Offer[]; light: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
  const [intent, setIntent] = useState<EntryIntent | null>(null);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [legacyStudentId, setLegacyStudentId] = useState('');
  const [offerId, setOfferId] = useState(offers[0]?.id || '');
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [identityDecision, setIdentityDecision] = useState<PublicIdentityDecision | null>(null);
  const [reviewQueue, setReviewQueue] = useState<PublicIdentityDecision[] | null>(null);
  const [evidenceType, setEvidenceType] = useState('civil_document_presented');
  const [createdEnrollmentId, setCreatedEnrollmentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const identityRequestGate = useRef(createLatestIdentityRequestGate());

  const student = useMemo<EnrollmentStudentDraft>(() => ({ name: name.trim(), ...(birthDate ? { birthDate } : {}), ...(phone.trim() ? { phone: phone.trim() } : {}), ...(studentNumber.trim() ? { studentNumber: studentNumber.trim() } : {}), ...(legacyStudentId.trim() ? { legacyStudentId: legacyStudentId.trim() } : {}) }), [name, birthDate, phone, studentNumber, legacyStudentId]);
  const canStartExisting = resolution?.status === 'LOCAL_MATCH';
  const canResumeApprovedDecision = identityDecision?.status === 'approved' && identityDecision.capabilities?.canResumeIntake;
  const requiresReview = resolution?.status === 'REVIEW_REQUIRED' || resolution?.status === 'RESTRICTED_POSSIBLE_MATCH' || resolution?.status === 'MULTIPLE_MATCHES';
  const decisionStatus = identityDecision?.status === 'pending_confirmation' || identityDecision?.status === 'pending_second_approval'
    ? 'A aguardar revisão autorizada'
    : identityDecision?.status === 'needs_more_information' ? 'São necessárias mais informações'
      : identityDecision?.status === 'approved' ? 'Decisão aprovada'
        : identityDecision?.status === 'rejected' ? 'Decisão rejeitada' : null;

  function chooseIntent(next: EntryIntent) {
    identityRequestGate.current.invalidate();
    setIntent(next);
    setResolution(null);
    setIdentityDecision(null);
    setReviewQueue(null);
    setError(null);
    if (next === 'new') { setStudentNumber(''); setLegacyStudentId(''); }
  }

  function beginIdentityRequest(decisionRef?: string | null) {
    const request = identityRequestGate.current.begin(decisionRef);
    setBusy(true);
    setError(null);
    return {
      isLatest: request.isLatest,
      finish: () => { if (request.isLatest()) setBusy(false); },
    };
  }

  function selectIdentityDecision(decision: PublicIdentityDecision | null) {
    identityRequestGate.current.select(decision?.decisionRef ?? null);
    setResolution(null);
    setIdentityDecision(decision);
    setError(null);
  }

  function failClosedIdentityRequest(request: { isLatest: () => boolean }, message: string) {
    if (!request.isLatest()) return;
    identityRequestGate.current.adopt(null);
    setResolution(null);
    setIdentityDecision(null);
    setError(message);
    setBusy(false);
  }

  async function start() {
    if (!intent || !offerId || name.trim().length < 3) return;
    if (intent === 'existing' && !canStartExisting) return;
    setBusy(true); setError(null);
    try {
      const result = await startProtectedEnrollment(offerId, student);
      const enrollmentId = result?.enrollment?.id;
      if (!enrollmentId) throw new Error('O processo foi iniciado, mas o identificador da matrícula não foi devolvido.');
      setCreatedEnrollmentId(enrollmentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível iniciar a matrícula.');
    } finally { setBusy(false); }
  }

  async function resumeApprovedDecision() {
    const decision = identityDecision;
    if (!decision || decision.status !== 'approved' || !decision.capabilities?.canResumeIntake) return;
    const request = beginIdentityRequest(decision.decisionRef);
    try {
      const result = await resumeApprovedIdentityReview(decision.decisionRef);
      if (!request.isLatest()) return;
      const enrollmentId = result?.enrollment?.id;
      if (!enrollmentId) throw new Error('A matrícula aprovada não devolveu o processo esperado.');
      setCreatedEnrollmentId(enrollmentId);
    } catch (e) {
      failClosedIdentityRequest(request, e instanceof Error ? e.message : 'Não foi possível retomar a matrícula aprovada.');
    } finally { request.finish(); }
  }

  async function identify(event: FormEvent) {
    event.preventDefault();
    if (intent !== 'existing') return;
    identityRequestGate.current.adopt(null);
    setResolution(null);
    setIdentityDecision(null);
    const request = beginIdentityRequest(null);
    try {
      const result = await resolveExistingStudent(student);
      if (!request.isLatest()) return;
      identityRequestGate.current.adopt(null);
      setResolution(result.resolution);
      setIdentityDecision(null);
    } catch (e) {
      failClosedIdentityRequest(request, e instanceof Error ? e.message : 'Não foi possível confirmar o aluno.');
    } finally { request.finish(); }
  }

  async function requestReview() {
    if (!offerId) return;
    const request = beginIdentityRequest(null);
    try {
      const result = await requestIdentityReview(offerId, student);
      if (!request.isLatest()) return;
      identityRequestGate.current.adopt(result.decision.decisionRef);
      setIdentityDecision(result.decision);
    } catch (e) { if (request.isLatest()) setError(e instanceof Error ? e.message : 'Não foi possível pedir a revisão de identidade.'); }
    finally { request.finish(); }
  }

  async function submitEvidence() {
    if (!identityDecision) return;
    const request = beginIdentityRequest(identityDecision.decisionRef);
    try {
      const result = await submitIdentityReviewEvidence(identityDecision.decisionRef, identityDecision.version, student, [evidenceType]);
      if (request.isLatest()) setIdentityDecision(result.decision);
    } catch (e) { failClosedIdentityRequest(request, e instanceof Error ? e.message : 'Não foi possível enviar as informações.'); }
    finally { request.finish(); }
  }

  async function decide(outcome: 'approve' | 'reject' | 'request_more_information') {
    if (!identityDecision) return;
    const request = beginIdentityRequest(identityDecision.decisionRef);
    try {
      const result = await submitIdentityReviewOutcome(identityDecision.decisionRef, outcome);
      if (request.isLatest()) setIdentityDecision(result.decision);
    } catch (e) { failClosedIdentityRequest(request, e instanceof Error ? e.message : 'Não foi possível concluir a revisão.'); }
    finally { request.finish(); }
  }

  async function loadReviewQueue() {
    setReviewQueue(null);
    const request = beginIdentityRequest(null);
    try {
      const result = await listIdentityReviewQueue();
      if (request.isLatest()) setReviewQueue(result.decisions);
    } catch (e) { if (request.isLatest()) setError(e instanceof Error ? e.message : 'Não foi possível consultar as revisões de identidade.'); }
    finally { request.finish(); }
  }

  async function recoverIdentityDecision(decisionRef: string) {
    selectIdentityDecision(null);
    identityRequestGate.current.adopt(decisionRef);
    const request = beginIdentityRequest(decisionRef);
    try {
      const result = await getIdentityReviewDecision(decisionRef);
      if (request.isLatest()) setIdentityDecision(result.decision);
    } catch (e) { if (request.isLatest()) setError(e instanceof Error ? e.message : 'Não foi possível recuperar esta revisão de identidade.'); }
    finally { request.finish(); }
  }

  return <div className="fixed inset-0 z-[12000] flex justify-end bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className={`h-full w-full max-w-2xl overflow-y-auto border-l p-5 shadow-2xl sm:p-6 ${light ? 'border-zinc-200 bg-white' : 'border-white/10 bg-zinc-900'}`}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Nova entrada</p><h2 className={`mt-1 text-xl font-bold ${light ? 'text-zinc-900' : 'text-white'}`}>{createdEnrollmentId ? 'Completar cadastro da matrícula' : 'Começar processo de matrícula'}</h2><p className={`mt-2 text-sm leading-6 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{createdEnrollmentId ? 'O processo já foi criado com identidade protegida. Complete agora os dados administrativos antes da validação.' : 'Escolha se o aluno é novo ou já possui registo. O Nexus confirma a identidade antes de criar ou reutilizar uma pessoa.'}</p></div><button type="button" onClick={onClose} aria-label="Fechar" className={`rounded-lg p-2 ${light ? 'hover:bg-zinc-100' : 'hover:bg-white/5'}`}><X className="h-5 w-5" /></button></div>

    {createdEnrollmentId ? <>
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-500"><CheckCircle2 className="h-4 w-4 shrink-0" /> Processo criado. Os próximos dados ficam ligados a esta matrícula.</div>
      <EnrollmentRegistrationPanel enrollmentId={createdEnrollmentId} enrollmentStatus="draft" light={light} request={enrollmentRegistrationRequest} compact />
      <button type="button" onClick={() => void onCreated()} className={`mt-5 min-h-11 w-full rounded-lg border px-4 py-2.5 text-sm font-semibold ${light ? 'border-zinc-200 text-zinc-700 hover:bg-zinc-50' : 'border-white/10 text-zinc-200 hover:bg-white/5'}`}>Voltar à fila de matrículas</button>
    </> : <>
      <button type="button" onClick={() => void loadReviewQueue()} disabled={busy} className={`mt-5 min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold ${light ? 'border-zinc-200 text-zinc-700 hover:bg-zinc-50' : 'border-white/10 text-zinc-200 hover:bg-white/5'} disabled:opacity-50`}>Consultar revisões de identidade</button>
      {reviewQueue && <section aria-label="Revisões de identidade" className={`mt-4 rounded-xl border p-4 ${light ? 'border-zinc-200 bg-slate-50' : 'border-white/10 bg-zinc-950/60'}`}><p className={`font-semibold ${light ? 'text-zinc-900' : 'text-white'}`}>Revisões de identidade disponíveis</p>{reviewQueue.length === 0 ? <p className={`mt-2 text-sm ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>Não existem revisões disponíveis.</p> : <div className="mt-3 space-y-2">{reviewQueue.map((decision) => <button key={decision.decisionRef} type="button" onClick={() => void recoverIdentityDecision(decision.decisionRef)} className={`block w-full rounded-lg border p-3 text-left text-sm ${light ? 'border-zinc-200 bg-white text-zinc-700 hover:border-indigo-300' : 'border-white/10 bg-zinc-900 text-zinc-200 hover:border-indigo-400/50'}`}>{decision.status === 'needs_more_information' ? 'São necessárias mais informações' : decision.status === 'pending_confirmation' || decision.status === 'pending_second_approval' ? 'A aguardar revisão autorizada' : decision.status === 'approved' ? 'Decisão aprovada' : 'Decisão rejeitada'}</button>)}</div>}</section>}
      {offers.length === 0 ? <div className="mt-6 rounded-xl border border-amber-500/30 p-4 text-sm text-amber-500">Não existe uma oferta de matrícula ativa.</div> : <><div className="mt-6"><EnrollmentEntryIntentSelector value={intent} onChange={chooseIntent} /></div>{intent && <EnrollmentEntryForm intent={intent} offers={offers} name={name} birthDate={birthDate} phone={phone} studentNumber={studentNumber} legacyStudentId={legacyStudentId} offerId={offerId} busy={busy} resolved={Boolean(resolution)} light={light} onSubmit={intent === 'existing' ? identify : (event) => { event.preventDefault(); void start(); }} setName={setName} setBirthDate={setBirthDate} setPhone={setPhone} setStudentNumber={setStudentNumber} setLegacyStudentId={setLegacyStudentId} setOfferId={setOfferId} />}</>}
      {error && <div role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500">{error}</div>}
      {(identityDecision || (intent === 'existing' && resolution)) && <div className={`mt-6 rounded-xl border p-4 ${light ? 'border-zinc-200 bg-slate-50' : 'border-white/10 bg-zinc-950/60'}`}><p className={`font-semibold ${light ? 'text-zinc-900' : 'text-white'}`}>{resolution?.status === 'LOCAL_MATCH' ? 'Registo local encontrado com segurança' : resolution?.status === 'NO_MATCH' ? 'Nenhum aluno existente encontrado' : decisionStatus || 'Confirmação adicional necessária'}</p><p className={`mt-2 text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{resolution?.status === 'LOCAL_MATCH' ? 'O Nexus pode reutilizar este registo sem criar uma pessoa duplicada.' : resolution?.status === 'NO_MATCH' ? 'Os dados não correspondem a um aluno existente nesta instituição. Se a pessoa for realmente nova, continue pelo fluxo Aluno novo.' : identityDecision?.status === 'approved' ? 'A revisão foi confirmada. Retome a matrícula diretamente a partir da decisão aprovada.' : identityDecision?.status === 'rejected' ? 'Esta identidade não foi aprovada. Reveja os dados ou peça orientação à direção.' : identityDecision?.status === 'needs_more_information' ? 'Atualize os dados e indique a evidência apresentada para uma nova verificação.' : 'Há conflito ou mais de uma correspondência possível. O Nexus não vai escolher automaticamente uma identidade.'}</p><div className="mt-4 flex flex-wrap gap-2">{canStartExisting && <button type="button" onClick={() => void start()} disabled={busy} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Iniciar processo</button>}{canResumeApprovedDecision && <button type="button" onClick={() => void resumeApprovedDecision()} disabled={busy} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Retomar matrícula</button>}{resolution?.status === 'NO_MATCH' && <button type="button" onClick={() => chooseIntent('new')} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Tratar como aluno novo</button>}{requiresReview && !identityDecision && <button type="button" onClick={() => void requestReview()} disabled={busy} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Pedir revisão de identidade</button>}{identityDecision?.status === 'needs_more_information' && identityDecision.capabilities?.canSubmitEvidence && <><select aria-label="Tipo de evidência" value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)} className={`min-h-11 rounded-lg border px-3 text-sm ${light ? 'border-zinc-200 bg-white text-zinc-700' : 'border-white/10 bg-zinc-900 text-zinc-200'}`}><option value="civil_document_presented">Documento de identificação apresentado</option><option value="school_record">Registo escolar</option><option value="birth_date_confirmation">Confirmação da data de nascimento</option><option value="guardian_attestation">Declaração do encarregado</option></select><button type="button" onClick={() => void submitEvidence()} disabled={busy} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enviar informações</button></>}{identityDecision?.capabilities?.canRequestMoreInformation && <button type="button" onClick={() => void decide('request_more_information')} disabled={busy} className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold ${light ? 'border-zinc-200 text-zinc-700' : 'border-white/10 text-zinc-200'}`}>Pedir mais informações</button>}{identityDecision?.capabilities?.canApprove && <button type="button" onClick={() => void decide('approve')} disabled={busy} className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Aprovar decisão</button>}{identityDecision?.capabilities?.canReject && <button type="button" onClick={() => void decide('reject')} disabled={busy} className="min-h-11 rounded-lg border border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-500 disabled:opacity-50">Rejeitar decisão</button>}<button type="button" onClick={() => selectIdentityDecision(null)} className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold ${light ? 'border-zinc-200 text-zinc-700' : 'border-white/10 text-zinc-200'}`}>Rever dados</button></div></div>}
    </>}
  </aside></div>;
}
