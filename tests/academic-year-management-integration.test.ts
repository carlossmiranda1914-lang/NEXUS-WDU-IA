import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/SystemConfig.tsx', import.meta.url), 'utf8');
let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };

assert(source.includes("import AcademicYearManagement from './AcademicYearManagement';"), 'System settings must import AY management.');
assert(source.includes("'academic-year' | 'profile'"), 'System settings must register the academic-year subtab.');
assert(source.includes("setActiveSubTab('academic-year')"), 'Admin/director must have an academic-year navigation entry.');
assert(source.includes("currentRole === 'admin' || currentRole === 'director'"), 'Navigation must be hidden from non-governing UI roles.');
assert(source.includes("activeSubTab === 'academic-year' &&"), 'The academic-year panel must render only on its subtab.');
assert(source.includes('<AcademicYearManagement currentRole={currentRole} firebaseUser={firebaseUser} />'), 'The panel must receive role and authenticated user context.');

console.log(`Academic year management integration gate passed (${assertions} assertions).`);
