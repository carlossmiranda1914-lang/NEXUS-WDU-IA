import { readFile } from 'node:fs/promises';

const source = await readFile('src/components/EnrollmentDocumentChecklist.tsx', 'utf8');
let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };

assert(source.includes('Documentos da matrícula'), 'S02.4 must expose a visible document checklist title.');
assert(source.includes('Obrigatório') && source.includes('Opcional'), 'S02.4 must distinguish required and optional documents.');
assert(source.includes("pending: 'Pendente'") && source.includes("submitted: 'Recebido'") && source.includes("verified: 'Verificado'") && source.includes("rejected: 'Rejeitado'"), 'S02.4 must expose all document states in product language.');
assert(source.includes('Referência, protocolo ou localização da evidência'), 'S02.4 must collect an evidence reference without pretending to upload a file.');
assert(source.includes('Marcar como recebido'), 'S02.4 must allow document receipt when policy permits.');
assert(source.includes('Verificar') && source.includes('Rejeitar'), 'S02.4 must expose review actions for submitted documents.');
assert(source.includes("toStatus === 'submitted' && !evidenceReference"), 'S02.4 must fail closed when evidence reference is missing.');
assert(source.includes("MUTABLE_ENROLLMENT_STATUSES"), 'S02.4 must respect enrollment lifecycle mutability.');
assert(source.includes('modo de consulta'), 'S02.4 must explain read-only behavior after document mutability closes.');
assert(source.includes('Nenhum documento está registado neste processo'), 'S02.4 must have an explicit empty state.');
assert(source.includes('não assume automaticamente que a política documental está configurada'), 'S02.4 must not confuse an empty checklist with a configured zero-requirement policy.');
assert(source.includes('min-h-11'), 'S02.4 interactive controls must retain touch-friendly minimum height.');
assert(source.includes('w-full'), 'S02.4 evidence input must be mobile-width safe.');
assert(source.includes('break-words') || source.includes('break-all'), 'S02.4 must prevent long document/evidence text from overflowing.');
assert(source.includes('/api/enrollments/${enrollmentId}/documents'), 'S02.4 must use the real enrollment document API.');
assert(source.includes('/documents/${document.id}/transitions'), 'S02.4 actions must use the real document transition API.');

console.log(`Secretariat S02.4 document UX contract passed (${assertions} assertions).`);
