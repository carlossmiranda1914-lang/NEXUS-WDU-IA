import { readFile, writeFile } from 'node:fs/promises';

const target = 'src/components/EnrollmentOperationsWorkspace.tsx';
let source = await readFile(target, 'utf8');
const start = source.indexOf('function NewEntryDrawer(');
const end = source.indexOf('\nfunction Field(', start);
if (start === -1 || end === -1) throw new Error('S02.1 intake drawer anchors not found.');

const replacement = `type EntryIntent = 'new' | 'existing';

function NewEntryDrawer({ offers, light, onClose, onCreated }: { offers: Offer[]; light: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
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
  const student = useMemo(() => ({ name: name.trim(), ...(birthDate ? { birthDate } : {}), ...(phone.trim() ? { phone: phone.trim() } : {}), ...(studentNumber.trim() ? { studentNumber: studentNumber.trim() } : {}), ...(legacyStudentId.trim() ? { legacyStudentId: legacyStudentId.trim() } : {}) }), [name, birthDate, phone, studentNumber, legacyStudentId]);
  const canStart = resolution?.status === 'LOCAL_MATCH';

  function resetIntent(next: EntryIntent | null) {
    setIntent(next);
    setResolution(null);
    setError(null);
    setStudentNumber('');
    setLegacyStudentId('');
  }

  async function identify(event: FormEvent) {
    event.preventDefault();
    if (intent !== 'existing') return;
    setBusy(true); setError(null);
    try { const result = await request('/api/enrollments/person-resolution', { method: 'POST', body: JSON.stringify({ student }) }); setResolution(result.resolution); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível confirmar a identidade.'); }
    finally { setBusy(false); }
  }

  async function start() {
    if (!intent || !offerId || name.trim().length < 3) return;
    if (intent === 'existing' && !canStart) return;
    setBusy(true); setError(null);
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.() || \\`enrollment-\\${Date.now()}-\\${Math.random().toString(36).slice(2)}\\`;
      await request('/api/enrollments/intake', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ offerId, student }) });
      await onCreated();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível iniciar o processo.'); }
    finally { setBusy(false); }
  }

  const fieldDisabled = busy || Boolean(resolution);
  const choiceClass = (active: boolean) => \\`min-h-20 rounded-xl border p-4 text-left transition \\${active ? 'border-indigo-500 bg-indigo-500/10' : light ? 'border-zinc-200 bg-white hover:bg-zinc-50' : 'border-white/10 bg-zinc-950/50 hover:bg-white/5'}\\`;

  return <div className="fixed inset-0 z-[12000] flex justify-end bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className={\\`h-full w-full max-w-xl overflow-y-auto border-l p-5 shadow-2xl sm:p-6 \\${light ? 'border-zinc-200 bg-white' : 'border-white/10 bg-zinc-900'}\\`}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Nova entrada</p><h2 className={\\`mt-1 text-xl font-bold \\${light ? 'text-zinc-900' : 'text-white'}\\`}>Começar processo de matrícula</h2><p className={\\`mt-2 text-sm leading-6 \\${light ? 'text-zinc-500' : 'text-zinc-400'}\\`}>Indique primeiro se está a matricular um aluno novo ou alguém que já possui registo. O servidor confirma sempre a identidade antes de criar ou reutilizar uma pessoa.</p></div><button type="button" onClick={onClose} className={\\`rounded-lg p-2 \\${light ? 'hover:bg-zinc-100' : 'hover:bg-white/5'}\\`}><X className="h-5 w-5" /></button></div>
    {offers.length === 0 ? <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-500">Não existe uma oferta de matrícula ativa. A Administração ou Direção deve preparar a oferta do ano letivo ativo antes de iniciar entradas.</div> : <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Tipo de aluno">
        <button type="button" onClick={() => resetIntent('new')} className={choiceClass(intent === 'new')}><p className={\\`text-sm font-bold \\${light ? 'text-zinc-900' : 'text-white'}\\`}>Aluno novo</p><p className={\\`mt-1 text-xs leading-5 \\${light ? 'text-zinc-500' : 'text-zinc-400'}\\`}>Ainda não possui registo conhecido. Preencha os dados e inicie a matrícula diretamente.</p></button>
        <button type="button" onClick={() => resetIntent('existing')} className={choiceClass(intent === 'existing')}><p className={\\`text-sm font-bold \\${light ? 'text-zinc-900' : 'text-white'}\\`}>Aluno existente</p><p className={\\`mt-1 text-xs leading-5 \\${light ? 'text-zinc-500' : 'text-zinc-400'}\\`}>Já estudou ou possui referência. Confirme a identidade antes de reutilizar o registo.</p></button>
      </div>

      {intent && <form onSubmit={intent === 'existing' ? identify : (event) => { event.preventDefault(); void start(); }} className="mt-6 space-y-4">
        <label className={\\`block text-xs font-semibold \\${light ? 'text-zinc-700' : 'text-zinc-300'}\\`}>Nome completo<input required minLength={3} maxLength={160} value={name} disabled={fieldDisabled} onChange={(e) => setName(e.target.value)} className={\\`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-indigo-500 disabled:opacity-60 \\${light ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/10 bg-zinc-950 text-white'}\\`} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Data de nascimento" type="date" value={birthDate} setValue={setBirthDate} disabled={fieldDisabled} light={light} /><Field label="Telefone" value={phone} setValue={setPhone} disabled={fieldDisabled} light={light} />{intent === 'existing' && <><Field label="N.º do aluno, se já existir" value={studentNumber} setValue={setStudentNumber} disabled={fieldDisabled} light={light} /><Field label="Referência antiga" value={legacyStudentId} setValue={setLegacyStudentId} disabled={fieldDisabled} light={light} /></>}</div>
        <label className={\\`block text-xs font-semibold \\${light ? 'text-zinc-700' : 'text-zinc-300'}\\`}>Oferta / ano letivo<select required value={offerId} disabled={fieldDisabled} onChange={(e) => setOfferId(e.target.value)} className={\\`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-indigo-500 disabled:opacity-60 \\${light ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/10 bg-zinc-950 text-white'}\\`}>{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.academic_year_name} · {offer.name}</option>)}</select></label>
        {!resolution && <button disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : intent === 'new' ? <ArrowRight className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />} {intent === 'new' ? 'Iniciar matrícula' : 'Confirmar aluno existente'}</button>}
      </form>}
    </>}
    {error && <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
    {intent === 'existing' && resolution && <div className={\\`mt-6 rounded-2xl border p-5 \\${light ? 'border-zinc-200 bg-slate-50' : 'border-white/10 bg-zinc-950/60'}\\`}><div className="flex items-start gap-3"><div className="mt-0.5"><UserRound className="h-5 w-5 text-indigo-500" /></div><div><h3 className={\\`font-semibold \\${light ? 'text-zinc-900' : 'text-white'}\\`}>{resolution.status === 'LOCAL_MATCH' ? 'Registo local encontrado com segurança' : resolution.status === 'NO_MATCH' ? 'Nenhum registo existente encontrado' : 'Confirmação adicional necessária'}</h3><p className={\\`mt-1 text-sm leading-6 \\${light ? 'text-zinc-500' : 'text-zinc-400'}\\`}>{resolution.status === 'LOCAL_MATCH' ? 'O servidor encontrou um registo local seguro. Pode continuar sem criar uma pessoa duplicada.' : resolution.status === 'NO_MATCH' ? 'Não foi encontrado um registo existente. Se este aluno for realmente novo, volte e escolha “Aluno novo”.' : 'O Nexus não vai criar nem reutilizar uma pessoa automaticamente enquanto existir dúvida. Este caso precisa de revisão autorizada.'}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{canStart ? <button type="button" onClick={() => void start()} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Iniciar processo</button> : null}<button type="button" onClick={() => { setResolution(null); setError(null); }} disabled={busy} className={\\`min-h-11 rounded-lg border px-4 py-2.5 text-sm font-semibold \\${light ? 'border-zinc-200 text-zinc-700 hover:bg-white' : 'border-white/10 text-zinc-300 hover:bg-white/5'}\\`}>Rever dados</button></div></div>}
  </aside></div>;
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
await writeFile(target, source, { encoding: 'utf8' });
console.log('[S02.1] Enrollment intake intent applied.');
