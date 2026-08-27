import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight, LoaderCircle, RefreshCw, ShieldCheck, UsersRound, X } from 'lucide-react';
import { auth } from '../lib/firebase.ts';
import { INSTITUTIONAL_ROLES, IamMembershipMutationError, IamMembershipReadError, changeInstitutionMembershipRole, listInstitutionMemberships, revokeInstitutionMembership, type InstitutionalRole, type IamMembership, type MembershipReadStatus } from '../modules/iam/iam-read-client.ts';

type Theme = 'light' | 'dark';
type DialogKind = 'role' | 'revoke';
const PAGE_SIZE = 25;
const ROLE_LABELS: Record<InstitutionalRole, string> = { institution_admin: 'Administrador institucional', director: 'Direção', secretariat: 'Secretaria', financial: 'Financeiro', teacher: 'Docente', student: 'Aluno', parent: 'Encarregado de educação' };
const STATUS_LABELS: Record<MembershipReadStatus, string> = { pending: 'Pendente', active: 'Ativo', suspended: 'Suspenso', revoked: 'Revogado' };

export function mutationErrorMessage(error: unknown): string {
  if (!(error instanceof IamMembershipMutationError)) return 'Não foi possível concluir a alteração. Verifique a ligação e tente novamente.';
  if (error.code === 'UNAUTHORIZED' || error.status === 403) return 'Não tem autorização para alterar os acessos desta instituição.';
  if (error.code === 'MEMBERSHIP_NOT_FOUND' || error.status === 404) return 'Este acesso já não está disponível nesta instituição.';
  if (error.code === 'MEMBERSHIP_STATE_INVALID') return 'Este acesso não está num estado que permita esta alteração.';
  if (error.code === 'LAST_ADMIN_PROTECTED') return 'Não é possível remover o último administrador ativo desta instituição.';
  if (error.code === 'VERSION_CONFLICT') return 'Este acesso mudou entretanto. A lista foi atualizada; reveja e tome uma nova decisão.';
  if (error.status === 400) return 'Os dados indicados não são válidos. Reveja a seleção e tente novamente.';
  if (error.status >= 500) return 'O serviço institucional não conseguiu concluir a alteração. Tente novamente.';
  return 'Não foi possível concluir a alteração. Verifique a ligação e tente novamente.';
}
function idempotencyKey() { return `iam-ui-${crypto.randomUUID()}`; }

