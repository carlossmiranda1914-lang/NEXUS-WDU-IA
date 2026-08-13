import { FormEvent, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import EnrollmentEntryIntentSelector from './EnrollmentEntryIntentSelector.tsx';
import EnrollmentEntryForm from './EnrollmentEntryForm.tsx';
import { resolveExistingStudent, startProtectedEnrollment, type EnrollmentStudentDraft } from '../modules/enrollments/enrollment-intake-client.ts';

type Offer = { id: string; name: string; academic_year_name: string };
type EntryIntent = 'new' | 'existing';
type Resolution = { status: string };

export default function EnrollmentNewEntryDrawer({ offers, light, onClose, onCreated }: { offers: Offer[]; light: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
  const [intent, setIntent] = useState<EntryIntent | null>(null);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [legacyStudentId, setLegacyStudentId] = useState('');
  const [offerId, setOfferId] = useState(offers[0]?.id || '');
  const [resolution, setResolution] = useState<Resolution | null>(null);
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
    try { await startProtectedEnrollment(offerId, student); await onCreated(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível iniciar a matrícula.'); }
    finally { setBusy(false); }
  }

  async function identify(event: FormEvent) {
    event.preventDefault();
    if (intent !== 'existing') return;
    setBusy(true); setError(null);
    try { const result = await resolveExistingStudent(student); setResolution(result.resolution); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível confirmar o aluno.'); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-[12000] flex justify-end bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className={`h-full w-full max-w-xl overflow-y-auto border-l p-5 shadow-2xl sm:p-6 ${light ? 'border-zinc-200 bg-white' : 'border-white/10 bg-zinc-900'}`}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Nova entrada</p><h2 className={`mt-1 text-xl font-bold ${light ? 'text-zinc-900' : 'text-white'}`}>Começar processo de matrícula</h2><p className={`mt-2 text-sm ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>Escolha se o aluno é novo ou já possui registo.</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button></div>
    {offers.length === 0 ? <div className="mt-6 rounded-xl border border-amber-500/30 p-4 text-sm text-amber-500">Não existe uma oferta de matrícula ativa.</div> : <><div className="mt-6"><EnrollmentEntryIntentSelector value={intent} onChange={chooseIntent} /></div>{intent && <EnrollmentEntryForm intent={intent} offers={offers} name={name} birthDate={birthDate} phone={phone} studentNumber={studentNumber} legacyStudentId={legacyStudentId} offerId={offerId} busy={busy} resolved={Boolean(resolution)} light={light} onSubmit={intent === 'existing' ? identify : (event) => { event.preventDefault(); void start(); }} setName={setName} setBirthDate={setBirthDate} setPhone={setPhone} setStudentNumber={setStudentNumber} setLegacyStudentId={setLegacyStudentId} setOfferId={setOfferId} />}</>}
    {error && <div role="alert" className="mt-4 rounded-xl border border-rose-500/30 p-4 text-sm text-rose-500">{error}</div>}
    {intent === 'existing' && resolution && <div className={`mt-6 rounded-xl border p-4 ${light ? 'border-zinc-200 bg-slate-50' : 'border-white/10 bg-zinc-950/60'}`}><p className={`font-semibold ${light ? 'text-zinc-900' : 'text-white'}`}>{resolution.status === 'LOCAL_MATCH' ? 'Registo local encontrado com segurança' : resolution.status === 'NO_MATCH' ? 'Nenhum registo existente encontrado' : 'Confirmação adicional necessária'}</p>{canStartExisting && <button type="button" onClick={() => void start()} disabled={busy} className="mt-4 min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Iniciar processo</button>}</div>}
  </aside></div>;
}
