import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/SystemConfig.tsx', import.meta.url), 'utf8');
const legacy = await readFile(new URL('../src/components/SystemConfigLegacy.tsx', import.meta.url), 'utf8');
let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };

assert(source.includes("import AcademicYearManagement from './AcademicYearManagement';"), 'System settings wrapper must import AY management.');
assert(source.includes("import SystemConfigLegacy from './SystemConfigLegacy';"), 'Existing settings must remain isolated in the clean legacy component.');
assert(source.includes("props.currentRole === 'admin' || props.currentRole === 'director'"), 'Only admin/director may see AY management navigation.');
assert(source.includes("type View = 'settings' | 'academic-year'"), 'Wrapper must expose exactly the settings and academic-year views.');
assert(source.includes("setView('academic-year')"), 'Admin/director must have an academic-year navigation entry.');
assert(source.includes("view === 'academic-year' ?"), 'AY management must render only when selected.');
assert(source.includes('<AcademicYearManagement currentRole={props.currentRole} firebaseUser={props.firebaseUser} />'), 'AY panel must receive role and authenticated user context.');
assert(source.includes('<SystemConfigLegacy {...props} />'), 'Existing settings must remain available without reimplementation.');
assert(legacy.includes('Gestão de Utilizadores'), 'Legacy settings must preserve valid Portuguese text.');
assert(!/[ÃÂ�]/u.test(legacy), 'Legacy settings must not contain mojibake markers.');
assert(legacy.charCodeAt(0) !== 0xfeff, 'Legacy settings must not contain a BOM marker in decoded text.');

console.log(`Academic year management integration gate passed (${assertions} assertions).`);
