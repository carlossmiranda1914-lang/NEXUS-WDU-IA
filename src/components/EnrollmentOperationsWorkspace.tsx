import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  FileWarning,
  GraduationCap,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { auth } from '../lib/firebase.ts';
import EnrollmentNewEntryDrawer from './EnrollmentNewEntryDrawer.tsx';
import EnrollmentLifecycleActions from './EnrollmentLifecycleActions.tsx';
import EnrollmentDocumentChecklist from './EnrollmentDocumentChecklist.tsx';
import {
  buildOperationalMetrics,
  getAttentionQueue,
  nextAction,
  recordsForView,
  STATUS_LABELS,
  type EnrollmentOperationalRecord,
  type EnrollmentOperationalStatus,
  type OperationalView,
} from '../modules/enrollments/enrollment-operations-model.ts';
import { buildEnrollmentLifecyclePresentation } from '../modules/enrollments/enrollment-lifecycle-presentation.ts';

type Theme = 'light' | 'dark';
type Offer = { id: string; name: string; code: string; academic_year_id: string; academic_year_name: string };
type Resolution = {
  status: 'NO_MATCH' | 'LOCAL_MATCH' | 'REUSABLE_MATCH' | 'MULTIPLE_MATCHES' | 'RESTRICTED_POSSIBLE_MATCH' | 'REVIEW_REQUIRED';
  candidateCount: number;
};

type ProcessAction = { code: string; label: string; available: boolean; unavailableReason: string | null };
type ProcessProjection = {
  enrollmentId: string;
  enrollmentStatus: EnrollmentOperationalStatus;
  currentStage: string;
  progress: { completed: number; applicable: number; percent: number };
  assignedTo: { personId: string; name: string | null } | null;
  stages: Array<{ key: string; label: string; status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'not_applicable'; reasonCode: string | null; nextAction: ProcessAction | null; evidence: { summary: string; source: string } }>;
  nextAction: ProcessAction | null;
  blockers: Array<{ reasonCode: string; message: string; stage: string }>;
  version: number;
  timestamps: { startedAt: string; lastProgressAt: string; blockedAt: string | null; updatedAt: string };
};
type ActiveStudent = {
  studentRef: string;
  displayName: string;
  status: 'active';
  current: {
    academicYear: { name: string } | null;
    class: { code: string } | null;
    program: { code: string; name: string | null } | null;
    level: { code: string; name: string | null } | null;
  } | null;
};
type StudentRecordContext = {
  student: { displayName: string; status: string };
  current: {
    enrollment: { status: string; academicYear: { name: string } } | null;
    placement: {
      status: string;
      academicYear: { name: string };
      class: { code: string };
      program: { code: string; name: string | null };
      level: { code: string; name: string | null };
    } | null;
  };
};

const VIEW_LABELS: Array<{ id: OperationalView; label: string }> = [
  { id: 'overview', label: 'Visão Operacional' },
  { id: 'entries', label: 'Entradas' },
  { id: 'enrollments', label: 'Matrículas' },
  { id: 'students', label: 'Alunos ativos' },
];

const STATUS_TONE: Record<EnrollmentOperationalStatus, string> = {
  draft: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-300',
  under_review: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
  awaiting_documents: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  validated: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  blocked: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
  active: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  cancelled: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
};

