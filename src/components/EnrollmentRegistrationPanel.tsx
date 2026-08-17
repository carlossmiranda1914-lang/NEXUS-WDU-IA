import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { EnrollmentOperationalStatus } from '../modules/enrollments/enrollment-operations-model.ts';

type Request = (path: string, options?: RequestInit) => Promise<any>;

type StudentForm = {
  name: string;
  birthDate: string;
  phone: string;
  whatsapp: string;
  email: string;
  nationalIdNumber: string;
  gender: string;
  nationality: string;
  addressLine: string;
  municipality: string;
  province: string;
  studentNumber: string;
};

type GuardianForm = {
  name: string;
  birthDate: string;
  phone: string;
  whatsapp: string;
  email: string;
  nationalIdNumber: string;
  gender: string;
  nationality: string;
  addressLine: string;
  municipality: string;
  province: string;
  relationship: string;
  financialResponsible: boolean;
};

type RegistrationResponse = {
  enrollmentId: string;
  status: EnrollmentOperationalStatus;
  editable: boolean;
  student: Partial<StudentForm>;
  guardian: (Partial<GuardianForm> & { isPrimary?: boolean }) | null;
  enrollment: { previousSchool?: string | null; notes?: string | null };
  readiness: { ready: boolean; missing: string[] };
};

const BLANK_STUDENT: StudentForm = {
  name: '', birthDate: '', phone: '', whatsapp: '', email: '', nationalIdNumber: '', gender: '', nationality: 'Angolana',
  addressLine: '', municipality: '', province: '', studentNumber: '',
};
const BLANK_GUARDIAN: GuardianForm = {
  name: '', birthDate: '', phone: '', whatsapp: '', email: '', nationalIdNumber: '', gender: '', nationality: 'Angolana',
  addressLine: '', municipality: '', province: '', relationship: '', financialResponsible: false,
};

const MISSING_LABELS: Record<string, string> = {
  'student.name': 'nome do aluno',
  'student.birthDate': 'data de nascimento',
  'student.gender': 'género',
  'student.nationality': 'nacionalidade',
  'student.province': 'província',
  'student.municipality': 'município',
  'student.addressLine': 'morada',
  'student.contact': 'contacto do aluno',
  guardian: 'encarregado',
  'guardian.name': 'nome do encarregado',
  'guardian.relationship': 'relação do encarregado',
  'guardian.contact': 'contacto do encarregado',
};

function value(value: unknown): string { return typeof value === 'string' ? value : ''; }

