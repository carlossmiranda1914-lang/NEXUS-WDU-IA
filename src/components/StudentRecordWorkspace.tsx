import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, GraduationCap, LoaderCircle, RefreshCw, UserRound } from 'lucide-react';
import { auth } from '../lib/firebase.ts';

type Theme = 'light' | 'dark';
type Context = {
  student: { displayName: string; status: string };
  current: {
    enrollment: { status: string; academicYear: { name: string } } | null;
    placement: { status: string; academicYear: { name: string }; class: { code: string }; program: { name: string | null }; level: { name: string | null } } | null;
  };
  history: { placements: { items: Array<{ academicYear: { name: string }; class: { code: string }; program: { name: string | null }; level: { name: string | null } }>; nextOffset: number | null } };
};

async function request(path: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  const response = await fetch(path, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  if (!response.ok) throw new Error(response.status === 403 ? 'FORBIDDEN' : response.status === 404 ? 'NOT_FOUND' : `HTTP_${response.status}`);
  return response.json() as Promise<Context>;
}

export default function StudentRecordWorkspace({ studentRef, theme = 'dark', onBack }: { studentRef: string; theme?: Theme; onBack: () => void }) {
  const light = theme === 'light';
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<'summary' | 'journey'>('summary');
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setContext(await request(`/api/student-context/${studentRef}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'UNAVAILABLE'); }
    finally { setLoading(false); }
  }, [studentRef]);
  useEffect(() => { void load(); }, [load]);
  const text = light ? 'text-zinc-900' : 'text-zinc-100';
  const muted = light ? 'text-zinc-500' : 'text-zinc-400';
  const surface = light ? 'border-zinc-200 bg-white' : 'border-white/10 bg-zinc-900';
  const current = context?.current.placement;
  const year = current?.academicYear ?? context?.current.enrollment?.academicYear;
  const initials = context?.student.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'A';
  const safeError = error === 'AUTH_REQUIRED' ? 'Inicie sessão para consultar este registo.' : error === 'FORBIDDEN' ? 'Não tem acesso a este registo.' : error === 'NOT_FOUND' ? 'O registo pedido não está disponível nesta instituição.' : 'Não foi possível carregar o registo agora.';

  return <section aria-label="Registo do Aluno" className="mx-auto w-full max-w-6xl space-y-6">
    <nav aria-label="Contexto de navegação" className={`flex items-center gap-2 text-sm ${muted}`}><button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-medium text-emerald-700 hover:bg-emerald-500/10"><ArrowLeft className="h-4 w-4" />Alunos & Matrículas</button><span aria-hidden="true">/</span><span>Registo do Aluno</span></nav>
    {loading && <div role="status" className={`flex min-h-56 items-center justify-center gap-2 rounded-2xl border ${surface} ${muted}`}><LoaderCircle className="h-5 w-5 animate-spin" />A carregar registo do aluno…</div>}
    {error && <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-600"><strong>{safeError}</strong><button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold underline"><RefreshCw className="h-4 w-4" />Tentar novamente</button></div>}
    {context && !loading && <>
      <header className={`rounded-2xl border p-5 sm:p-7 ${surface}`}><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-4"><div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 font-bold text-emerald-700">{initials}</div><div className="min-w-0"><p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Registo do Aluno</p><h1 className={`mt-1 break-words text-2xl font-bold ${text}`}>{context.student.displayName}</h1><span className="mt-2 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">Aluno institucionalmente ativo</span></div></div><div className={`grid grid-cols-2 gap-x-6 gap-y-3 text-sm ${muted}`}><p><span className="block text-xs">Ano letivo</span><strong className={text}>{year?.name || 'Sem ano letivo atual'}</strong></p><p><span className="block text-xs">Turma</span><strong className={text}>{current?.class.code || 'Sem turma atual'}</strong></p></div></div></header>
      <nav aria-label="Secções do registo" className={`flex gap-2 border-b ${light ? 'border-zinc-200' : 'border-white/10'}`}><button type="button" onClick={() => setSection('summary')} className={`min-h-11 px-3 text-sm font-semibold ${section === 'summary' ? 'border-b-2 border-emerald-600 text-emerald-700' : muted}`}>Resumo</button><button type="button" onClick={() => setSection('journey')} className={`min-h-11 px-3 text-sm font-semibold ${section === 'journey' ? 'border-b-2 border-emerald-600 text-emerald-700' : muted}`}>Percurso académico</button></nav>
      {section === 'summary' ? <section className={`rounded-2xl border p-5 sm:p-7 ${surface}`}><div className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-emerald-700" /><div><h2 className={`font-semibold ${text}`}>Resumo</h2><p className={`mt-1 text-sm ${muted}`}>Contexto académico atual autorizado.</p></div></div><dl className={`mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${muted}`}><div><dt className="text-xs">Estado</dt><dd className={`mt-1 font-medium ${text}`}>{context.student.status === 'active' ? 'Ativo' : 'Indisponível'}</dd></div><div><dt className="text-xs">Ano letivo atual</dt><dd className={`mt-1 font-medium ${text}`}>{year?.name || 'Não existe contexto atual'}</dd></div><div><dt className="text-xs">Turma atual</dt><dd className={`mt-1 font-medium ${text}`}>{current?.class.code || 'Não atribuída'}</dd></div><div><dt className="text-xs">Curso e classe</dt><dd className={`mt-1 font-medium ${text}`}>{[current?.program.name, current?.level.name].filter(Boolean).join(' · ') || 'Não definidos'}</dd></div></dl>{!current && <p role="status" className={`mt-6 rounded-xl border p-4 text-sm ${light ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-amber-500/25 bg-amber-500/10 text-amber-100'}`}>Não existe uma situação académica atual autorizada para apresentar.</p>}</section> : <section className={`rounded-2xl border p-5 sm:p-7 ${surface}`}><h2 className={`font-semibold ${text}`}>Percurso académico</h2><div className={`mt-5 rounded-xl border p-4 ${light ? 'border-emerald-200 bg-emerald-50' : 'border-emerald-500/25 bg-emerald-500/10'}`}><p className="text-xs font-semibold text-emerald-700">Situação atual</p><p className={`mt-2 font-medium ${text}`}>{[year?.name, current?.class.code, current?.level.name, current?.program.name].filter(Boolean).join(' · ') || 'Não existe contexto académico atual autorizado.'}</p></div><h3 className={`mt-6 text-sm font-semibold ${text}`}>Percurso anterior</h3>{context.history.placements.items.length === 0 ? <p role="status" className={`mt-3 text-sm ${muted}`}>Ainda não existem registos académicos anteriores.</p> : <ol className={`mt-3 divide-y rounded-xl border ${light ? 'divide-zinc-200 border-zinc-200' : 'divide-white/10 border-white/10'}`}>{context.history.placements.items.map((item) => <li key={`${item.academicYear.name}-${item.class.code}`} className="p-4"><p className={`font-medium ${text}`}>{item.academicYear.name} · {item.class.code}</p><p className={`mt-1 text-sm ${muted}`}>{[item.level.name, item.program.name].filter(Boolean).join(' · ') || 'Contexto académico registado'}</p></li>)}</ol>}</section>}
    </>}
  </section>;
}