async function request(path: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Inicie sessão para aceder à área de matrículas.');
  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.');
  return body;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function statusExplanation(status: EnrollmentOperationalStatus) {
  switch (status) {
    case 'draft': return 'O processo foi iniciado e ainda precisa de preparação.';
    case 'under_review': return 'A Secretaria está a verificar os dados do processo.';
    case 'awaiting_documents': return 'Existem documentos necessários ainda por receber ou tratar.';
    case 'validated': return 'As verificações atuais permitem encaminhar o processo para decisão.';
    case 'blocked': return 'Existe uma condição que impede o avanço normal do processo.';
    case 'active': return 'A matrícula está ativa e o aluno integra o contexto escolar.';
    case 'cancelled': return 'O processo foi cancelado e permanece apenas para histórico.';
  }
}

export default function EnrollmentOperationsWorkspace({ theme = 'dark', onOpenStudentRecord }: { theme?: Theme; onOpenStudentRecord: (studentRef: string) => void }) {
  const light = theme === 'light';
  const surface = light ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-white/10';
  const mutedSurface = light ? 'bg-slate-50 border-zinc-200' : 'bg-zinc-950/60 border-white/5';
  const text = light ? 'text-zinc-900' : 'text-zinc-100';
  const muted = light ? 'text-zinc-500' : 'text-zinc-400';

  const [records, setRecords] = useState<EnrollmentOperationalRecord[]>([]);
  const [activeStudents, setActiveStudents] = useState<ActiveStudent[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [institutionName, setInstitutionName] = useState('');
  const [view, setView] = useState<OperationalView>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EnrollmentOperationalStatus[] | null>(null);
  const [selected, setSelected] = useState<EnrollmentOperationalRecord | null>(null);
  const [activeStudentError, setActiveStudentError] = useState<string | null>(null);
  const [selectedLifecycleLabel, setSelectedLifecycleLabel] = useState<string | null>(null);
  const [newEntryOpen, setNewEntryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActiveStudentError(null);
    try {
      const [context, list, students] = await Promise.allSettled([
        request('/api/enrollments/context'),
        request('/api/enrollments'),
        request('/api/active-students'),
      ]);
      if (context.status === 'rejected') throw context.reason;
      if (list.status === 'rejected') throw list.reason;
      setOffers(Array.isArray(context.value.offers) ? context.value.offers : []);
      setInstitutionName(context.value.institution?.name || 'Instituição atual');
      setRecords(Array.isArray(list.value.enrollments) ? list.value.enrollments : []);
      if (students.status === 'fulfilled') setActiveStudents(Array.isArray(students.value.students) ? students.value.students : []);
      else { setActiveStudents([]); setActiveStudentError(students.reason instanceof Error ? students.reason.message : 'Não foi possível carregar os alunos ativos.'); }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a operação de matrículas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => buildOperationalMetrics(records), [records]);
  const attention = useMemo(() => getAttentionQueue(records), [records]);
  const lifecycle = useMemo(() => buildEnrollmentLifecyclePresentation(records, activeStudents.length), [records, activeStudents.length]);
  const visible = useMemo(() => {
    let base = recordsForView(records, view);
    if (statusFilter) base = records.filter((record) => statusFilter.includes(record.status));
    const term = query.trim().toLocaleLowerCase('pt');
    if (term) {
      base = base.filter((record) => [record.student_name, record.guardian_name, record.offer_name, record.academic_year_name]
        .filter(Boolean).some((value) => String(value).toLocaleLowerCase('pt').includes(term)));
    }
    return base;
  }, [records, view, statusFilter, query]);
  const visibleStudents = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt');
    return term ? activeStudents.filter((student) => [student.displayName, student.current?.academicYear?.name, student.current?.class?.code, student.current?.program?.name, student.current?.level?.name].filter(Boolean).some((value) => String(value).toLocaleLowerCase('pt').includes(term))) : activeStudents;
  }, [activeStudents, query]);

  function selectMetric(filter: EnrollmentOperationalStatus[]) {
    setStatusFilter(filter);
    setView('enrollments');
  }

  return (
    <section className="min-w-0 max-w-full space-y-5 overflow-x-hidden sm:space-y-6" aria-label="Workspace operacional de Alunos e Matrículas">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="break-words text-[10px] font-bold uppercase leading-5 tracking-[0.14em] text-emerald-700 sm:tracking-[0.18em]">Secretaria escolar</p>
          <h1 className={`text-2xl font-bold tracking-tight ${text}`}>{view === 'students' ? 'Alunos ativos' : 'Alunos & Matrículas'}</h1>
          <p className={`max-w-3xl text-sm leading-6 ${muted}`}>{view === 'students' ? 'Encontre e abra o registo atual de cada aluno ativo.' : 'Entradas, matrículas em curso, exceções e alunos ativos num único fluxo operacional. Os indicadores abaixo são calculados apenas a partir dos processos reais da instituição atual.'}</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <button type="button" onClick={() => void load()} disabled={loading} className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-semibold sm:w-auto ${light ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50' : 'border-white/10 bg-zinc-900 text-zinc-300 hover:bg-white/5'} disabled:opacity-50`}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          {view !== 'students' && <button type="button" onClick={() => setNewEntryOpen(true)} className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-center text-xs font-bold text-white hover:bg-emerald-600 sm:w-auto">
            <Plus className="h-4 w-4" /> Nova entrada / matrícula
          </button>}
        </div>
      </header>

      <nav className={`flex max-w-full gap-1 overflow-x-auto overscroll-x-contain border-b pb-3 ${light ? 'border-zinc-200' : 'border-white/10'}`} aria-label="Vistas de Alunos e Matrículas">
        {VIEW_LABELS.map((item) => (
          <button key={item.id} type="button" onClick={() => { setView(item.id); setStatusFilter(null); setSelectedLifecycleLabel(null); }} className={`min-h-11 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition ${view === item.id ? light ? 'bg-emerald-50 text-emerald-800' : 'bg-emerald-500/15 text-emerald-200' : light ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
            {item.label}
          </button>
        ))}
      </nav>

      {error && <div role="alert" className="flex gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500"><AlertCircle className="h-5 w-5 shrink-0" /><div><strong>Não foi possível carregar a operação.</strong><p className="mt-1 opacity-90">{error}</p></div></div>}
      {notice && <div role="status" className="flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-500"><CheckCircle2 className="h-5 w-5 shrink-0" />{notice}</div>}

      {loading ? (
        <div className={`flex min-h-64 items-center justify-center gap-3 rounded-2xl border ${surface} ${muted}`}><LoaderCircle className="h-5 w-5 animate-spin" /> A carregar processos da instituição…</div>
      ) : (
        <>
          {view === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
                {metrics.map((metric) => (
                  <button key={metric.id} type="button" onClick={() => selectMetric(metric.filter)} className={`flex min-h-40 min-w-0 flex-col rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${surface}`}>
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0"><p className={`text-xs font-semibold leading-5 ${muted}`}>{metric.label}</p><p className={`mt-2 text-3xl font-bold tabular-nums ${text}`}>{metric.value}</p></div>
                      <ChevronRight className={`mt-1 h-4 w-4 ${muted}`} />
                    </div>
                    <p className={`mt-auto pt-4 text-xs leading-5 ${muted}`}>{metric.description}</p>
                  </button>
                ))}
              </div>

              <div className={`rounded-2xl border p-5 ${surface}`}>
                <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className={`font-semibold ${text}`}>Percurso de alunos e matrículas</h2><p className={`mt-1 text-xs ${muted}`}>Acompanhe o percurso institucional. Cada etapa abre apenas uma vista existente; o estado continua a ser confirmado pelo servidor.</p></div><ShieldCheck className="h-5 w-5 text-emerald-700" /></div>
                <div className="grid max-w-full snap-x snap-mandatory grid-flow-col auto-cols-[minmax(168px,78vw)] gap-2 overflow-x-auto overscroll-x-contain pb-2 sm:auto-cols-[minmax(176px,42vw)] lg:auto-cols-[minmax(176px,24vw)] xl:auto-cols-[minmax(168px,1fr)]">
                  {lifecycle.map((stage, index) => (
                    <button key={stage.key} type="button" aria-label={`Abrir etapa ${stage.label}`} onClick={() => { setSelectedLifecycleLabel(stage.label); setStatusFilter(stage.statuses.length > 0 ? stage.statuses : null); setView(stage.selectedView); }} className={`group relative flex min-h-24 min-w-0 snap-start flex-col rounded-xl border p-3 text-left transition ${mutedSurface} cursor-pointer hover:border-emerald-500/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}>
                      <div className="flex min-w-0 items-start gap-2">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${light ? 'bg-zinc-200 text-zinc-700' : 'bg-white/10 text-zinc-300'}`}>{index + 1}</span>
                        <p className={`min-w-0 whitespace-normal break-normal text-sm font-semibold leading-5 [overflow-wrap:normal] ${text}`}>{stage.label}</p>
                      </div>
                      <div className="mt-auto flex min-w-0 items-end justify-between gap-2 pl-8 pt-3">
                        <span className={`min-w-0 text-[11px] leading-4 ${muted}`}>{stage.source === 'active-students' ? 'Alunos ativos' : 'Processos confirmados'}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className={`text-sm font-bold tabular-nums ${text}`}>{stage.count}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-emerald-700 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] 2xl:gap-6">
                <div className={`overflow-hidden rounded-2xl border ${surface}`}>
                  <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${light ? 'border-zinc-200' : 'border-white/10'}`}><div><h2 className={`font-semibold ${text}`}>O que precisa da minha atenção</h2><p className={`mt-1 text-xs ${muted}`}>Ordenado por bloqueio, dependências e antiguidade.</p></div><FileWarning className="h-5 w-5 text-amber-500" /></div>
                  {attention.length === 0 ? <EmptyState title="Nenhuma pendência operacional" body="Não existem processos reais que exijam atenção nesta instituição neste momento." light={light} /> : (
                    <ul className={`divide-y ${light ? 'divide-zinc-200' : 'divide-white/10'}`}>{attention.slice(0, 8).map((record) => <li key={record.id}><ProcessRow record={record} light={light} onOpen={() => setSelected(record)} /></li>)}</ul>
                  )}
                </div>

                <div className={`rounded-2xl border p-5 ${surface}`}>
                  <div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-emerald-700" /><h2 className={`font-semibold ${text}`}>Como trabalhar nesta área</h2></div>
                  <div className="mt-4 space-y-4">
                    <OperationalNote icon={<CircleDot className="h-4 w-4" />} title="Dados atuais" body="Os indicadores refletem os processos desta instituição." light={light} />
                    <OperationalNote icon={<Clock3 className="h-4 w-4" />} title="Prioridades primeiro" body="Pendências e bloqueios aparecem antes dos processos regulares." light={light} />
                    <OperationalNote icon={<UsersRound className="h-4 w-4" />} title="Alunos ativos" body="A vista Alunos apresenta apenas matrículas já ativadas." light={light} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'students' && <ActiveStudentsView students={visibleStudents} error={activeStudentError} light={light} onRetry={() => void load()} onOpen={onOpenStudentRecord} />}

          {view !== 'overview' && view !== 'students' && (
            <div className={`overflow-hidden rounded-2xl border ${surface}`}>
              <div className={`flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between ${light ? 'border-zinc-200' : 'border-white/10'}`}>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className={`font-semibold ${text}`}>{selectedLifecycleLabel || VIEW_LABELS.find((item) => item.id === view)?.label}</h2></div><p className={`mt-1 text-xs leading-5 ${muted}`}>{selectedLifecycleLabel ? 'A vista apresenta apenas dados institucionais confirmados pelo servidor.' : `${visible.length} registo${visible.length === 1 ? '' : 's'} real${visible.length === 1 ? '' : 'is'} nesta vista.`}</p></div>
                <div className="relative w-full sm:w-80"><Search aria-hidden="true" className={`pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 ${muted}`} /><input aria-label="Procurar processos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Procurar aluno, oferta ou ano" className={`min-h-11 w-full rounded-lg border py-2.5 pl-12 pr-3 text-sm outline-none focus:border-emerald-600 ${light ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/10 bg-zinc-950 text-white'}`} /></div>
              </div>
              {visible.length === 0 ? <EmptyState title="Nenhum processo nesta vista" body="Os dados desta vista são alimentados exclusivamente pelos processos institucionais persistidos." light={light} /> : <ul className={`divide-y ${light ? 'divide-zinc-200' : 'divide-white/10'}`}>{visible.map((record) => <li key={record.id}><ProcessRow record={record} light={light} onOpen={() => setSelected(record)} /></li>)}</ul>}
            </div>
          )}
        </>
      )}

      {selected && <ProcessDrawer record={selected} light={light} onClose={() => setSelected(null)} onTransition={async (toStatus) => { await request(`/api/enrollments/${selected.id}/transitions`, { method: 'POST', body: JSON.stringify({ toStatus }) }); await load(); setNotice('Estado da matrícula atualizado.'); }} />}
      {newEntryOpen && <EnrollmentNewEntryDrawer offers={offers} light={light} onClose={() => setNewEntryOpen(false)} onCreated={async () => { setNewEntryOpen(false); setNotice('Processo de matrícula iniciado com segurança e adicionado à fila institucional.'); await load(); setView('enrollments'); }} />}
    </section>
  );
}

