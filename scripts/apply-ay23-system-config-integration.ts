import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const target = path.resolve('src/components/SystemConfig.tsx');
let source = await readFile(target, 'utf8');

const importAnchor = "import { UserRole, Student, Teacher, Invoice, Announcement, ChatMessage, AutomationFlow, AuditLog } from '../types';";
const importLine = "import AcademicYearManagement from './AcademicYearManagement';";
if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) throw new Error('AY-2.3 import anchor not found.');
  source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
}

const stateBefore = "useState<'profile' | 'audit' | 'users' | 'reset'>('users')";
const stateAfter = "useState<'academic-year' | 'profile' | 'audit' | 'users' | 'reset'>('users')";
if (source.includes(stateBefore)) source = source.replace(stateBefore, stateAfter);
if (!source.includes(stateAfter)) throw new Error('AY-2.3 subtab state anchor not found.');

const navAnchor = `        <button\n          onClick={() => setActiveSubTab('profile')}`;
const navBlock = `        {(currentRole === 'admin' || currentRole === 'director') && (\n          <button\n            onClick={() => setActiveSubTab('academic-year')}\n            className={\`pb-3 border-b-2 transition-all cursor-pointer ${'{'}activeSubTab === 'academic-year' ? 'border-emerald-500 text-emerald-400 font-bold' : 'border-transparent text-zinc-500 hover:text-zinc-300'\`}\n          >\n            Ano Letivo\n          </button>\n        )}\n`;
if (!source.includes("setActiveSubTab('academic-year')")) {
  if (!source.includes(navAnchor)) throw new Error('AY-2.3 navigation anchor not found.');
  source = source.replace(navAnchor, `${navBlock}${navAnchor}`);
}

const renderAnchor = "      {activeSubTab === 'profile' && (";
const renderBlock = `      {activeSubTab === 'academic-year' && (\n        <AcademicYearManagement currentRole={currentRole} firebaseUser={firebaseUser} />\n      )}\n\n`;
if (!source.includes("activeSubTab === 'academic-year' &&")) {
  if (!source.includes(renderAnchor)) throw new Error('AY-2.3 render anchor not found.');
  source = source.replace(renderAnchor, `${renderBlock}${renderAnchor}`);
}

await writeFile(target, source, 'utf8');
console.log('[AY-2.3] SystemConfig integration applied.');
