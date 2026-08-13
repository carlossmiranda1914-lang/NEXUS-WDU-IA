import { readFile, writeFile } from 'node:fs/promises';
const path = 'src/modules/enrollments/enrollment-intake.ts';
let source = await readFile(path, 'utf8');
const line = "import { captureEnrollmentDocumentPolicy } from './enrollment-document-snapshot.ts';";
if (!source.includes(line)) {
  const anchor = "import crypto from 'crypto';";
  if (!source.includes(anchor)) throw new Error('S02.3.2 intake import anchor not found.');
  source = source.replace(anchor, `${anchor}\n${line}`);
  await writeFile(path, source, 'utf8');
}
console.log('[S02.3.2] intake import ready.');