function ActiveStudentsView({ students, error, light, onRetry, onOpen }: { students: ActiveStudent[]; error: string | null; light: boolean; onRetry: () => void; onOpen: (studentRef: string) => void }) {
  const surface = light ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-white/10';
  const text = light ? 'text-zinc-900' : 'text-zinc-100';
  const muted = light ? 'text-zinc-500' : 'text-zinc-400';
  return <div className={`overflow-hidden rounded-2xl border ${surface}`}>
    <div className={`flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between ${light ? 'border-zinc-200' : 'border-white/10'}`}><div><h2 className={`font-semibold ${text}`}>Alunos ativos</h2><p className={`mt-1 text-xs leading-5 ${muted}`}>{students.length} aluno{students.length === 1 ? '' : 's'} ativo{students.length === 1 ? '' : 's'} nesta instituição.</p></div></div>
    {error ? <div role="alert" className="m-4 flex gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500"><AlertCircle className="h-5 w-5 shrink-0" /><div className="min-w-0"><strong>Não foi possível carregar os alunos ativos.</strong><p className="mt-1">{error}</p><button type="button" onClick={onRetry} className="mt-3 underline">Tentar novamente</button></div></div> : students.length === 0 ? <EmptyState title="Ainda não existem alunos ativos nesta base" body="Os alunos ativos aparecem aqui quando o respetivo perfil institucional está ativo." light={light} /> : <ul className={`divide-y ${light ? 'divide-zinc-200' : 'divide-white/10'}`}>{students.map((student) => <li key={student.studentRef}><ActiveStudentRow student={student} light={light} onOpen={() => onOpen(student.studentRef)} /></li>)}</ul>}
  </div>;
}

