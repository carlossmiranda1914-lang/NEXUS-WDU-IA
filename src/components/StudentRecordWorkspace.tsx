import { ArrowLeft, GraduationCap, LoaderCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '../lib/firebase.ts';

type Theme = 'light' | 'dark';
type DocumentStatus = 'pending' | 'submitted' | 'verified' | 'rejected';
type Section = 'summary' | 'journey' | 'enrollments' | 'documents' | 'guardians';
type Context = {
  student: { displayName: string; status: string };
  current: { enrollment: { status: string; academicYear: { name: string } } | null; placement: { status: string; academicYear: { name: string }; class: { code: string }; program: { name: string | null }; level: { name: string | null } } | null };
  history: { enrollments: { items: Array<{ status: string; academicYear: { name: string } }>; nextOffset: number | null }; placements: { items: Array<{ academicYear: { name: string }; class: { code: string }; program: { name: string | null }; level: { name: string | null } }>; nextOffset: number | null } };
  documents: { metadata: Array<{ type: string | null; status: DocumentStatus | null; verifiedAt: string | null }> };
  guardians: { items: Array<{ name: string | null; relationship: string | null; status: string | null }> };
};

const documentStatusLabel: Record<DocumentStatus, string> = { pending: 'Pendente', submitted: 'Referência recebida', verified: 'Verificado', rejected: 'Rejeitado' };
const guardianStatusLabel: Record<string, string> = { active: 'Ativa', inactive: 'Inativa', revoked: 'Revogada' };
const studentStatusLabel: Record<string, string> = { active: 'Ativo' };

async function request(path: string, signal?: AbortSignal) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  const response = await fetch(path, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, signal });
  if (!response.ok) throw new Error(response.status === 403 ? 'FORBIDDEN' : response.status === 404 ? 'NOT_FOUND' : `HTTP_${response.status}`);
  return response.json() as Promise<Context>;
}

