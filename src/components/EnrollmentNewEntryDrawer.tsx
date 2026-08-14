import { FormEvent, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import EnrollmentEntryIntentSelector from './EnrollmentEntryIntentSelector.tsx';
import EnrollmentEntryForm from './EnrollmentEntryForm.tsx';
import EnrollmentRegistrationPanel from './EnrollmentRegistrationPanel.tsx';
import { resolveExistingStudent, startProtectedEnrollment, type EnrollmentStudentDraft } from '../modules/enrollments/enrollment-intake-client.ts';
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
  const [createdEnrollmentId, setCreatedEnrollmentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const student = useMemo<EnrollmentStudentDraft>(() => ({ name: name.trim(), ...(birthDate ? { birthDate } : {}), ...(phone.trim() ? { phone: phone.trim() } : {}), ...(studentNumber.trim() ? { studentNumber: studentNumber.trim() } : {}), ...(legacyStudentId.trim() ? { legacyStudentId: legacyStudentId.trim() } : {}) }), [name, birthDate, phone, studentNumber, legacyStudentId]);
  const canStartExisting = resolution?.status === 'LOCAL_MATCH';

  function chooseIntent(next: EntryIntent) {
    setIntent(next);
    setResolution(null);
    setError(null);
    if (next === 'new') { setStudentNumber(''); setLegacyStudentId(''); }
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

  async function identify(event: FormEvent) {
    event.preventDefault();
    if (intent !== 'existing') return;
    setBusy(true); setError(null);
    try {
      const result = await resolveExistingStudent(student);
      setResolution(result.resolution);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível confirmar o aluno.');
    } finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-[12000] flex justify-end bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className={`h-full w-full max-w-2xl overflow-y-auto border-l p-5 shadow-2xl sm:p-6 ${light ? 'border-zinc-200 bg-white' : 'border-white/10 bg-zinc-900'}`}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Nova entrada</p><h2 className={`mt-1 text-xl font-bold ${light ? 'text-zinc-900' : 'text-white'}`}>{createdEnrollmentId ? 'Completar cadastro da matrícula' : 'Começar processo de matrícula'}</h2><p className={`mt-2 text-sm leading-6 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{createdEnrollmentId ? 'O processo já foi criado com identidade protegida. Complete agora os dados administrativos antes da validação.' : 'Escolha se o aluno é novo ou já possui registo. O Nexus confirma a identidade antes de criar ou reutilizar uma pessoa.'}</p></div><button type="button" onClick={onClose} aria-label="Fechar" className={`rounded-lg p-2 ${light ? 'hover:bg-zinc-100' : 'hover:bg-white/5'}`}><X className="h-5 w-5" /></button></div>

    {createdEnrollmentId ? <>
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-500"><CheckCircle2 className="h-4 w-4 shrink-0" /> Processo criado. Os próximos dados ficam ligados a esta matrícula.</div>
      <EnrollmentRegistrationPanel enrollmentId={createdEnrollmentId} enrollmentStatus="draft" light={light} request={enrollmentRegistrationRequest} compact />
      <button type="button" onClick={() => void onCreated()} className={`mt-5 min-h-11 w-full rounded-lg border px-4 py-2.5 text-sm font-semibold ${light ? 'border-zinc-200 text-zinc-700 hover:bg-zinc-50' : 'border-white/10 text-zinc-200 hover:bg-white/5'}`}>Voltar à fila de matrículas</button>
    </> : <>
      {offers.length === 0 ? <div className="mt-6 rounded-xl border border-amber-500/30 p-4 text-sm text-amber-500">Não existe uma oferta de matrícula ativa.</div> : <><div className="mt-6"><EnrollmentEntryIntentSelector value={intent} onChange={chooseIntent} /></div>{intent && <EnrollmentEntryForm intent={intent} offers={offers} name={name} birthDate={birthDate} phone={phone} studentNumber={studentNumber} legacyStudentId={legacyStudentId} offerId={offerId} busy={busy} resolved={Boolean(resolution)} light={light} onSubmit={intent === 'existing' ? identify : (event) => { event.preventDefault(); void start(); }} setName={setName} setBirthDate={setBirthDate} setPhone={setPhone} setStudentNumber={setStudentNumber} setLegacyStudentId={setLegacyStudentId} setOfferId={setOfferId} />}</>}
      {error && <div role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500">{error}</div>}
      {intent === 'existing' && resolution && <div className={`mt-6 rounded-xl border p-4 ${light ? 'border-zinc-200 bg-slate-50' : 'border-white/10 bg-zinc-950/60'}`}><p className={`font-semibold ${light ? 'text-zinc-900' : 'text-white'}`}>{resolution.status === 'LOCAL_MATCH' ? 'Registo local encontrado com segurança' : resolution.status === 'NO_MATCH' ? 'Nenhum aluno existente encontrado' : 'Confirmação adicional necessária'}</p><p className={`mt-2 text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{resolution.status === 'LOCAL_MATCH' ? 'O Nexus pode reutilizar este registo sem criar uma pessoa duplicada.' : resolution.status === 'NO_MATCH' ? 'Os dados não correspondem a um aluno existente nesta instituição. Se a pessoa for realmente nova, continue pelo fluxo Aluno novo.' : 'Há conflito ou mais de uma correspondência possível. O Nexus não vai escolher automaticamente uma identidade.'}</p><div className="mt-4 flex flex-wrap gap-2">{canStartExisting && <button type="button" onClick={() => void start()} disabled={busy} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Iniciar processo</button>}{resolution.status === 'NO_MATCH' && <button type="button" onClick={() => chooseIntent('new')} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Tratar como aluno novo</button>}<button type="button" onClick={() => { setResolution(null); setError(null); }} className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold ${light ? 'border-zinc-200 text-zinc-700' : 'border-white/10 text-zinc-200'}`}>Rever dados</button></div></div>}
    </>}
  </aside></div>;
}
