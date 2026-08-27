import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight, LoaderCircle, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react';
import { auth } from '../lib/firebase.ts';
import {
  INSTITUTIONAL_ROLES,
  IamMembershipReadError,
  listInstitutionMemberships,
  type InstitutionalRole,
  type IamMembership,
  type MembershipReadStatus,
} from '../modules/iam/iam-read-client.ts';

type Theme = 'light' | 'dark';
const PAGE_SIZE = 25;
const ROLE_LABELS: Record<InstitutionalRole, string> = {
  institution_admin: 'Administrador institucional',
  director: 'Direção',
  secretariat: 'Secretaria',
  financial: 'Financeiro',
  teacher: 'Docente',
  student: 'Aluno',
  parent: 'Encarregado de educação',
};
const STATUS_LABELS: Record<MembershipReadStatus, string> = {
  pending: 'Pendente',
  active: 'Ativo',
  suspended: 'Suspenso',
  revoked: 'Revogado',
};
const STATUS_TONES: Record<MembershipReadStatus, string> = {
  pending: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  active: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  suspended: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  revoked: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
};

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Inicie sessão para consultar os acessos institucionais.');
      const token = await user.getIdToken();
      const { memberships: received, page } = await listInstitutionMemberships(token, { status, role, cursor, limit: PAGE_SIZE });
      setMemberships((current) => cursor ? [...current, ...received] : received);
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      if (loadError instanceof IamMembershipReadError && loadError.status === 403) {
        setMemberships([]);
        setNextCursor(null);
        setForbidden(true);
      } else {
        setError(loadError instanceof Error ? loadError.message : 'Não foi possível obter os acessos institucionais.');
      }
    } finally {
      setLoading(false);
    }
  }, [cursor, role, status]);

  useEffect(() => { void load(); }, [load]);

  function changeFilters(nextStatus: MembershipReadStatus | '', nextRole: InstitutionalRole | '') {
    setMemberships([]);
    setNextCursor(null);
    setCursor(null);
    setStatus(nextStatus);
    setRole(nextRole);
  }

  const isFiltered = Boolean(status || role);
  const surface = light ? 'border-slate-200 bg-white text-slate-900' : 'border-indigo-300/10 bg-slate-950/80 text-slate-100';
  const muted = light ? 'text-slate-600' : 'text-slate-400';
  const control = light ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-700 bg-slate-900 text-slate-100';

  return (
    <section aria-label="Acessos institucionais" className="relative isolate min-w-0 max-w-full overflow-hidden rounded-3xl border border-indigo-400/20 bg-slate-950 p-4 shadow-[0_20px_80px_-36px_rgba(79,70,229,0.75)] sm:p-6">
      <div className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 top-16 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative space-y-5">
        <header className="flex flex-col gap-4 border-b border-indigo-300/15 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-indigo-200"><ShieldCheck aria-hidden="true" className="h-5 w-5" /><span className="text-sm font-semibold tracking-wide">IAM institucional</span></div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Acessos institucionais</h2>
            <p className="mt-1 max-w-2xl text-sm text-indigo-100/75">Gerir quem pode aceder a esta instituição e com que papel.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 shrink-0 gap-2 rounded-xl border border-indigo-300/30 bg-indigo-400/10 px-4 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar
          </button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2" aria-label="Filtros de acesso">
          <label className="grid gap-1.5 text-sm font-medium text-indigo-100">Papel institucional
            <select aria-label="Filtrar por papel institucional" value={role} onChange={(event) => changeFilters(status, event.target.value as InstitutionalRole | '')} className={`min-h-11 rounded-xl border px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${control}`}>
              <option value="">Todos os papéis</option>
              {INSTITUTIONAL_ROLES.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-indigo-100">Estado
            <select aria-label="Filtrar por estado" value={status} onChange={(event) => changeFilters(event.target.value as MembershipReadStatus | '', role)} className={`min-h-11 rounded-xl border px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${control}`}>
              <option value="">Todos os estados</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        {loading && memberships.length === 0 && <div role="status" aria-live="polite" className={`flex min-h-44 items-center justify-center gap-3 rounded-2xl border p-6 ${surface}`}><LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-cyan-300" /><span>A carregar acessos institucionais</span></div>}

        {forbidden && <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5 text-rose-100"><div className="flex gap-3"><AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Operação institucional não autorizada.</p><p className="mt-1 text-sm text-rose-100/80">Não tem permissão para consultar os acessos desta instituição.</p></div></div></div>}

        {error && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5 text-rose-100 sm:flex-row sm:items-center sm:justify-between"><p>{error}</p><button type="button" onClick={() => void load()} className="min-h-11 shrink-0 rounded-xl border border-rose-300/40 px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Tentar novamente</button></div>}

        {!loading && !error && !forbidden && memberships.length === 0 && <div role="status" className={`min-h-44 rounded-2xl border p-6 text-center ${surface}`}><UsersRound aria-hidden="true" className="mx-auto h-8 w-8 text-indigo-300" /><h3 className="mt-3 font-semibold">{isFiltered ? 'Não existem acessos com os filtros selecionados.' : 'Ainda não existem acessos institucionais.'}</h3><p className={`mt-1 text-sm ${muted}`}>{isFiltered ? 'Ajuste ou limpe os filtros para consultar outros registos.' : 'Quando existirem associações institucionais, serão apresentadas aqui.'}</p></div>}

        {!forbidden && memberships.length > 0 && <>
          <div className={`hidden overflow-hidden rounded-2xl border md:block ${surface}`}>
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="bg-indigo-500/10 text-sm text-indigo-100"><tr><th scope="col" className="w-[38%] px-5 py-3">Pessoa</th><th scope="col" className="w-[37%] px-5 py-3">Papel institucional</th><th scope="col" className="w-[25%] px-5 py-3">Estado</th></tr></thead>
              <tbody className="divide-y divide-indigo-300/10">{memberships.map((membership) => <tr key={membership.id} className="transition-colors hover:bg-indigo-400/5"><td className="break-words px-5 py-4 font-medium">{membership.person.displayName}</td><td className={`break-words px-5 py-4 ${muted}`}>{ROLE_LABELS[membership.role]}</td><td className="px-5 py-4"><StatusBadge status={membership.status} /></td></tr>)}</tbody>
            </table>
          </div>
          <div className="grid gap-3 md:hidden">{memberships.map((membership) => <article key={membership.id} className={`rounded-2xl border p-4 ${surface}`}><p className="break-words font-semibold">{membership.person.displayName}</p><p className={`mt-1 break-words text-sm ${muted}`}>{ROLE_LABELS[membership.role]}</p><div className="mt-3"><StatusBadge status={membership.status} /></div></article>)}</div>
          {nextCursor && <div className="flex justify-center"><button type="button" onClick={() => setCursor(nextCursor)} disabled={loading} className="min-h-11 gap-2 rounded-xl border border-indigo-300/30 bg-indigo-400/10 px-5 text-sm font-semibold text-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-60">{loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}Carregar mais</button></div>}
        </>}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: MembershipReadStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_TONES[status]}`}>{STATUS_LABELS[status]}</span>;
}
