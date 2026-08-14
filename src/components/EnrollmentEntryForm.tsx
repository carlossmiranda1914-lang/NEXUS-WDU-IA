import type { FormEvent } from 'react';

type Offer = { id: string; name: string; academic_year_name: string };
type EntryIntent = 'new' | 'existing';

type Props = {
  intent: EntryIntent;
  offers: Offer[];
  name: string;
  birthDate: string;
  phone: string;
  studentNumber: string;
  legacyStudentId: string;
  offerId: string;
  busy: boolean;
  resolved: boolean;
  light: boolean;
  onSubmit: (event: FormEvent) => void;
  setName: (value: string) => void;
  setBirthDate: (value: string) => void;
  setPhone: (value: string) => void;
  setStudentNumber: (value: string) => void;
  setLegacyStudentId: (value: string) => void;
  setOfferId: (value: string) => void;
};

export default function EnrollmentEntryForm(props: Props) {
  const input = `mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-indigo-500 ${props.light ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/10 bg-zinc-950 text-white'}`;
  const label = `block text-xs font-semibold ${props.light ? 'text-zinc-700' : 'text-zinc-300'}`;
  const disabled = props.busy || props.resolved;

  return <form onSubmit={props.onSubmit} className="mt-6 space-y-4">
    <label className={label}>Nome completo<input required minLength={3} maxLength={160} disabled={disabled} value={props.name} onChange={(e) => props.setName(e.target.value)} className={input} /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={label}>Data de nascimento<input type="date" disabled={disabled} value={props.birthDate} onChange={(e) => props.setBirthDate(e.target.value)} className={input} /></label>
      <label className={label}>Telefone<input disabled={disabled} value={props.phone} onChange={(e) => props.setPhone(e.target.value)} className={input} /></label>
      {props.intent === 'existing' && <>
        <label className={label}>N.º do aluno, se já existir<input disabled={disabled} value={props.studentNumber} onChange={(e) => props.setStudentNumber(e.target.value)} className={input} /></label>
        <label className={label}>Referência antiga<input disabled={disabled} value={props.legacyStudentId} onChange={(e) => props.setLegacyStudentId(e.target.value)} className={input} /></label>
      </>}
    </div>
    <label className={label}>Oferta / ano letivo<select required disabled={disabled} value={props.offerId} onChange={(e) => props.setOfferId(e.target.value)} className={input}>{props.offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.academic_year_name} · {offer.name}</option>)}</select></label>
    {!props.resolved && <button disabled={props.busy} className="min-h-11 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{props.busy ? 'A processar…' : props.intent === 'new' ? 'Iniciar matrícula' : 'Confirmar aluno existente'}</button>}
  </form>;
}
