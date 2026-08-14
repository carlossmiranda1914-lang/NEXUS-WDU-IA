import { readFile, writeFile } from 'node:fs/promises';
const path = 'src/modules/enrollments/enrollment.controller.ts';
let source = await readFile(path, 'utf8');
const line = "import { documentValidationGate } from './enrollment-document-requirement-policy.ts';";
if (!source.includes(line)) {
  const anchor = "import { registerEnrollmentDocumentRoutes } from './enrollment-document.controller.ts';";
  if (!source.includes(anchor)) throw new Error('S02.3.2 validation import anchor not found.');
  source = source.replace(anchor, `${anchor}\n${line}`);
  await writeFile(path, source, 'utf8');
}
console.log('[S02.3.2] validation policy import ready.');
