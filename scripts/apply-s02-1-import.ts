import { readFile, writeFile } from 'node:fs/promises';
const path = 'src/components/EnrollmentOperationsWorkspace.tsx';
let source = await readFile(path, 'utf8');
const anchor = "import { auth } from '../lib/firebase.ts';";
const line = "import EnrollmentNewEntryDrawer from './EnrollmentNewEntryDrawer.tsx';";
if (!source.includes(line)) {
  if (source.split(anchor).length !== 2) throw new Error('S02.1 import anchor invalid.');
  source = source.replace(anchor, anchor + '\n' + line);
  await writeFile(path, source, 'utf8');
}
console.log('[S02.1] import ready.');