function ActiveStudentRow({ student, light, onOpen }: { student: ActiveStudent; light: boolean; onOpen: () => void }) {
  const current = student.current;
  const summary = current?.class?.code
    ? `${current.class.code}${current.level?.name ? ` · ${current.level.name}` : ''}`
    : current?.level?.name || 'Contexto académico ainda não definido';
  return <article className={`grid min-w-0 gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-center sm:px-5 ${light ? 'hover:bg-emerald-50/40' : 'hover:bg-emerald-500/[0.04]'}`}>
    <div className="min-w-0"><p className={`line-clamp-2 break-words text-sm font-semibold leading-5 [overflow-wrap:anywhere] ${light ? 'text-zinc-900' : 'text-white'}`}>{student.displayName}</p><span className="mt-1.5 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold leading-4 text-emerald-700">Aluno ativo</span></div>
    <div className={`min-w-0 text-xs ${light ? 'text-zinc-600' : 'text-zinc-300'}`}><p className="break-words font-medium leading-5">{summary}</p><p className={`mt-1 break-words leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{current?.academicYear?.name || 'Ano letivo atual ainda não definido'}{current?.program?.name ? ` · ${current.program.name}` : ''}</p></div>
    <button type="button" onClick={onOpen} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-600/30 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10">Abrir registo <ChevronRight className="h-4 w-4" /></button>
  </article>;
}

function StudentRecordDrawer({ studentRef, light, onClose }: { studentRef: string; light: boolean; onClose: () => void }) {
  const [context, setContext] = useState<StudentRecordContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRecord = useCallback(async () => {
    setLoading(true); setError(null);
    try { setContext(await request(`/api/student-context/${studentRef}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o registo do aluno.'); }
    finally { setLoading(false); }
  }, [studentRef]);
  useEffect(() => { void loadRecord(); }, [loadRecord]);
  const text = light ? 'text-zinc-900' : 'text-white';
  const muted = light ? 'text-zinc-500' : 'text-zinc-400';
  const current = context?.current.placement;
  const currentYear = current?.academicYear ?? context?.current.enrollment?.academicYear;
  return <div className="fixed inset-0 z-[12000] flex justify-end bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className={`h-full w-full max-w-xl overflow-y-auto border-l p-4 shadow-2xl sm:p-6 ${light ? 'border-zinc-200 bg-white' : 'border-white/10 bg-zinc-900'}`} aria-label="Registo do Aluno"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">Registo do Aluno</p><h2 className={`mt-1 text-xl font-bold ${text}`}>{context?.student.displayName || 'A carregar registo…'}</h2></div><button type="button" aria-label="Fechar registo do aluno" onClick={onClose} className={`min-h-11 min-w-11 rounded-lg p-2 ${light ? 'hover:bg-zinc-100' : 'hover:bg-white/5'}`}><X className="h-5 w-5" /></button></div>{loading && <div className={`mt-6 flex min-h-40 items-center justify-center gap-2 rounded-2xl border ${light ? 'border-zinc-200 bg-slate-50 text-zinc-500' : 'border-white/10 bg-zinc-950/60 text-zinc-400'}`}><LoaderCircle className="h-4 w-4 animate-spin" /> A carregar contexto atual…</div>}{error && <div role="alert" className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500"><strong>Não foi possível abrir o registo.</strong><p className="mt-1">{error}</p><button type="button" onClick={() => void loadRecord()} className="mt-3 underline">Tentar novamente</button></div>}{context && !loading && <section className={`mt-6 rounded-2xl border p-4 ${light ? 'border-zinc-200 bg-slate-50' : 'border-white/10 bg-zinc-950/60'}`}><h3 className={`font-semibold ${text}`}>Contexto atual</h3><dl className={`mt-4 grid gap-3 text-sm ${muted}`}><div><dt className="text-xs">Ano letivo</dt><dd className={`mt-1 font-medium ${text}`}>{currentYear?.name || 'Ainda não definido'}</dd></div><div><dt className="text-xs">Turma</dt><dd className={`mt-1 font-medium ${text}`}>{current?.class?.code || 'Ainda não definida'}</dd></div><div><dt className="text-xs">Programa e nível</dt><dd className={`mt-1 font-medium ${text}`}>{[current?.program?.name, current?.level?.name].filter(Boolean).join(' · ') || 'Ainda não definidos'}</dd></div></dl></section>}</aside></div>;
}

