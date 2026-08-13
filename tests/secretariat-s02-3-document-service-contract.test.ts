import { readFile } from 'node:fs/promises';

const policy = await readFile('src/modules/enrollments/enrollment-document-policy.ts', 'utf8');
const service = await readFile('src/modules/enrollments/enrollment-document-api.ts', 'utf8');
const failures: string[] = [];
const expect = (label: string, token: string, source: string) => { if (!source.includes(token)) failures.push(`${label}: missing ${token}`); };

expect('document states explicit', "['pending', 'submitted', 'verified', 'rejected']", policy);
expect('mutable enrollment states explicit', 'MUTABLE_ENROLLMENT_STATUSES', policy);
expect('service locks mutable row', 'FOR UPDATE', service);
expect('read uses enrollment role policy', 'canManageEnrollment(context.role)', service);
expect('creation uses document policy', 'canManageEnrollmentDocuments', service);
expect('transition uses document policy', 'canTransitionEnrollmentDocument', service);
expect('submission requires evidence', 'validEvidenceReference', service);
expect('document addition audited', 'document_added', service);
expect('document transition audited', 'document_status_changed', service);
expect('institution context scopes service', 'context.institutionId', service);

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S02.3 document service contract passed (10 assertions).');