export default function EnrollmentRegistrationPanel({ enrollmentId, enrollmentStatus, light, request, compact = false, onChanged }: {
  enrollmentId: string;
  enrollmentStatus: EnrollmentOperationalStatus;
  light: boolean;
  request: Request;
  compact?: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const [student, setStudent] = useState<StudentForm>(BLANK_STUDENT);
  const [guardian, setGuardian] = useState<GuardianForm>(BLANK_GUARDIAN);
  const [previousSchool, setPreviousSchool] = useState('');
  const [notes, setNotes] = useState('');
  const [readiness, setReadiness] = useState<{ ready: boolean; missing: string[] }>({ ready: false, missing: [] });
  const [editable, setEditable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await request(`/api/enrollments/${enrollmentId}/registration`);
      const registration = result.registration as RegistrationResponse;
      setStudent({
        name: value(registration.student.name), birthDate: value(registration.student.birthDate), phone: value(registration.student.phone),
        whatsapp: value(registration.student.whatsapp), email: value(registration.student.email), nationalIdNumber: value(registration.student.nationalIdNumber),
        gender: value(registration.student.gender), nationality: value(registration.student.nationality) || 'Angolana', addressLine: value(registration.student.addressLine),
        municipality: value(registration.student.municipality), province: value(registration.student.province), studentNumber: value(registration.student.studentNumber),
      });
      setGuardian(registration.guardian ? {
        name: value(registration.guardian.name), birthDate: value(registration.guardian.birthDate), phone: value(registration.guardian.phone),
        whatsapp: value(registration.guardian.whatsapp), email: value(registration.guardian.email), nationalIdNumber: value(registration.guardian.nationalIdNumber),
        gender: value(registration.guardian.gender), nationality: value(registration.guardian.nationality) || 'Angolana', addressLine: value(registration.guardian.addressLine),
        municipality: value(registration.guardian.municipality), province: value(registration.guardian.province), relationship: value(registration.guardian.relationship),
        financialResponsible: Boolean(registration.guardian.financialResponsible),
      } : BLANK_GUARDIAN);
      setPreviousSchool(value(registration.enrollment?.previousSchool));
      setNotes(value(registration.enrollment?.notes));
      setReadiness(registration.readiness);
      setEditable(registration.editable);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o cadastro da matrícula.');
    } finally { setLoading(false); }
  }, [enrollmentId, request]);

  useEffect(() => { void load(); }, [load]);

  const missingText = useMemo(() => readiness.missing.map((item) => MISSING_LABELS[item] || item).join(', '), [readiness.missing]);
  const inputClass = `mt-1.5 min-h-11 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-emerald-600 disabled:opacity-60 ${light ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/10 bg-zinc-950 text-white'}`;
  const labelClass = `block text-xs font-semibold ${light ? 'text-zinc-700' : 'text-zinc-300'}`;

  async function save() {
    setSaving(true); setError(null); setNotice(null);
    try {
      const result = await request(`/api/enrollments/${enrollmentId}/registration`, {
        method: 'PUT',
        body: JSON.stringify({ student, guardian, enrollment: { previousSchool, notes } }),
      });
      const registration = result.registration as RegistrationResponse;
      setReadiness(registration.readiness);
      setEditable(registration.editable);
      setNotice(registration.readiness.ready ? 'Cadastro completo e pronto para verificação documental.' : 'Cadastro guardado. Ainda existem dados obrigatórios por preencher.');
      await onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível guardar o cadastro.');
    } finally { setSaving(false); }
  }

  if (loading) return <section className={`mt-6 rounded-2xl border p-4 ${light ? 'border-zinc-200 bg-white' : 'border-white/10 bg-zinc-950/40'}`}><p className={`text-xs ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>A carregar cadastro da matrícula…</p></section>;

  return <section className={`mt-6 rounded-2xl border ${compact ? 'p-4' : 'p-5'} ${light ? 'border-zinc-200 bg-white' : 'border-white/10 bg-zinc-950/40'}`} aria-label="Cadastro completo da matrícula">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><h3 className={`break-words text-sm font-semibold leading-5 ${light ? 'text-zinc-900' : 'text-white'}`}>Cadastro da matrícula</h3><p className={`mt-1 break-words text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>Complete os dados do aluno e do encarregado. O processo só pode ser validado quando este cadastro e os documentos obrigatórios estiverem completos.</p></div>
      <span className={`w-fit shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${readiness.ready ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'}`}>{readiness.ready ? 'Cadastro completo' : 'Cadastro incompleto'}</span>
    </div>

    {!readiness.ready && missingText && <div className={`mt-4 rounded-xl border p-3 text-xs leading-5 ${light ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}><strong>Em falta:</strong> {missingText}.</div>}

    <div className="mt-5 space-y-6">
      <FormSection title="Dados do aluno" description="Identificação civil e dados base do estudante." light={light}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Nome completo *" value={student.name} disabled={!editable} onChange={(name) => setStudent((current) => ({ ...current, name }))} className={inputClass} labelClass={labelClass} />
          <TextField label="Data de nascimento *" type="date" value={student.birthDate} disabled={!editable} onChange={(birthDate) => setStudent((current) => ({ ...current, birthDate }))} className={inputClass} labelClass={labelClass} />
          <TextField label="N.º do BI / identificação" value={student.nationalIdNumber} disabled={!editable} onChange={(nationalIdNumber) => setStudent((current) => ({ ...current, nationalIdNumber }))} className={inputClass} labelClass={labelClass} />
          <label className={labelClass}>Género *<select value={student.gender} disabled={!editable} onChange={(event) => setStudent((current) => ({ ...current, gender: event.target.value }))} className={inputClass}><option value="">Selecionar</option><option value="female">Feminino</option><option value="male">Masculino</option><option value="other">Outro</option><option value="unspecified">Prefere não indicar</option></select></label>
          <TextField label="Nacionalidade *" value={student.nationality} disabled={!editable} onChange={(nationality) => setStudent((current) => ({ ...current, nationality }))} className={inputClass} labelClass={labelClass} />
          <TextField label="N.º interno do aluno" value={student.studentNumber} disabled={!editable} onChange={(studentNumber) => setStudent((current) => ({ ...current, studentNumber }))} className={inputClass} labelClass={labelClass} />
        </div>
      </FormSection>

      <FormSection title="Contactos do aluno" description="Basta pelo menos um contacto válido; WhatsApp fica separado do telefone normal." light={light}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Telefone" value={student.phone} disabled={!editable} onChange={(phone) => setStudent((current) => ({ ...current, phone }))} className={inputClass} labelClass={labelClass} />
          <TextField label="WhatsApp" value={student.whatsapp} disabled={!editable} onChange={(whatsapp) => setStudent((current) => ({ ...current, whatsapp }))} className={inputClass} labelClass={labelClass} />
          <div className="sm:col-span-2"><TextField label="Email" type="email" value={student.email} disabled={!editable} onChange={(email) => setStudent((current) => ({ ...current, email }))} className={inputClass} labelClass={labelClass} /></div>
        </div>
      </FormSection>

      <FormSection title="Morada do aluno" description="Contexto residencial necessário para o registo administrativo." light={light}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Província *" value={student.province} disabled={!editable} onChange={(province) => setStudent((current) => ({ ...current, province }))} className={inputClass} labelClass={labelClass} />
          <TextField label="Município *" value={student.municipality} disabled={!editable} onChange={(municipality) => setStudent((current) => ({ ...current, municipality }))} className={inputClass} labelClass={labelClass} />
          <div className="sm:col-span-2"><TextField label="Morada *" value={student.addressLine} disabled={!editable} onChange={(addressLine) => setStudent((current) => ({ ...current, addressLine }))} className={inputClass} labelClass={labelClass} /></div>
        </div>
      </FormSection>

      <FormSection title="Encarregado / responsável" description="O Nexus reutiliza um responsável local apenas quando os contactos permitem uma correspondência segura; caso contrário cria um novo registo institucional." light={light}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Nome completo *" value={guardian.name} disabled={!editable} onChange={(name) => setGuardian((current) => ({ ...current, name }))} className={inputClass} labelClass={labelClass} />
          <TextField label="Relação com o aluno *" placeholder="Ex.: Mãe, Pai, Tutor" value={guardian.relationship} disabled={!editable} onChange={(relationship) => setGuardian((current) => ({ ...current, relationship }))} className={inputClass} labelClass={labelClass} />
          <TextField label="N.º do BI / identificação" value={guardian.nationalIdNumber} disabled={!editable} onChange={(nationalIdNumber) => setGuardian((current) => ({ ...current, nationalIdNumber }))} className={inputClass} labelClass={labelClass} />
          <TextField label="Telefone" value={guardian.phone} disabled={!editable} onChange={(phone) => setGuardian((current) => ({ ...current, phone }))} className={inputClass} labelClass={labelClass} />
          <TextField label="WhatsApp" value={guardian.whatsapp} disabled={!editable} onChange={(whatsapp) => setGuardian((current) => ({ ...current, whatsapp }))} className={inputClass} labelClass={labelClass} />
          <TextField label="Email" type="email" value={guardian.email} disabled={!editable} onChange={(email) => setGuardian((current) => ({ ...current, email }))} className={inputClass} labelClass={labelClass} />
        </div>
        <label className={`mt-3 flex min-h-11 items-center gap-2 text-xs ${light ? 'text-zinc-700' : 'text-zinc-300'}`}><input type="checkbox" checked={guardian.financialResponsible} disabled={!editable} onChange={(event) => setGuardian((current) => ({ ...current, financialResponsible: event.target.checked }))} /> Responsável financeiro principal</label>
      </FormSection>

      <FormSection title="Informação complementar" description="Dados do processo que ajudam a Secretaria sem alterar a identidade do aluno." light={light}>
        <TextField label="Escola de proveniência" value={previousSchool} disabled={!editable} onChange={setPreviousSchool} className={inputClass} labelClass={labelClass} />
        <label className={`${labelClass} mt-3`}>Observações<textarea value={notes} disabled={!editable} onChange={(event) => setNotes(event.target.value)} rows={3} className={`${inputClass} resize-y`} placeholder="Informações administrativas relevantes para esta matrícula" /></label>
      </FormSection>
    </div>

    {editable ? <button type="button" onClick={() => void save()} disabled={saving} className="mt-5 min-h-11 w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">{saving ? 'A guardar…' : 'Guardar cadastro'}</button> : <p className={`mt-5 text-xs leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>Este cadastro está em modo de consulta porque a matrícula já passou da fase editável.</p>}
    {notice && <p role="status" className="mt-3 text-xs text-emerald-500">{notice}</p>}
    {error && <p role="alert" className="mt-3 text-xs text-rose-500">{error}</p>}
  </section>;
}

function FormSection({ title, description, light, children }: { title: string; description: string; light: boolean; children: ReactNode }) {
  return <div className={`min-w-0 rounded-xl border p-4 ${light ? 'border-zinc-200 bg-slate-50' : 'border-white/10 bg-zinc-900/70'}`}><div className="mb-4 min-w-0"><h4 className={`break-words text-xs font-bold leading-5 ${light ? 'text-zinc-900' : 'text-zinc-100'}`}>{title}</h4><p className={`mt-1 break-words text-[11px] leading-5 ${light ? 'text-zinc-500' : 'text-zinc-400'}`}>{description}</p></div>{children}</div>;
}

function TextField({ label, value, onChange, className, labelClass, disabled, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; className: string; labelClass: string; disabled: boolean; type?: string; placeholder?: string }) {
  return <label className={labelClass}>{label}<input type={type} value={value} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={className} /></label>;
}