export default function StudentRecordWorkspace({ studentRef, theme = 'dark', onBack }: { studentRef: string; theme?: Theme; onBack: () => void }) {
  const light = theme === 'light';
  const [context, setContext] = useState<Context | null>(null);
  const [contextStudentRef, setContextStudentRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStudentRef, setErrorStudentRef] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('summary');
  const studentRequestSequence = useRef(0);
  const studentRequestController = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    const requestId = ++studentRequestSequence.current;
    studentRequestController.current?.abort();
    const controller = new AbortController();
    studentRequestController.current = controller;
    setContext(null);
    setContextStudentRef(null);
    setLoading(true);
    setError(null);
    setErrorStudentRef(null);
    try {
      const nextContext = await request(`/api/student-context/${studentRef}`, controller.signal);
      if (requestId !== studentRequestSequence.current) return;
      setContext(nextContext);
      setContextStudentRef(studentRef);
      setErrorStudentRef(null);
    } catch (cause) {
      if (requestId !== studentRequestSequence.current) return;
      setContext(null);
      setContextStudentRef(null);
      setError(cause instanceof Error ? cause.message : 'UNAVAILABLE');
      setErrorStudentRef(studentRef);
    } finally {
      if (requestId === studentRequestSequence.current) setLoading(false);
    }
  }, [studentRef]);
  useEffect(() => {
    void load();
    return () => {
      studentRequestSequence.current += 1;
      studentRequestController.current?.abort();
    };
  }, [load]);

  const text = light ? 'text-zinc-900' : 'text-zinc-100';
  const muted = light ? 'text-zinc-500' : 'text-zinc-400';
  const surface = light ? 'border-zinc-200 bg-white' : 'border-white/10 bg-zinc-900';
  const current = context?.current.placement;
  const year = current?.academicYear ?? context?.current.enrollment?.academicYear;
  const initials = context?.student.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'A';
  const safeError = error === 'AUTH_REQUIRED' ? 'Inicie sessão para consultar este registo.' : error === 'FORBIDDEN' ? 'Não tem acesso a este registo.' : error === 'NOT_FOUND' ? 'O registo pedido não está disponível nesta instituição.' : 'Não foi possível carregar o registo agora.';
  const studentStatus = context ? studentStatusLabel[context.student.status] || 'Estado não disponível' : null;
  const formatVerifiedAt = (value: string | null) => value ? new Intl.DateTimeFormat('pt-AO', { dateStyle: 'medium' }).format(new Date(value)) : null;
  const tabClass = (active: boolean) => `min-h-11 shrink-0 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${active ? 'border-b-2 border-emerald-600 text-emerald-700' : `${muted} hover:text-emerald-700`}`;
  const listClass = `mt-3 divide-y rounded-xl border ${light ? 'divide-zinc-200 border-zinc-200' : 'divide-white/10 border-white/10'}`;

  return <section aria-label="Registo do Aluno" className="mx-auto w-full max-w-6xl space-y-6">
    <nav aria-label="Contexto de navegação" className={`flex items-center gap-2 text-sm ${muted}`}><button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-medium text-emerald-700 hover:bg-emerald-500/10"><ArrowLeft className="h-4 w-4" />Alunos & Matrículas</button><span aria-hidden="true">/</span><span>Registo do Aluno</span></nav>
    {loading && <div role="status" className={`flex min-h-56 items-center justify-center gap-2 rounded-2xl border ${surface} ${muted}`}><LoaderCircle className="h-5 w-5 animate-spin" />A carregar registo do aluno…</div>}
    {error && errorStudentRef === studentRef && <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-600"><strong>{safeError}</strong><button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold underline"><RefreshCw className="h-4 w-4" />Tentar novamente</button></div>}
    {context && contextStudentRef === studentRef && !loading && <>
      <header className={`rounded-2xl border p-5 sm:p-7 ${surface}`}><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-4"><div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 font-bold text-emerald-700">{initials}</div><div className="min-w-0"><p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Registo do Aluno</p><h1 className={`mt-1 break-words text-2xl font-bold ${text}`}>{context.student.displayName}</h1><div className="mt-2 flex flex-wrap items-center gap-2"><span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">{studentStatus}</span><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('nexus-open-finance', { detail: { studentRef } }))} className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors ${light ? 'border-zinc-300 text-zinc-700 hover:bg-zinc-50' : 'border-white/10 text-zinc-300 hover:bg-white/5'}`}>Ver situação financeira</button></div></div></div><div className={`grid grid-cols-2 gap-x-6 gap-y-3 text-sm ${muted}`}><p><span className="block text-xs">Ano letivo</span><strong className={text}>{year?.name || 'Sem ano letivo atual'}</strong></p><p><span className="block text-xs">Turma</span><strong className={text}>{current?.class.code || 'Sem turma atual'}</strong></p></div></div></header>
      <nav aria-label="Secções do registo" className={`flex flex-wrap gap-1 border-b pb-2 sm:flex-nowrap sm:gap-2 sm:overflow-x-auto sm:pb-0 ${light ? 'border-zinc-200' : 'border-white/10'}`}><button type="button" onClick={() => setSection('summary')} className={tabClass(section === 'summary')}>Resumo</button><button type="button" onClick={() => setSection('journey')} className={tabClass(section === 'journey')}>Percurso académico</button><button type="button" onClick={() => setSection('enrollments')} className={tabClass(section === 'enrollments')}>Matrículas</button><button type="button" onClick={() => setSection('documents')} className={tabClass(section === 'documents')}>Documentos</button><button type="button" onClick={() => setSection('guardians')} className={tabClass(section === 'guardians')}>Encarregados</button></nav>
      {section === 'summary' ? <section className={`rounded-2xl border p-5 sm:p-7 ${surface}`}><div className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-emerald-700" /><div><h2 className={`font-semibold ${text}`}>Resumo</h2><p className={`mt-1 text-sm ${muted}`}>Contexto académico no cabeçalho.</p></div></div><dl className={`mt-6 grid gap-4 sm:grid-cols-2 ${muted}`}><div><dt className="text-xs">Curso e classe</dt><dd className={`mt-1 font-medium ${text}`}>{[current?.program.name, current?.level.name].filter(Boolean).join(' · ') || 'Não definidos'}</dd></div></dl>{!current && <p role="status" className={`mt-6 rounded-xl border p-4 text-sm ${light ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-amber-500/25 bg-amber-500/10 text-amber-100'}`}>Não existe uma situação académica atual autorizada para apresentar.</p>}</section> : section === 'journey' ? <section className={`rounded-2xl border p-5 sm:p-7 ${surface}`}><h2 className={`font-semibold ${text}`}>Percurso académico</h2><div className={`mt-5 rounded-xl border p-4 ${light ? 'border-emerald-200 bg-emerald-50' : 'border-emerald-500/25 bg-emerald-500/10'}`}><p className="text-xs font-semibold text-emerald-700">Situação atual</p><p className={`mt-2 font-medium ${text}`}>{[year?.name, current?.class.code, current?.level.name, current?.program.name].filter(Boolean).join(' · ') || 'Não existe contexto académico atual autorizado.'}</p></div><h3 className={`mt-6 text-sm font-semibold ${text}`}>Percurso anterior</h3>{context.history.placements.items.length === 0 ? <p role="status" className={`mt-3 text-sm ${muted}`}>Ainda não existem registos académicos anteriores.</p> : <ol className={listClass}>{context.history.placements.items.map((item) => <li key={`${item.academicYear.name}-${item.class.code}`} className="p-4"><p className={`font-medium ${text}`}>{item.academicYear.name} · {item.class.code}</p><p className={`mt-1 text-sm ${muted}`}>{[item.level.name, item.program.name].filter(Boolean).join(' · ') || 'Contexto académico registado'}</p></li>)}</ol>}</section> : section === 'enrollments' ? <section className={`rounded-2xl border p-5 sm:p-7 ${surface}`}><h2 className={`font-semibold ${text}`}>Matrículas</h2><div className={`mt-5 rounded-xl border p-4 ${light ? 'border-emerald-200 bg-emerald-50' : 'border-emerald-500/25 bg-emerald-500/10'}`}><p className="text-xs font-semibold text-emerald-700">Matrícula atual</p><p className={`mt-2 font-medium ${text}`}>{context.current.enrollment?.academicYear.name || 'Não existe uma matrícula atual autorizada para apresentar.'}</p></div><h3 className={`mt-6 text-sm font-semibold ${text}`}>Matrículas anteriores</h3>{context.history.enrollments.items.length === 0 ? <p role="status" className={`mt-3 text-sm ${muted}`}>Ainda não existem matrículas anteriores.</p> : <ol className={listClass}>{context.history.enrollments.items.map((item) => <li key={`${item.academicYear.name}-${item.status}`} className="p-4"><p className={`font-medium ${text}`}>{item.academicYear.name}</p></li>)}</ol>}</section> : section === 'documents' ? <section className={`rounded-2xl border p-5 sm:p-7 ${surface}`}><h2 className={`font-semibold ${text}`}>Documentos</h2>{context.documents.metadata.length === 0 ? <p role="status" className={`mt-4 text-sm ${muted}`}>Ainda não existem documentos registados para este aluno.</p> : <ol className={`mt-4 ${listClass}`}>{context.documents.metadata.map((document, index) => <li key={`${document.type ?? 'sem-tipo'}-${index}`} className="p-4"><div className="flex flex-wrap items-start justify-between gap-2"><p className={`font-medium ${text}`}>{document.type || 'Documento sem tipo indicado'}</p><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${muted}`}>{document.status ? documentStatusLabel[document.status] : 'Estado não disponível'}</span></div>{document.verifiedAt && <p className={`mt-2 text-sm ${muted}`}>Verificado em {formatVerifiedAt(document.verifiedAt)}</p>}</li>)}</ol>}</section> : <section className={`rounded-2xl border p-5 sm:p-7 ${surface}`}><h2 className={`font-semibold ${text}`}>Encarregados</h2>{context.guardians.items.length === 0 ? <p role="status" className={`mt-4 text-sm ${muted}`}>Ainda não existem encarregados associados a este aluno.</p> : <ol className={`mt-4 ${listClass}`}>{context.guardians.items.map((guardian, index) => <li key={`${guardian.name}-${guardian.relationship}-${index}`} className="p-4"><div className="flex flex-wrap items-start justify-between gap-2"><p className={`font-medium ${text}`}>{guardian.name || 'Nome não disponível'}</p>{guardian.status && <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${muted}`}>{guardianStatusLabel[guardian.status] || 'Estado não disponível'}</span>}</div><p className={`mt-1 text-sm ${muted}`}>{guardian.relationship || 'Relação não indicada'}</p></li>)}</ol>}</section>}
    </>}
  </section>;
}
