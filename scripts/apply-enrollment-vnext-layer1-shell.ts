import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const path = resolve(process.cwd(), 'src/App.tsx');
const rawSource = await readFile(path, 'utf8');
const originalEol = rawSource.includes('\r\n') ? '\r\n' : '\n';
let source = rawSource.replace(/\r\n/g, '\n');

function replaceOnce(label: string, pattern: string | RegExp, replacement: string) {
  const before = source;
  source = source.replace(pattern, replacement);
  if (source === before) {
    throw new Error(`[ENROLLMENT-VNEXT] ${label}: expected App.tsx pattern was not found. No partial patch was written.`);
  }
}

replaceOnce(
  'lazy imports',
  "const StudentsList = lazy(() => import('./components/StudentsList'));\nconst TeachersList = lazy(() => import('./components/TeachersList'));\nconst FinancialPanel = lazy(() => import('./components/FinancialPanel'));\nconst CommunicationCenter = lazy(() => import('./components/CommunicationCenter'));\nconst SystemConfig = lazy(() => import('./components/SystemConfig'));\nconst AIAssistant = lazy(() => import('./components/AIAssistant'));\nconst TeacherAI = lazy(() => import('./components/TeacherAI'));\nconst Gamification = lazy(() => import('./components/Gamification'));\nconst EnrollmentWorkspace = lazy(() => import('./components/EnrollmentWorkspace'));",
  "const EnrollmentOperationsWorkspace = lazy(() => import('./components/EnrollmentOperationsWorkspace'));\nconst TeachersList = lazy(() => import('./components/TeachersList'));\nconst FinancialPanel = lazy(() => import('./components/FinancialPanel'));\nconst CommunicationCenter = lazy(() => import('./components/CommunicationCenter'));\nconst SystemConfig = lazy(() => import('./components/SystemConfig'));\nconst AIAssistant = lazy(() => import('./components/AIAssistant'));\nconst TeacherAI = lazy(() => import('./components/TeacherAI'));",
);

replaceOnce(
  'students layout configuration',
  `  students: {\n    type: 'Layout de Lista Geral',\n    containerClass: "space-y-6 w-full max-w-7xl mx-auto",\n    description: "Espaço para acompanhamento de matrículas, frequência estudantil e progresso comportamental."\n  },`,
  `  students: {\n    type: 'Workspace Operacional de Alunos & Matrículas',\n    containerClass: "space-y-6 w-full max-w-[1600px] mx-auto",\n    description: "Entradas, matrículas em curso, exceções e alunos ativos num fluxo institucional único."\n  },`,
);

replaceOnce(
  'obsolete gamification layout configuration',
  `  gamification: {\n    type: 'Painel de Méritos e Destaques',\n    containerClass: "w-full max-w-[1600px] mx-auto space-y-6",\n    description: "Registo de comportamento positivo, prémios de dedicação e pódio de alunos."\n  },\n`,
  '',
);

replaceOnce(
  'obsolete matriculas layout configuration',
  `  matriculas: {\n    type: 'Formatador Sequencial de Registos',\n    containerClass: "w-full max-w-[1500px] mx-auto space-y-6",\n    description: "Portal de Matrícula para conferência de dados e validação de documentos de acesso."\n  },\n`,
  '',
);

replaceOnce(
  'legacy students subtab state',
  "  const [studentsSubTab, setStudentsSubTab] = useState<'list' | 'matriculas' | 'gamification'>('list');\n",
  '',
);

replaceOnce(
  'legacy students subtab navigation',
  /          \{\/\* Elegant Minimalist Sub-tabs Navigation \*\/\}\n          \{\['students', 'teachers'\]\.includes\(activeTab\) && \([\s\S]*?              \{activeTab === 'teachers' && \([\s\S]*?              \)\}\n            <\/div>\n          \)\}\n\n          <AnimatePresence mode="wait">/,
  `          {/* Teacher-only sub-navigation. Alunos & Matrículas is now one operational workspace. */}\n          {activeTab === 'teachers' && (\n            <div className={\`flex flex-wrap items-center gap-1.5 border-b pb-4 mb-6 \${theme === 'light' ? 'border-zinc-200' : 'border-white/5'}\`}>\n              <button\n                onClick={() => setTeachersSubTab('list')}\n                className={\`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer \${\n                  teachersSubTab === 'list'\n                    ? theme === 'light' ? 'bg-indigo-50 text-indigo-700' : 'bg-white/10 text-white'\n                    : theme === 'light' ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-400 hover:bg-white/5 hover:text-white'\n                }\`}\n              >\n                Lista de Professores\n              </button>\n              <button\n                onClick={() => setTeachersSubTab('ai')}\n                className={\`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer \${\n                  teachersSubTab === 'ai'\n                    ? theme === 'light' ? 'bg-indigo-50 text-indigo-700' : 'bg-white/10 text-white'\n                    : theme === 'light' ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-400 hover:bg-white/5 hover:text-white'\n                }\`}\n              >\n                IA Pedagógica (Planos & Provas)\n              </button>\n            </div>\n          )}\n\n          <AnimatePresence mode="wait">`,
);

replaceOnce(
  'dashboard add-student legacy route',
  `                          if (type === 'add-student') {\n                            setActiveTab('students');\n                            setStudentsSubTab('matriculas');\n                          }`,
  `                          if (type === 'add-student') {\n                            setActiveTab('students');\n                          }`,
);

replaceOnce(
  'legacy students render block',
  /                  \{activeTab === 'students' && \([\s\S]*?                  \)\}\n\n                  \{activeTab === 'teachers' && \(/,
  `                  {activeTab === 'students' && (\n                    <EnrollmentOperationsWorkspace theme={theme} />\n                  )}\n\n                  {activeTab === 'teachers' && (`,
);

const forbidden = [
  'studentsSubTab',
  'setStudentsSubTab',
  '<StudentsList',
  '<EnrollmentWorkspace',
  '<Gamification',
  'Portal de Matrícula',
  'Mérito & Engajamento / Pódio',
  "type: 'Painel de Méritos e Destaques'",
  "type: 'Formatador Sequencial de Registos'",
];
for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`[ENROLLMENT-VNEXT] forbidden legacy token remained after patch: ${token}`);
}
if (!source.includes("const EnrollmentOperationsWorkspace = lazy(() => import('./components/EnrollmentOperationsWorkspace'));")) {
  throw new Error('[ENROLLMENT-VNEXT] operational workspace import missing after patch.');
}
if (!source.includes("{activeTab === 'students' && (\n                    <EnrollmentOperationsWorkspace theme={theme} />")) {
  throw new Error('[ENROLLMENT-VNEXT] operational workspace mount missing after patch.');
}

const output = originalEol === '\r\n' ? source.replace(/\n/g, '\r\n') : source;
await writeFile(path, output, 'utf8');
console.log('[ENROLLMENT-VNEXT] PASS: App.tsx patched only through asserted Layer 1 integration points.');
