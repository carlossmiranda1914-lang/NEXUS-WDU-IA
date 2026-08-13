type EntryIntent = 'new' | 'existing';

export default function EnrollmentEntryIntentSelector({ value, onChange }: { value: EntryIntent | null; onChange: (value: EntryIntent) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-label="Tipo de aluno">
      <button type="button" aria-pressed={value === 'new'} onClick={() => onChange('new')} className="min-h-20 rounded-xl border p-4 text-left">
        <strong>Aluno novo</strong>
        <p className="mt-1 text-xs">Iniciar matrícula sem pesquisa prévia.</p>
      </button>
      <button type="button" aria-pressed={value === 'existing'} onClick={() => onChange('existing')} className="min-h-20 rounded-xl border p-4 text-left">
        <strong>Aluno existente</strong>
        <p className="mt-1 text-xs">Confirmar o registo antes de reutilizar.</p>
      </button>
    </div>
  );
}
