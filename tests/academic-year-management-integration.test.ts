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

assert(legacy.includes('Gestão de Utilizadores'), 'Legacy settings must preserve the user-management title in Portuguese.');
assert(legacy.includes('Direção Executiva'), 'Legacy settings must preserve Portuguese diacritics in role labels.');
assert(legacy.includes('Configurações de Perfis e Segurança'), 'Legacy settings must preserve the settings heading in Portuguese.');
assert(!legacy.includes('GestÃ£o'), 'Legacy settings must not contain mojibake for Gestão.');
assert(!legacy.includes('DireÃ§Ã£o'), 'Legacy settings must not contain mojibake for Direção.');
assert(!legacy.includes('ConfiguraÃ§Ãµes'), 'Legacy settings must not contain mojibake for Configurações.');
assert(!legacy.includes('ATENÃ‡ÃƒO'), 'Legacy settings must not contain double-encoded warning text.');
assert(!legacy.includes('\uFFFD'), 'Legacy settings must not contain Unicode replacement characters.');
assert(legacy.charCodeAt(0) !== 0xfeff, 'Legacy settings must not contain a BOM marker in decoded text.');

console.log(`Academic year management integration gate passed (${assertions} assertions).`);
