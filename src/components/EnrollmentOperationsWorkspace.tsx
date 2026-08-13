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
import {
  buildOperationalMetrics,
  getAttentionQueue,
  nextAction,
  pipelineCounts,
  recordsForView,
  STATUS_LABELS,
  type EnrollmentOperationalRecord,
  type EnrollmentOperationalStatus,
  type OperationalView,
} from '../modules/enrollments/enrollment-operations-model.ts';

type Theme = 'light' | 'dark';
type Offer = { id: string; name: string; code: string; academic_year_id: string; academic_year_name: string };
type Resolution = {
  status: 'NO_MATCH' | 'LOCAL_MATCH' | 'REUSABLE_MATCH' | 'MULTIPLE_MATCHES' | 'RESTRICTED_POSSIBLE_MATCH' | 'REVIEW_REQUIRED';
  candidateCount: number;
};

type PipelineContext = { label: string; description: string };

const PIPELINE_CONTEXT: Record<string, PipelineContext> = {
  entry: { label: 'Entrada', description: 'Processos iniciados que ainda precisam de tratamento pela Secretaria.' },
  documents: { label: 'Documentos', description: 'Matrículas que aguardam documentação necessária para continuar.' },
  verification: { label: 'Verificação', description: 'Processos em análise e validação antes da decisão.' },
  decision: { label: 'Decisão', description: 'Processos validados e preparados para a decisão autorizada.' },
  activation: { label: 'Ativação', description: 'Alunos cuja matrícula já está ativa no contexto escolar.' },
};