function ProcessRow({ record, light, onOpen }: { record: EnrollmentOperationalRecord; light: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={`!grid h-auto w-full min-w-0 grid-cols-1 gap-x-5 gap-y-4 px-4 py-4 text-left transition sm:px-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_7.5rem_1rem] lg:items-start lg:gap-x-4 lg:gap-y-0 ${light ? 'hover:bg-emerald-50/40' : 'hover:bg-emerald-500/[0.04]'}`}>
      <div className="min-w-0">
        <p className={`line-clamp-2 break-words text-sm font-semibold leading-5 [overflow-wrap:anywhere] ${light ? 'text-zinc-900' : 'text-white'}`}>{record.student_name}</p>
        <span className={`mt-1.5 inline-flex max-w-full whitespace-normal rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4 ${STATUS_TONE[record.status]}`}>{STATUS_LABELS[record.status]}</span>
      </div>
      <div className={`min-w-0 text-xs ${light ? 'text-zinc-600' : 'text-zinc-300'}`}>
        <span className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide lg:sr-only ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>Oferta</span>
        <p className="line-clamp-2 break-words font-medium leading-5 [overflow-wrap:anywhere]">{record.offer_name}</p>
        <p className={`mt-1 break-words leading-5 [overflow-wrap:anywhere] ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{record.academic_year_name}</p>
      </div>
      <div className={`min-w-0 border-t pt-3 text-xs md:col-span-2 lg:col-span-1 lg:border-t-0 lg:pt-0 ${record.status === 'blocked' ? light ? 'border-rose-200 text-rose-600' : 'border-rose-500/20 text-rose-400' : light ? 'border-zinc-200 text-zinc-600' : 'border-white/10 text-zinc-300'}`}>
        <span className={`mb-1 block text-[10px] font-semibold uppercase tracking-wide lg:sr-only ${record.status === 'blocked' ? 'text-rose-500' : light ? 'text-zinc-500' : 'text-zinc-400'}`}>Próxima ação</span>
        <p className="break-words leading-5 [overflow-wrap:anywhere]">{nextAction(record)}</p>
      </div>
      <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t pt-3 text-xs md:col-span-2 lg:contents ${light ? 'border-zinc-200 text-zinc-500' : 'border-white/10 text-zinc-400'}`}>
        <span className="min-w-0 whitespace-nowrap leading-5"><span className="mr-1.5 font-semibold lg:sr-only">Atualizado</span>{formatDate(record.updated_at)}</span>
        <ChevronRight className="h-4 w-4 shrink-0 lg:mt-0.5" />
      </div>
    </button>
  );
}

