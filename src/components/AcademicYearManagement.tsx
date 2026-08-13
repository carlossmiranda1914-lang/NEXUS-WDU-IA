import { FormEvent, useEffect, useState } from 'react';
import type { UserRole } from '../types';

type Status = 'draft' | 'active' | 'closed';
type Year = { id:string; name:string; starts_on:string; ends_on:string; status:Status };
type Props = { currentRole: UserRole; firebaseUser?: { getIdToken(): Promise<string> } | null };
const labels: Record<Status,string> = { draft:'Planeamento', active:'Ativo', closed:'Encerrado' };
const dateOnly = (value:string) => String(value).slice(0,10);

export default function AcademicYearManagement({ currentRole, firebaseUser }: Props) {
  const canManage = ['admin','director'].includes(currentRole);
  const [years,setYears] = useState<Year[]>([]);
  const [editing,setEditing] = useState<Year|null>(null);
  const [name,setName] = useState(''); const [startsOn,setStartsOn] = useState(''); const [endsOn,setEndsOn] = useState('');
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState<string|null>(null); const [error,setError] = useState<string|null>(null);

  async function api(path:string, options:RequestInit = {}) {
    if (!firebaseUser) throw new Error('Inicie sessão para gerir o ano letivo.');
    const token = await firebaseUser.getIdToken();
    const response = await fetch(path,{...options,headers:{Authorization:`Bearer ${token}`,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
    const body = await response.json().catch(()=>({})); if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.'); return body;
  }
  async function load(){ if(!canManage||!firebaseUser)return; setError(null); try{const body=await api('/api/academic-years');setYears(body.academicYears||[]);}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar os anos letivos.');} }
  useEffect(()=>{void load();},[canManage,firebaseUser]);
  function clearForm(){setEditing(null);setName('');setStartsOn('');setEndsOn('');}
  function beginEdit(year:Year){if(year.status!=='draft')return;setEditing(year);setName(year.name);setStartsOn(dateOnly(year.starts_on));setEndsOn(dateOnly(year.ends_on));setMessage(null);setError(null);}
  async function save(event:FormEvent){event.preventDefault();setBusy(true);setError(null);setMessage(null);try{await api(editing?`/api/academic-years/${editing.id}`:'/api/academic-years',{method:editing?'PATCH':'POST',body:JSON.stringify({name,startsOn,endsOn})});setMessage(editing?'Planeamento atualizado.':'Ano letivo criado em Planeamento.');clearForm();await load();}catch(e){setError(e instanceof Error?e.message:'Não foi possível guardar.');}finally{setBusy(false);}}
  async function transition(year:Year,action:'activate'|'close'){const text=action==='activate'?`Ativar ${year.name}? Depois de ativo não pode voltar a Planeamento.`:`Encerrar ${year.name}? Depois de encerrado não pode voltar a Ativo.`;if(!window.confirm(text))return;setBusy(true);setError(null);setMessage(null);try{await api(`/api/academic-years/${year.id}/${action}`,{method:'POST'});setMessage(action==='activate'?'Ano letivo ativado.':'Ano letivo encerrado.');await load();}catch(e){setError(e instanceof Error?e.message:'Não foi possível alterar o estado.');}finally{setBusy(false);}}
  if(!canManage)return null; const active=years.find(y=>y.status==='active');

  return <section className="space-y-5" aria-label="Gestão do ano letivo">
    <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">Administração académica</p><h3 className="mt-1 text-lg font-bold text-zinc-100">Ano letivo</h3><p className="mt-1 text-sm text-zinc-400">Planeie o próximo ano, ative-o quando estiver pronto e encerre o atual preservando o histórico.</p></div>
    {active&&<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"><p className="text-xs font-semibold uppercase text-emerald-300">Ano ativo</p><p className="mt-1 font-semibold text-white">{active.name}</p><p className="mt-1 text-xs text-emerald-100/70">{dateOnly(active.starts_on)} — {dateOnly(active.ends_on)}</p></div>}
    {error&&<div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>}{message&&<div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">{message}</div>}
    <form onSubmit={save} className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 md:grid-cols-2"><h4 className="text-sm font-semibold text-zinc-100 md:col-span-2">{editing?'Editar Planeamento':'Novo ano em Planeamento'}</h4><label className="text-xs text-zinc-300 md:col-span-2">Nome<input required minLength={4} maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: 2027/2028" className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white" /></label><label className="text-xs text-zinc-300">Início<input required type="date" value={startsOn} onChange={e=>setStartsOn(e.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white" /></label><label className="text-xs text-zinc-300">Fim<input required type="date" value={endsOn} onChange={e=>setEndsOn(e.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white" /></label><div className="flex gap-2 md:col-span-2"><button disabled={busy} className="rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50">{editing?'Guardar alterações':'Criar Planeamento'}</button>{editing&&<button type="button" onClick={clearForm} className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200">Cancelar</button>}</div></form>
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"><div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-100">Histórico e planeamento</div>{years.length===0?<div className="p-6 text-sm text-zinc-400">Ainda não existem anos letivos registados.</div>:<ul className="divide-y divide-zinc-800">{years.map(year=><li key={year.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-zinc-100">{year.name} <span className="ml-2 text-xs text-zinc-400">{labels[year.status]}</span></p><p className="mt-1 text-xs text-zinc-500">{dateOnly(year.starts_on)} — {dateOnly(year.ends_on)}</p></div><div className="flex gap-2">{year.status==='draft'&&<><button type="button" onClick={()=>beginEdit(year)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200">Editar</button><button type="button" disabled={busy||Boolean(active)} onClick={()=>void transition(year,'activate')} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-zinc-950 disabled:opacity-40">Ativar</button></>}{year.status==='active'&&<button type="button" disabled={busy} onClick={()=>void transition(year,'close')} className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs text-rose-200">Encerrar</button>}</div></li>)}</ul>}</div>
  </section>;
}
