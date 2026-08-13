import { readFile, writeFile } from 'node:fs/promises';
const path = 'src/modules/enrollments/enrollment-intake.ts';
let source = await readFile(path, 'utf8');
if (!source.includes('await captureEnrollmentDocumentPolicy(client')) {
  const anchor = "      await client.query(\n        `INSERT INTO enrollment_events (";
  if (!source.includes(anchor)) throw new Error('S02.3.2 intake call anchor not found.');
  const call = "      await captureEnrollmentDocumentPolicy(client, { institutionId: command.institutionId, offerId: command.offerId, enrollmentId: enrollment.rows[0].id });\n\n";
  source = source.replace(anchor, call + anchor);
  await writeFile(path, source, 'utf8');
}
console.log('[S02.3.2] intake snapshot call ready.');