function EmptyState({ title, body, light }: { title: string; body: string; light: boolean }) {
  return <div className="flex min-h-36 flex-col items-center justify-center px-6 py-8 text-center sm:min-h-40"><div className={`flex h-10 w-10 items-center justify-center rounded-full ${light ? 'bg-zinc-100 text-zinc-500' : 'bg-white/5 text-zinc-400'}`}><ClipboardCheck className="h-5 w-5" /></div><h3 className={`mt-3 text-sm font-semibold ${light ? 'text-zinc-900' : 'text-white'}`}>{title}</h3><p className={`mt-1 max-w-md text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{body}</p></div>;
}

function OperationalNote({ icon, title, body, light }: { icon: ReactNode; title: string; body: string; light: boolean }) {
  return <div className="flex gap-3"><div className={`mt-0.5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{icon}</div><div><p className={`text-xs font-semibold ${light ? 'text-zinc-800' : 'text-zinc-200'}`}>{title}</p><p className={`mt-1 text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{body}</p></div></div>;
}

function ProcessDrawer({ record, light, onClose, onTransition }: { record: EnrollmentOperationalRecord; light: boolean; onClose: () => void; onTransition: (toStatus: EnrollmentOperationalStatus) => Promise<void> }) {
  const [process, setProcess] = useState<ProcessProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const loadProcess = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await request(`/api/enrollments/${record.id}/process`);
      setProcess(result.process);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as etapas do processo.');
    } finally {
      setLoading(false);
    }
  }, [record.id]);
  useEffect(() => { void loadProcess(); }, [loadProcess]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawerVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function requestClose() {
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      onClose();
      return;
    }
    setDrawerVisible(false);
    window.setTimeout(onClose, 200);
  }

  async function runPrimaryAction() {
    if (!process?.nextAction?.available) return;
    const target = process.nextAction.code === 'VALIDATE_ENROLLMENT'
      ? 'validated'
      : process.nextAction.code === 'RESUME_REVIEW' ? 'under_review' : null;
    if (!target) {
      document.getElementById('enrollment-process-work')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onTransition(target);
      await loadProcess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível executar a próxima ação.');
    } finally {
      setBusy(false);
    }
  }

  const currentStage = process?.stages.find((stage) => stage.key === process.currentStage);
  return <div className={`fixed inset-0 z-[12000] flex justify-end bg-black/50 transition-opacity duration-200 motion-reduce:transition-none ${drawerVisible ? 'opacity-100' : 'opacity-0'}`} onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <aside className={`h-full w-full max-w-2xl overflow-y-auto border-l p-4 shadow-2xl transition-transform duration-300 motion-reduce:transition-none sm:p-6 ${drawerVisible ? 'translate-x-0' : 'translate-x-full'} ${light ? 'border-zinc-200 bg-white' : 'border-zinc-700/70 bg-zinc-950'}`} aria-label="Processo persistido de matrícula">
      <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="break-words text-[10px] font-bold uppercase leading-5 tracking-[0.14em] text-emerald-600">Processo de matrícula</p><h2 className={`mt-1 line-clamp-2 break-words text-xl font-bold leading-7 ${light ? 'text-zinc-900' : 'text-white'}`}>{record.student_name}</h2><p className={`mt-1 break-words text-sm leading-6 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{record.offer_name} · {record.academic_year_name}</p></div><button type="button" aria-label="Fechar processo" onClick={requestClose} className={`min-h-11 min-w-11 shrink-0 rounded-lg p-2 ${light ? 'hover:bg-zinc-100' : 'hover:bg-white/5'}`}><X className="h-5 w-5" /></button></div>
      {loading && <div className={`mt-6 flex min-h-40 items-center justify-center gap-2 rounded-2xl border ${light ? 'border-zinc-200 bg-slate-50 text-zinc-500' : 'border-white/10 bg-zinc-950/60 text-zinc-400'}`}><LoaderCircle className="h-4 w-4 animate-spin" /> A carregar etapas reais…</div>}
      {error && <div role="alert" className="mt-6 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500"><AlertCircle className="h-5 w-5 shrink-0" />{error}<button type="button" onClick={() => void loadProcess()} className="ml-auto underline">Tentar novamente</button></div>}
      {process && !loading && <>
        <section className={`mt-6 rounded-2xl border p-4 transition-colors duration-200 motion-reduce:transition-none ${light ? 'border-emerald-200 bg-emerald-50/60' : 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-zinc-950 to-blue-500/[0.08]'}`} aria-label="Resumo do processo">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><span className={`inline-flex max-w-full whitespace-normal rounded-full border px-2.5 py-1 text-xs font-semibold leading-5 ${STATUS_TONE[process.enrollmentStatus]}`}>{STATUS_LABELS[process.enrollmentStatus]}</span><p className={`mt-3 break-words text-base font-bold leading-6 ${light ? 'text-zinc-900' : 'text-white'}`}>{currentStage?.label}</p><p className={`mt-1 break-words text-xs leading-5 ${light ? 'text-zinc-600' : 'text-zinc-300'}`}>{currentStage?.evidence.summary}</p></div><div className={`shrink-0 rounded-xl border px-3 py-2 text-right ${light ? 'border-emerald-200 bg-white/80' : 'border-blue-400/20 bg-blue-500/10'}`}><p className="text-2xl font-bold tabular-nums text-emerald-600">{process.progress.percent}%</p><p className={`text-[11px] leading-5 ${light ? 'text-zinc-500' : 'text-zinc-300'}`}>{process.progress.completed} de {process.progress.applicable} etapas</p></div></div>
          <div className={`mt-4 h-2 max-w-full overflow-hidden rounded-full ${light ? 'bg-emerald-100' : 'bg-zinc-800'}`}><div className="h-full rounded-full bg-emerald-600 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${process.progress.percent}%` }} /></div>
          <div className={`mt-4 min-w-0 border-t pt-4 ${light ? 'border-emerald-200' : 'border-emerald-500/20'}`}><p className={`text-xs font-semibold ${light ? 'text-zinc-800' : 'text-zinc-100'}`}>Próxima ação</p>{process.nextAction ? <><button type="button" disabled={busy || !process.nextAction.available} onClick={() => void runPrimaryAction()} className="mt-2 min-h-11 w-full break-words rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold !text-white transition-colors duration-200 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">{busy ? 'A atualizar…' : process.nextAction.label}</button>{process.nextAction.unavailableReason && <p className="mt-2 break-words text-xs leading-5 text-amber-600">{process.nextAction.unavailableReason}</p>}</> : <p className="mt-1 text-sm font-semibold text-emerald-600">Processo S03 concluído.</p>}</div>
        </section>
        {process.blockers.length > 0 && <section className="mt-4 min-w-0 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4" aria-label="Bloqueio principal"><p className="text-xs font-bold uppercase tracking-wide text-amber-600">Pendência principal</p><p className={`mt-1 break-words text-sm leading-6 ${light ? 'text-amber-900' : 'text-amber-200'}`}>{process.blockers[0].message}</p></section>}
        <section className="mt-6" aria-label="Etapas do processo"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{process.stages.map((stage) => <article key={stage.key} aria-current={stage.key === process.currentStage ? 'step' : undefined} className={`min-w-0 rounded-xl border p-3 transition-colors duration-200 motion-reduce:transition-none ${stage.key === process.currentStage ? light ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-blue-400/50 bg-blue-500/[0.12] shadow-[0_0_0_1px_rgba(59,130,246,0.08)]' : stage.status === 'completed' ? light ? 'border-emerald-200 bg-emerald-50/40' : 'border-emerald-500/20 bg-emerald-500/[0.05]' : stage.status === 'blocked' ? light ? 'border-amber-300 bg-amber-50/60' : 'border-amber-500/30 bg-amber-500/[0.08]' : light ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900/70'}`}><div className="flex min-w-0 items-center gap-2"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${stage.status === 'completed' ? 'bg-emerald-600 text-white' : stage.status === 'blocked' ? 'bg-amber-500 text-zinc-950' : stage.key === process.currentStage ? 'bg-blue-600 text-white' : light ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-800 text-zinc-300'}`}>{stage.status === 'completed' ? '✓' : stage.key.slice(1)}</span><p className={`min-w-0 break-words text-xs font-semibold leading-5 ${light ? 'text-zinc-900' : 'text-white'}`}>{stage.label}</p></div><p className={`mt-2 break-words text-[11px] leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{stage.evidence.summary}</p></article>)}</div></section>
        <details className={`mt-5 rounded-xl border px-4 ${light ? 'border-zinc-200' : 'border-white/10'}`}><summary className={`cursor-pointer py-3 text-xs font-semibold ${light ? 'text-zinc-700' : 'text-zinc-300'}`}>Outras alterações de estado autorizadas</summary><EnrollmentLifecycleActions status={process.enrollmentStatus} light={light} onTransition={async (toStatus) => { await onTransition(toStatus); await loadProcess(); }} /></details>
        <div id="enrollment-process-work"><EnrollmentDocumentChecklist enrollmentId={record.id} enrollmentStatus={process.enrollmentStatus} light={light} request={request} onChanged={loadProcess} /></div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2"><Detail label="Responsável operacional" value={process.assignedTo?.name || 'Equipa da Secretaria'} light={light} /><Detail label="Encarregado" value={record.guardian_name || 'Ainda não associado'} light={light} /><Detail label="Iniciado" value={formatDate(process.timestamps.startedAt)} light={light} /><Detail label="Último progresso" value={formatDate(process.timestamps.lastProgressAt)} light={light} /></dl>
        <details className={`mt-5 rounded-xl border px-4 ${light ? 'border-zinc-200' : 'border-white/10'}`}><summary className={`cursor-pointer py-3 text-xs font-semibold ${light ? 'text-zinc-600' : 'text-zinc-400'}`}>Detalhes técnicos</summary><dl className="grid gap-4 pb-4 sm:grid-cols-2"><Detail label="Versão" value={String(process.version)} light={light} /></dl></details>
        <p className={`mt-8 text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>Este painel reúne o estado atual da matrícula e a próxima ação necessária.</p>
      </>}
    </aside>
  </div>;
}

function Detail({ label, value, light }: { label: string; value: string; light: boolean }) {
  return <div className="min-w-0"><dt className={`text-[10px] font-bold uppercase tracking-wider ${light ? 'text-zinc-500' : 'text-zinc-500'}`}>{label}</dt><dd className={`mt-1 break-words text-sm leading-6 ${light ? 'text-zinc-800' : 'text-zinc-200'}`}>{value}</dd></div>;
}

function NewEntryDrawer({ offers, light, onClose, onCreated }: { offers: Offer[]; light: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
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
  const canStart = resolution?.status === 'NO_MATCH' || resolution?.status === 'LOCAL_MATCH';

  async function identify(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { const result = await request('/api/enrollments/person-resolution', { method: 'POST', body: JSON.stringify({ student }) }); setResolution(result.resolution); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível confirmar a identidade.'); }
    finally { setBusy(false); }
  }

  async function start() {
    if (!canStart || !offerId) return; setBusy(true); setError(null);
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.() || `enrollment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await request('/api/enrollments/intake', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ offerId, student }) });
      await onCreated();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível iniciar o processo.'); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-[12000] flex justify-end bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className={`h-full w-full max-w-xl overflow-y-auto border-l p-6 shadow-2xl ${light ? 'border-zinc-200 bg-white' : 'border-white/10 bg-zinc-900'}`}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Nova entrada</p><h2 className={`mt-1 text-xl font-bold ${light ? 'text-zinc-900' : 'text-white'}`}>Começar processo de matrícula</h2><p className={`mt-2 text-sm leading-6 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>Este é o primeiro passo da matrícula. Confirme os dados mínimos para identificar corretamente a pessoa; depois, o processo continua com os dados pessoais, responsáveis, documentos e restantes condições exigidas pela instituição.</p></div><button type="button" onClick={onClose} className={`rounded-lg p-2 ${light ? 'hover:bg-zinc-100' : 'hover:bg-white/5'}`}><X className="h-5 w-5" /></button></div>
    {offers.length === 0 ? <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-500">Não existe uma oferta de matrícula ativa. Configure o ano letivo e a oferta antes de iniciar entradas.</div> : <form onSubmit={identify} className="mt-6 space-y-4"><label className={`block text-xs font-semibold ${light ? 'text-zinc-700' : 'text-zinc-300'}`}>Nome completo<input required minLength={3} maxLength={160} value={name} disabled={Boolean(resolution)} onChange={(e) => setName(e.target.value)} className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-indigo-500 disabled:opacity-60 ${light ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/10 bg-zinc-950 text-white'}`} /></label><div className="grid gap-4 sm:grid-cols-2"><Field label="Data de nascimento" type="date" value={birthDate} setValue={setBirthDate} disabled={Boolean(resolution)} light={light} /><Field label="Telefone" value={phone} setValue={setPhone} disabled={Boolean(resolution)} light={light} /><Field label="N.º do aluno, se já existir" value={studentNumber} setValue={setStudentNumber} disabled={Boolean(resolution)} light={light} /><Field label="Referência antiga" value={legacyStudentId} setValue={setLegacyStudentId} disabled={Boolean(resolution)} light={light} /></div><label className={`block text-xs font-semibold ${light ? 'text-zinc-700' : 'text-zinc-300'}`}>Oferta / ano letivo<select required value={offerId} disabled={Boolean(resolution)} onChange={(e) => setOfferId(e.target.value)} className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-indigo-500 disabled:opacity-60 ${light ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/10 bg-zinc-950 text-white'}`}>{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.academic_year_name} · {offer.name}</option>)}</select></label>{!resolution && <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Confirmar identidade</button>}</form>}
    {error && <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
    {resolution && <div className={`mt-6 rounded-2xl border p-5 ${light ? 'border-zinc-200 bg-slate-50' : 'border-white/10 bg-zinc-950/60'}`}><div className="flex items-start gap-3"><div className="mt-0.5"><UserRound className="h-5 w-5 text-indigo-500" /></div><div><h3 className={`font-semibold ${light ? 'text-zinc-900' : 'text-white'}`}>{resolution.status === 'NO_MATCH' ? 'Pessoa nova, sem correspondência segura' : resolution.status === 'LOCAL_MATCH' ? 'Registo local encontrado com segurança' : 'Confirmação adicional necessária'}</h3><p className={`mt-1 text-sm leading-6 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{canStart ? 'O servidor voltou a verificar a identidade e o processo pode ser iniciado sem duplicação automática.' : 'O Nexus não vai criar nem reutilizar uma pessoa automaticamente enquanto existir dúvida. Este caso precisa de revisão autorizada.'}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{canStart ? <button type="button" onClick={() => void start()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Iniciar processo</button> : null}<button type="button" onClick={() => { setResolution(null); setError(null); }} disabled={busy} className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${light ? 'border-zinc-200 text-zinc-700 hover:bg-white' : 'border-white/10 text-zinc-300 hover:bg-white/5'}`}>Rever dados</button></div></div>}
  </aside></div>;
}

function Field({ label, type = 'text', value, setValue, disabled, light }: { label: string; type?: string; value: string; setValue: (value: string) => void; disabled: boolean; light: boolean }) {
  return <label className={`block text-xs font-semibold ${light ? 'text-zinc-700' : 'text-zinc-300'}`}>{label}<input type={type} value={value} disabled={disabled} onChange={(e) => setValue(e.target.value)} className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-indigo-500 disabled:opacity-60 ${light ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/10 bg-zinc-950 text-white'}`} /></label>;
}