export default function InstitutionalAccessWorkspace({ theme = 'dark' }: { theme?: Theme }) {
  const light = theme === 'light';
  const [memberships, setMemberships] = useState<IamMembership[]>([]);
  const [status, setStatus] = useState<MembershipReadStatus | ''>('');
  const [role, setRole] = useState<InstitutionalRole | ''>('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [selected, setSelected] = useState<IamMembership | null>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [nextRole, setNextRole] = useState<InstitutionalRole>('teacher');
  const [submitting, setSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchMemberships = useCallback(async (pageCursor: string | null, append: boolean) => {
    const user = auth.currentUser; if (!user) throw new Error('Inicie sessão para consultar os acessos institucionais.');
    const token = await user.getIdToken();
    const result = await listInstitutionMemberships(token, { status, role, cursor: pageCursor ?? undefined, limit: PAGE_SIZE });
    setMemberships((current) => append ? [...current, ...result.memberships] : result.memberships);
    setNextCursor(result.page.nextCursor);
  }, [role, status]);
  const load = useCallback(async () => {
    setLoading(true); setError(null); setForbidden(false);
    try { await fetchMemberships(cursor, Boolean(cursor)); }
    catch (loadError) { if (loadError instanceof IamMembershipReadError && loadError.status === 403) { setMemberships([]); setNextCursor(null); setForbidden(true); } else setError('Não foi possível obter os acessos institucionais.'); }
    finally { setLoading(false); }
  }, [cursor, fetchMemberships]);
  const refreshAuthoritatively = useCallback(async () => {
    setLoading(true); setError(null); setForbidden(false); setCursor(null);
    try { await fetchMemberships(null, false); }
    catch (refreshError) { if (refreshError instanceof IamMembershipReadError && refreshError.status === 403) { setMemberships([]); setNextCursor(null); setForbidden(true); } else setError('Não foi possível atualizar os acessos institucionais.'); throw refreshError; }
    finally { setLoading(false); }
  }, [fetchMemberships]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!dialog) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !submitting) closeDialog(); };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  });
  function changeFilters(nextStatus: MembershipReadStatus | '', nextRoleFilter: InstitutionalRole | '') { setMemberships([]); setNextCursor(null); setCursor(null); setStatus(nextStatus); setRole(nextRoleFilter); }
  function closeDialog() { if (!submitting) { setDialog(null); setSelected(null); setMutationError(null); } }
  function openDialog(kind: DialogKind, membership: IamMembership) { setSelected(membership); setNextRole(membership.role); setMutationError(null); setNotice(null); setDialog(kind); }
  async function submitMutation() {
    if (!selected || !dialog || submitting || (dialog === 'role' && nextRole === selected.role)) return;
    setSubmitting(true); setMutationError(null); setNotice(null);
    try {
      const user = auth.currentUser; if (!user) throw new Error('Sessão indisponível.');
      const token = await user.getIdToken(); const key = idempotencyKey();
      if (dialog === 'role') await changeInstitutionMembershipRole(token, selected.id, { role: nextRole, expectedVersion: selected.version, idempotencyKey: key });
      else await revokeInstitutionMembership(token, selected.id, { expectedVersion: selected.version, idempotencyKey: key });
      await refreshAuthoritatively(); setDialog(null); setSelected(null); setNotice(dialog === 'role' ? 'Papel institucional atualizado.' : 'Acesso institucional revogado.');
    } catch (submitError) {
      const message = mutationErrorMessage(submitError);
      if (submitError instanceof IamMembershipMutationError && submitError.code === 'VERSION_CONFLICT') { setDialog(null); setSelected(null); try { await refreshAuthoritatively(); } catch { /* Workspace shows the safe refresh state. */ } }
      setMutationError(message);
    } finally { setSubmitting(false); }
  }
  const isFiltered = Boolean(status || role);
  const shell = light ? 'border-slate-200 bg-gradient-to-br from-white via-indigo-50 to-cyan-50 text-slate-900 shadow-[0_20px_80px_-36px_rgba(30,64,175,0.24)]' : 'border-indigo-400/20 bg-slate-950 text-slate-100 shadow-[0_20px_80px_-36px_rgba(79,70,229,0.75)]';
  const surface = light ? 'border-slate-200 bg-white text-slate-900 shadow-sm' : 'border-indigo-300/10 bg-slate-950/80 text-slate-100';
  const muted = light ? 'text-slate-600' : 'text-slate-400'; const labelText = light ? 'text-slate-700' : 'text-indigo-100';
  const control = light ? 'border-slate-300 bg-white text-slate-900 hover:border-indigo-400' : 'border-slate-700 bg-slate-900 text-slate-100';
  const button = light ? 'border-indigo-300 bg-white text-indigo-800 hover:bg-indigo-50' : 'border-indigo-300/30 bg-indigo-400/10 text-indigo-100 hover:bg-indigo-400/20';
  const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500';
  const statusTone = (value: MembershipReadStatus) => light ? ({ pending: 'border-amber-300 bg-amber-50 text-amber-800', active: 'border-emerald-300 bg-emerald-50 text-emerald-800', suspended: 'border-rose-300 bg-rose-50 text-rose-800', revoked: 'border-slate-300 bg-slate-100 text-slate-700' }[value]) : ({ pending: 'border-amber-400/30 bg-amber-400/10 text-amber-200', active: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200', suspended: 'border-rose-400/30 bg-rose-400/10 text-rose-200', revoked: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300' }[value]);
  return <section aria-label="Acessos institucionais" className={`relative isolate min-w-0 max-w-full overflow-hidden rounded-3xl border p-4 sm:p-6 ${shell}`}>
    <div className={`pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full blur-3xl ${light ? 'bg-indigo-300/30' : 'bg-indigo-500/20'}`} /><div className={`pointer-events-none absolute -right-28 top-16 h-64 w-64 rounded-full blur-3xl ${light ? 'bg-cyan-200/35' : 'bg-cyan-400/10'}`} />
    <div className="relative space-y-5">
      <header className={`flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between ${light ? 'border-slate-200' : 'border-indigo-300/15'}`}><div className="min-w-0"><div className={`mb-2 flex items-center gap-2 ${light ? 'text-indigo-700' : 'text-indigo-200'}`}><ShieldCheck aria-hidden="true" className="h-5 w-5" /><span className="text-sm font-semibold tracking-wide">IAM institucional</span></div><h2 className={`text-2xl font-bold tracking-tight ${light ? 'text-slate-950' : 'text-white'}`}>Acessos institucionais</h2><p className={`mt-1 max-w-2xl text-sm ${muted}`}>Gerir quem pode aceder a esta instituição e com que papel.</p></div><button type="button" onClick={() => void refreshAuthoritatively()} disabled={loading} className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${button} ${focus}`}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button></header>
      <div className="grid gap-3 sm:grid-cols-2" aria-label="Filtros de acesso"><label className={`grid gap-1.5 text-sm font-medium ${labelText}`}>Papel institucional<select aria-label="Filtrar por papel institucional" value={role} onChange={(event) => changeFilters(status, event.target.value as InstitutionalRole | '')} className={`min-h-11 rounded-xl border px-3 ${focus} ${control}`}><option value="">Todos os papéis</option>{INSTITUTIONAL_ROLES.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}</select></label><label className={`grid gap-1.5 text-sm font-medium ${labelText}`}>Estado<select aria-label="Filtrar por estado" value={status} onChange={(event) => changeFilters(event.target.value as MembershipReadStatus | '', role)} className={`min-h-11 rounded-xl border px-3 ${focus} ${control}`}><option value="">Todos os estados</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      {notice && <div role="status" aria-live="polite" className={`rounded-2xl border p-4 text-sm font-medium ${light ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'}`}>{notice}</div>}
      {mutationError && <div role="alert" className={`flex flex-col gap-3 rounded-2xl border p-4 text-sm sm:flex-row sm:items-center sm:justify-between ${light ? 'border-rose-300 bg-rose-50 text-rose-950' : 'border-rose-400/30 bg-rose-500/10 text-rose-100'}`}><span>{mutationError}</span><button type="button" onClick={() => setMutationError(null)} className={`min-h-10 rounded-lg border px-3 font-semibold ${focus} ${light ? 'border-rose-300 text-rose-800 hover:bg-rose-100' : 'border-rose-300/40 text-rose-100 hover:bg-rose-400/10'}`}>Fechar</button></div>}
      {loading && memberships.length === 0 && <div role="status" aria-live="polite" className={`flex min-h-44 items-center justify-center gap-3 rounded-2xl border p-6 ${surface}`}><LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-cyan-600 dark:text-cyan-300" /><span>A carregar acessos institucionais</span></div>}
      {forbidden && <Alert light={light} title="Operação institucional não autorizada." text="Não tem permissão para consultar os acessos desta instituição." />}
      {error && <div role="alert" className={`flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${light ? 'border-rose-300 bg-rose-50 text-rose-950' : 'border-rose-400/30 bg-rose-500/10 text-rose-100'}`}><p>{error}</p><button type="button" onClick={() => void refreshAuthoritatively()} className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-semibold ${focus} ${light ? 'border-rose-300 text-rose-800 hover:bg-rose-100' : 'border-rose-300/40 text-rose-100'}`}>Tentar novamente</button></div>}
      {!loading && !error && !forbidden && memberships.length === 0 && <div role="status" className={`min-h-44 rounded-2xl border p-6 text-center ${surface}`}><UsersRound aria-hidden="true" className={`mx-auto h-8 w-8 ${light ? 'text-indigo-600' : 'text-indigo-300'}`} /><h3 className="mt-3 font-semibold">{isFiltered ? 'Não existem acessos com os filtros selecionados.' : 'Ainda não existem acessos institucionais.'}</h3><p className={`mt-1 text-sm ${muted}`}>{isFiltered ? 'Ajuste ou limpe os filtros para consultar outros registos.' : 'Quando existirem associações institucionais, serão apresentadas aqui.'}</p></div>}
      {!forbidden && memberships.length > 0 && <><div className={`hidden overflow-hidden rounded-2xl border md:block ${surface}`}><table className="w-full table-fixed border-collapse text-left"><thead className={`text-sm ${light ? 'bg-indigo-50 text-slate-700' : 'bg-indigo-500/10 text-indigo-100'}`}><tr><th scope="col" className="w-[30%] px-5 py-3">Pessoa</th><th scope="col" className="w-[26%] px-5 py-3">Papel institucional</th><th scope="col" className="w-[18%] px-5 py-3">Estado</th><th scope="col" className="w-[26%] px-5 py-3">Ações</th></tr></thead><tbody className={light ? 'divide-y divide-slate-200' : 'divide-y divide-indigo-300/10'}>{memberships.map((membership) => <tr key={membership.id} className={light ? 'transition-colors hover:bg-indigo-50/70' : 'transition-colors hover:bg-indigo-400/5'}><td className="break-words px-5 py-4 font-medium">{membership.person.displayName}</td><td className={`break-words px-5 py-4 ${muted}`}>{ROLE_LABELS[membership.role]}</td><td className="px-5 py-4"><StatusBadge status={membership.status} tone={statusTone(membership.status)} /></td><td className="px-5 py-4"><Actions membership={membership} light={light} focus={focus} onRole={() => openDialog('role', membership)} onRevoke={() => openDialog('revoke', membership)} /></td></tr>)}</tbody></table></div><div className="grid gap-3 md:hidden">{memberships.map((membership) => <article key={membership.id} className={`rounded-2xl border p-4 ${surface}`}><p className="break-words font-semibold">{membership.person.displayName}</p><p className={`mt-1 break-words text-sm ${muted}`}>{ROLE_LABELS[membership.role]}</p><div className="mt-3"><StatusBadge status={membership.status} tone={statusTone(membership.status)} /></div><div className="mt-4"><Actions membership={membership} light={light} focus={focus} onRole={() => openDialog('role', membership)} onRevoke={() => openDialog('revoke', membership)} /></div></article>)}</div>{nextCursor && <div className="flex justify-center"><button type="button" onClick={() => setCursor(nextCursor)} disabled={loading} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-5 text-sm font-semibold disabled:opacity-60 ${button} ${focus}`}>{loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}Carregar mais</button></div>}</>}
    </div>
    {dialog && selected && <MutationDialog kind={dialog} membership={selected} nextRole={nextRole} light={light} submitting={submitting} focus={focus} onRole={setNextRole} onClose={closeDialog} onSubmit={() => void submitMutation()} />}
  </section>;
}

