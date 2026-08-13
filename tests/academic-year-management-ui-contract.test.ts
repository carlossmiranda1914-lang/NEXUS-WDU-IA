import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/AcademicYearManagement.tsx', import.meta.url), 'utf8');
let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };

assert(source.includes("['admin','director'].includes(currentRole)"), 'Only admin/director UI roles may render the management screen.');
assert(source.includes("api('/api/academic-years')"), 'The UI must load academic years from the lifecycle API.');
assert(source.includes("editing?'PATCH':'POST'"), 'Draft edits and draft creation must use distinct API methods.');
assert(source.includes("action:'activate'|'close'"), 'Lifecycle actions must be constrained to activate/close.');
assert(source.includes('`/api/academic-years/${year.id}/${action}`'), 'Lifecycle requests must target the selected academic year action endpoint.');
assert(source.includes("transition(year,'activate')"), 'The UI must expose explicit activation.');
assert(source.includes("transition(year,'close')"), 'The UI must expose explicit closure.');
assert(source.includes("year.status!=='draft'"), 'Only draft years may enter edit mode.');
assert(source.includes('não pode voltar a Planeamento'), 'Activation must communicate irreversibility.');
assert(source.includes('não pode voltar a Ativo'), 'Closure must communicate irreversibility.');
assert(!source.includes('/api/enrollments/setup'), 'The legacy setup endpoint must not be used.');
assert(!source.includes('2025/2026'), 'The screen must not hardcode a legacy academic year.');

console.log(`Academic year management UI contract passed (${assertions} assertions).`);
