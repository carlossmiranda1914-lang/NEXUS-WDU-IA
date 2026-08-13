import { readFile, writeFile } from 'node:fs/promises';
const path = 'src/modules/enrollments/enrollment.controller.ts';
let source = await readFile(path, 'utf8');
const line = '  registerEnrollmentDocumentRoutes(app);';
if (!source.includes(line)) {
  const anchor = '  registerAcademicYearRoutes(app);';
  if (!source.includes(anchor)) throw new Error('S02.3 registration anchor not found.');
  source = source.replace(anchor, `${anchor}\n${line}`);
  await writeFile(path, source, 'utf8');
}
console.log('[S02.3] document registration ready.');
