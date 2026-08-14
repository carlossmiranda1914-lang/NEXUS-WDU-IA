import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/components/EnrollmentOperationsWorkspace.tsx';
let source = await readFile(path, 'utf8');
const importLine = "import EnrollmentLifecycleActions from './EnrollmentLifecycleActions.tsx';";
if (source.includes(importLine)) {
  console.log('[S02.2] lifecycle import already present.');
  process.exit(0);
}
const anchor = "import EnrollmentNewEntryDrawer from './EnrollmentNewEntryDrawer.tsx';";
if (!source.includes(anchor)) throw new Error('S02.2 import anchor not found.');
source = source.replace(anchor, `${anchor}\n${importLine}`);
await writeFile(path, source, 'utf8');
console.log('[S02.2] lifecycle import ready.');
