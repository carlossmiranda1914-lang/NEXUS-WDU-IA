import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/components/EnrollmentOperationsWorkspace.tsx';
let source = await readFile(path, 'utf8');

const importLine = "import EnrollmentLifecycleActions from './EnrollmentLifecycleActions.tsx';";
const checklistImport = "import EnrollmentDocumentChecklist from './EnrollmentDocumentChecklist.tsx';";
if (!source.includes(checklistImport)) {
  if (!source.includes(importLine)) throw new Error('S02.4 checklist import anchor not found.');
  source = source.replace(importLine, `${importLine}\n${checklistImport}`);
}

const lifecycleCall = '<EnrollmentLifecycleActions status={record.status} light={light} onTransition={onTransition} />';
const checklistCall = '<EnrollmentDocumentChecklist enrollmentId={record.id} enrollmentStatus={record.status} light={light} request={request} />';
if (!source.includes(checklistCall)) {
  if (!source.includes(lifecycleCall)) throw new Error('S02.4 ProcessDrawer lifecycle anchor not found.');
  source = source.replace(lifecycleCall, `${lifecycleCall}${checklistCall}`);
}

await writeFile(path, source, 'utf8');
console.log('[S02.4] document checklist integrated into ProcessDrawer.');