const VIEW_LABELS: Array<{ id: OperationalView; label: string }> = [
  { id: 'overview', label: 'Visão Operacional' },
  { id: 'entries', label: 'Entradas' },
  { id: 'enrollments', label: 'Matrículas' },
  { id: 'students', label: 'Alunos' },
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

export default function EnrollmentOperationsWorkspace({ theme = 'dark' }: { theme?: Theme }) {
  const light = theme === 'light';
  const surface = light ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-white/10';
  const mutedSurface = light ? 'bg-slate-50 border-zinc-200' : 'bg-zinc-950/60 border-white/5';
  const text = light ? 'text-zinc-900' : 'text-zinc-100';
  const muted = light ? 'text-zinc-500' : 'text-zinc-400';

  const [records, setRecords] = useState<EnrollmentOperationalRecord[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [institutionName, setInstitutionName] = useState('');
  const [view, setView] = useState<OperationalView>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EnrollmentOperationalStatus[] | null>(null);
  const [selected, setSelected] = useState<EnrollmentOperationalRecord | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [newEntryOpen, setNewEntryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [context, list] = await Promise.all([
        request('/api/enrollments/context'),
        request('/api/enrollments'),
      ]);
      setOffers(Array.isArray(context.offers) ? context.offers : []);
      setInstitutionName(context.institution?.name || 'Instituição atual');
      setRecords(Array.isArray(list.enrollments) ? list.enrollments : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a operação de matrículas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => buildOperationalMetrics(records), [records]);
  const pipeline = useMemo(() => pipelineCounts(records), [records]);
  const attention = useMemo(() => getAttentionQueue(records), [records]);
  const selectedStage = selectedStageId ? PIPELINE_CONTEXT[selectedStageId] : null;
  const visible = useMemo(() => {
    let base = recordsForView(records, view);
    if (statusFilter) base = base.filter((record) => statusFilter.includes(record.status));
    const term = query.trim().toLocaleLowerCase('pt');
    if (term) {
      base = base.filter((record) => [record.student_name, record.guardian_name, record.offer_name, record.academic_year_name]
        .filter(Boolean).some((value) => String(value).toLocaleLowerCase('pt').includes(term)));
    }
    return base;
  }, [records, view, statusFilter, query]);

  function selectMetric(filter: EnrollmentOperationalStatus[]) {
    setStatusFilter(filter);
    setView('enrollments');
  }

  return (
    <section className="min-w-0 max-w-full space-y-5 overflow-x-hidden sm:space-y-6" aria-label="Workspace operacional de Alunos e Matrículas">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="break-words text-[10px] font-bold uppercase leading-5 tracking-[0.14em] text-indigo-500 sm:tracking-[0.18em]">Secretaria escolar</p>
          <h1 className={`text-2xl font-bold tracking-tight ${text}`}>Alunos & Matrículas</h1>
          <p className={`max-w-3xl text-sm leading-6 ${muted}`}>Entradas, matrículas em curso, exceções e alunos ativos num único fluxo operacional. Os indicadores abaixo são calculados apenas a partir dos processos reais da instituição atual.</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <button type="button" onClick={() => void load()} disabled={loading} className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-semibold sm:w-auto ${light ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50' : 'border-white/10 bg-zinc-900 text-zinc-300 hover:bg-white/5'} disabled:opacity-50`}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          <button type="button" onClick={() => setNewEntryOpen(true)} className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-xs font-bold text-white hover:bg-indigo-500 sm:w-auto">
            <Plus className="h-4 w-4" /> Nova entrada / matrícula
          </button>
        </div>
      </header>

      <nav className={`flex max-w-full gap-1 overflow-x-auto overscroll-x-contain border-b pb-3 ${light ? 'border-zinc-200' : 'border-white/10'}`} aria-label="Vistas de Alunos e Matrículas">
        {VIEW_LABELS.map((item) => (
          <button key={item.id} type="button" onClick={() => { setView(item.id); setStatusFilter(null); setSelectedStageId(null); }} className={`min-h-11 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition ${view === item.id ? light ? 'bg-indigo-50 text-indigo-700' : 'bg-white/10 text-white' : light ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
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
                <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className={`font-semibold ${text}`}>Fluxo das matrículas</h2><p className={`mt-1 text-xs ${muted}`}>Acompanhe o percurso da matrícula. Selecione uma etapa disponível para abrir a respetiva fila de trabalho.</p></div><ShieldCheck className="h-5 w-5 text-indigo-500" /></div>
                <div className="grid max-w-full snap-x snap-mandatory grid-flow-col auto-cols-[minmax(155px,78vw)] gap-2 overflow-x-auto overscroll-x-contain pb-2 sm:auto-cols-[minmax(170px,42vw)] xl:grid-flow-row xl:grid-cols-7 xl:auto-cols-auto xl:overflow-visible xl:pb-0">
                  {pipeline.map((stage, index) => (
                    <button key={stage.id} type="button" disabled={!stage.available} aria-label={stage.available ? `Abrir etapa ${stage.label}` : `${stage.label}: domínio ainda não disponível`} onClick={() => { if (!stage.available) return; setSelectedStageId(stage.id); setStatusFilter(stage.statuses); setView(stage.id === 'entry' ? 'entries' : stage.id === 'activation' ? 'students' : 'enrollments'); }} className={`group relative min-w-0 snap-start rounded-xl border p-3 text-left transition ${mutedSurface} ${stage.available ? 'cursor-pointer hover:border-indigo-400/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40' : 'cursor-default opacity-65'}`}>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${light ? 'bg-zinc-200 text-zinc-700' : 'bg-white/10 text-zinc-300'}`}>{index + 1}</span>
                        <p className={`min-w-0 flex-1 truncate text-sm font-semibold ${text}`}>{stage.label}</p>
                        <span className={`shrink-0 text-sm font-bold tabular-nums ${stage.available ? text : muted}`}>{stage.available ? stage.count : '—'}</span>
                        {stage.available && <ChevronRight className="h-4 w-4 shrink-0 text-indigo-500 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />}
                      </div>
                      {!stage.available && <p className={`mt-2 pl-8 text-[11px] ${muted}`}>Ainda não disponível</p>}
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
                  <div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-indigo-500" /><h2 className={`font-semibold ${text}`}>Como trabalhar nesta área</h2></div>
                  <div className="mt-4 space-y-4">
                    <OperationalNote icon={<CircleDot className="h-4 w-4" />} title="Dados atuais" body="Os indicadores refletem os processos desta instituição." light={light} />
                    <OperationalNote icon={<Clock3 className="h-4 w-4" />} title="Prioridades primeiro" body="Pendências e bloqueios aparecem antes dos processos regulares." light={light} />
                    <OperationalNote icon={<UsersRound className="h-4 w-4" />} title="Alunos ativos" body="A vista Alunos apresenta apenas matrículas já ativadas." light={light} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {view !== 'overview' && (
            <div className={`overflow-hidden rounded-2xl border ${surface}`}>
              <div className={`flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between ${light ? 'border-zinc-200' : 'border-white/10'}`}>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className={`font-semibold ${text}`}>{selectedStage?.label || VIEW_LABELS.find((item) => item.id === view)?.label}</h2></div><p className={`mt-1 text-xs leading-5 ${muted}`}>{selectedStage?.description || `${visible.length} registo${visible.length === 1 ? '' : 's'} real${visible.length === 1 ? '' : 'is'} nesta vista.`}</p>{selectedStage && <p className={`mt-1 text-[11px] ${muted}`}>{visible.length} processo{visible.length === 1 ? '' : 's'} nesta etapa.</p>}</div>
                <div className="relative w-full sm:w-80"><Search aria-hidden="true" className={`pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 ${muted}`} /><input aria-label="Procurar processos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Procurar aluno, oferta ou ano" className={`min-h-11 w-full rounded-lg border py-2.5 pl-12 pr-3 text-sm outline-none focus:border-indigo-500 ${light ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/10 bg-zinc-950 text-white'}`} /></div>
              </div>
              {visible.length === 0 ? <EmptyState title={view === 'students' ? 'Ainda não existem alunos ativos nesta base' : 'Nenhum processo nesta vista'} body={view === 'students' ? 'Um aluno só aparece aqui depois de uma matrícula ativa. Não são usados registos demonstrativos.' : 'Os dados desta vista são alimentados exclusivamente pelos processos institucionais persistidos.'} light={light} /> : <ul className={`divide-y ${light ? 'divide-zinc-200' : 'divide-white/10'}`}>{visible.map((record) => <li key={record.id}><ProcessRow record={record} light={light} onOpen={() => setSelected(record)} /></li>)}</ul>}
            </div>
          )}
        </>
      )}

      {selected && <ProcessDrawer record={selected} light={light} onClose={() => setSelected(null)} onTransition={async (toStatus) => { await request(`/api/enrollments/${selected.id}/transitions`, { method: 'POST', body: JSON.stringify({ toStatus }) }); setSelected(null); setNotice('Estado da matrícula atualizado.'); await load(); }} />}
      {newEntryOpen && <EnrollmentNewEntryDrawer offers={offers} light={light} onClose={() => setNewEntryOpen(false)} onCreated={async () => { setNewEntryOpen(false); setNotice('Processo de matrícula iniciado com segurança e adicionado à fila institucional.'); await load(); setView('enrollments'); }} />}
    </section>
  );
}

function ProcessRow({ record, light, onOpen }: { record: EnrollmentOperationalRecord; light: boolean; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className={`flex w-full flex-col gap-3 px-5 py-4 text-left transition sm:flex-row sm:items-center sm:justify-between ${light ? 'hover:bg-zinc-50' : 'hover:bg-white/[0.03]'}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className={`font-semibold ${light ? 'text-zinc-900' : 'text-white'}`}>{record.student_name}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[record.status]}`}>{STATUS_LABELS[record.status]}</span></div><p className={`mt-1 truncate text-xs ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{record.offer_name} · {record.academic_year_name}</p><p className={`mt-2 text-xs ${record.status === 'blocked' ? 'text-rose-500' : light ? 'text-zinc-600' : 'text-zinc-300'}`}>{nextAction(record)}</p></div><div className={`flex shrink-0 items-center gap-2 text-xs ${light ? 'text-zinc-500' : 'text-zinc-400'}`}><span>Atualizado {formatDate(record.updated_at)}</span><ChevronRight className="h-4 w-4" /></div></button>;
}

function EmptyState({ title, body, light }: { title: string; body: string; light: boolean }) {
  return <div className="flex min-h-36 flex-col items-center justify-center px-6 py-8 text-center sm:min-h-40"><div className={`flex h-10 w-10 items-center justify-center rounded-full ${light ? 'bg-zinc-100 text-zinc-500' : 'bg-white/5 text-zinc-400'}`}><ClipboardCheck className="h-5 w-5" /></div><h3 className={`mt-3 text-sm font-semibold ${light ? 'text-zinc-900' : 'text-white'}`}>{title}</h3><p className={`mt-1 max-w-md text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{body}</p></div>;
}

function OperationalNote({ icon, title, body, light }: { icon: ReactNode; title: string; body: string; light: boolean }) {
  return <div className="flex gap-3"><div className={`mt-0.5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{icon}</div><div><p className={`text-xs font-semibold ${light ? 'text-zinc-800' : 'text-zinc-200'}`}>{title}</p><p className={`mt-1 text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{body}</p></div></div>;
}

function ProcessDrawer({ record, light, onClose, onTransition }: { record: EnrollmentOperationalRecord; light: boolean; onClose: () => void; onTransition: (toStatus: EnrollmentOperationalStatus) => Promise<void> }) {
  return <div className="fixed inset-0 z-[12000] flex justify-end bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className={`h-full w-full max-w-lg overflow-y-auto border-l p-6 shadow-2xl ${light ? 'border-zinc-200 bg-white' : 'border-white/10 bg-zinc-900'}`}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Processo de matrícula</p><h2 className={`mt-1 text-xl font-bold ${light ? 'text-zinc-900' : 'text-white'}`}>{record.student_name}</h2><p className={`mt-1 text-sm ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{record.offer_name} · {record.academic_year_name}</p></div><button type="button" onClick={onClose} className={`rounded-lg p-2 ${light ? 'hover:bg-zinc-100' : 'hover:bg-white/5'}`}><X className="h-5 w-5" /></button></div><div className={`mt-6 rounded-2xl border p-4 ${light ? 'border-zinc-200 bg-slate-50' : 'border-white/10 bg-zinc-950/60'}`}><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[record.status]}`}>{STATUS_LABELS[record.status]}</span><p className={`mt-3 text-sm leading-6 ${light ? 'text-zinc-600' : 'text-zinc-300'}`}>{statusExplanation(record.status)}</p><div className={`mt-4 border-t pt-4 ${light ? 'border-zinc-200' : 'border-white/10'}`}><p className={`text-xs font-semibold ${light ? 'text-zinc-800' : 'text-zinc-200'}`}>Próxima ação</p><p className="mt-1 text-sm font-semibold text-indigo-500">{nextAction(record)}</p></div></div><EnrollmentLifecycleActions status={record.status} light={light} onTransition={onTransition} /><dl className="mt-6 grid gap-4 sm:grid-cols-2"><Detail label="Encarregado" value={record.guardian_name || 'Ainda não associado'} light={light} /><Detail label="Criado" value={formatDate(record.created_at)} light={light} /><Detail label="Última atualização" value={formatDate(record.updated_at)} light={light} /><Detail label="ID do processo" value={record.id} light={light} /></dl><p className={`mt-8 text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>Este painel reúne o estado atual da matrícula e a próxima ação necessária.</p></aside></div>;
}

function Detail({ label, value, light }: { label: string; value: string; light: boolean }) {
  return <div><dt className={`text-[10px] font-bold uppercase tracking-wider ${light ? 'text-zinc-500' : 'text-zinc-500'}`}>{label}</dt><dd className={`mt-1 break-words text-sm ${light ? 'text-zinc-800' : 'text-zinc-200'}`}>{value}</dd></div>;
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