function Alert({ light, title, text }: { light: boolean; title: string; text: string }) { return <div role="alert" className={`rounded-2xl border p-5 ${light ? 'border-rose-300 bg-rose-50 text-rose-950' : 'border-rose-400/30 bg-rose-500/10 text-rose-100'}`}><div className="flex gap-3"><AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">{title}</p><p className={`mt-1 text-sm ${light ? 'text-rose-800' : 'text-rose-100/80'}`}>{text}</p></div></div></div>; }
function Actions({ membership, light, focus, onRole, onRevoke }: { membership: IamMembership; light: boolean; focus: string; onRole: () => void; onRevoke: () => void }) { const inactive = membership.status !== 'active'; return <div className="flex flex-wrap gap-2"><button type="button" disabled={inactive} onClick={onRole} className={`min-h-10 rounded-lg border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${focus} ${light ? 'border-indigo-300 text-indigo-800 hover:bg-indigo-50' : 'border-indigo-300/40 text-indigo-100 hover:bg-indigo-400/10'}`}>Alterar papel</button><button type="button" disabled={inactive} onClick={onRevoke} className={`min-h-10 rounded-lg border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${focus} ${light ? 'border-rose-300 text-rose-800 hover:bg-rose-50' : 'border-rose-300/40 text-rose-100 hover:bg-rose-400/10'}`}>Revogar acesso</button></div>; }
function MutationDialog({ kind, membership, nextRole, light, submitting, focus, onRole, onClose, onSubmit }: { kind: DialogKind; membership: IamMembership; nextRole: InstitutionalRole; light: boolean; submitting: boolean; focus: string; onRole: (role: InstitutionalRole) => void; onClose: () => void; onSubmit: () => void }) { const changingRole = kind === 'role'; const sameRole = nextRole === membership.role; const panel = light ? 'border-slate-200 bg-white text-slate-950' : 'border-indigo-300/20 bg-slate-950 text-slate-100'; const muted = light ? 'text-slate-600' : 'text-slate-400'; return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-4 backdrop-blur-sm sm:items-center" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="iam-mutation-title" className={`w-full max-w-lg rounded-2xl border p-5 shadow-2xl ${panel}`}><div className="flex items-start justify-between gap-4"><div><h3 id="iam-mutation-title" className="text-lg font-bold">{changingRole ? 'Alterar papel institucional' : 'Revogar acesso institucional'}</h3><p className={`mt-1 text-sm ${muted}`}>{membership.person.displayName}</p></div><button type="button" aria-label="Fechar diálogo" onClick={onClose} disabled={submitting} className={`rounded-lg p-2 disabled:opacity-50 ${focus} ${light ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800'}`}><X aria-hidden="true" className="h-5 w-5" /></button></div><div className={`mt-5 space-y-3 rounded-xl border p-4 text-sm ${light ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900/70'}`}><p><span className={`font-semibold ${muted}`}>Papel atual: </span>{ROLE_LABELS[membership.role]}</p>{changingRole ? <label className="grid gap-1.5 font-semibold">Novo papel<select aria-label="Novo papel institucional" autoFocus value={nextRole} onChange={(event) => onRole(event.target.value as InstitutionalRole)} className={`min-h-11 rounded-xl border px-3 font-normal ${focus} ${light ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-700 bg-slate-950 text-slate-100'}`}>{INSTITUTIONAL_ROLES.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}</select></label> : <p>A pessoa perderá o acesso institucional. A Person, a Identity e o histórico não serão apagados.</p>}<p className={muted}>{changingRole ? 'A alteração só é concluída após confirmação do servidor e atualização da lista institucional.' : 'A revogação só é concluída após confirmação do servidor e atualização da lista institucional.'}</p></div><div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={submitting} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold disabled:opacity-60 ${focus} ${light ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-slate-700 text-slate-200 hover:bg-slate-800'}`}>Cancelar</button><button type="button" onClick={onSubmit} disabled={submitting || (changingRole && sameRole)} className={`min-h-11 rounded-xl px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${focus} ${changingRole ? 'bg-indigo-700 hover:bg-indigo-800' : 'bg-rose-700 hover:bg-rose-800'}`}>{submitting ? 'A guardar…' : changingRole ? 'Confirmar alteração' : 'Confirmar revogação'}</button></div></div></div>; }
function StatusBadge({ status, tone }: { status: MembershipReadStatus; tone: string }) { return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{STATUS_LABELS[status]}</span>; }
