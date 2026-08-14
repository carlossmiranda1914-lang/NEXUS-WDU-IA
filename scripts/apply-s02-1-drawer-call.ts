import { readFile, writeFile } from 'node:fs/promises';
const path = 'src/components/EnrollmentOperationsWorkspace.tsx';
let source = await readFile(path, 'utf8');
const oldName = '<NewEntryDrawer offers={offers}';
const newName = '<EnrollmentNewEntryDrawer offers={offers}';
if (!source.includes(newName)) {
  if (source.split(oldName).length !== 2) throw new Error('S02.1 drawer call anchor invalid.');
  source = source.replace(oldName, newName);
  await writeFile(path, source, 'utf8');
}
console.log('[S02.1] drawer call ready.');
