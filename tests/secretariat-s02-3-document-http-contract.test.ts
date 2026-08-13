import { readFile } from 'node:fs/promises';

const controller = await readFile('src/modules/enrollments/enrollment-document.controller.ts', 'utf8');
const root = await readFile('src/modules/enrollments/enrollment.controller.ts', 'utf8');
const failures: string[] = [];
const expect = (label: string, token: string, source: string) => { if (!source.includes(token)) failures.push(`${label}: missing ${token}`); };

expect('list route exists', "app.get('/api/enrollments/:id/documents'", controller);
expect('add route exists', "app.post('/api/enrollments/:id/documents'", controller);
expect('transition route exists', "app.post('/api/enrollments/:id/documents/:documentId/transitions'", controller);
expect('controller delegates listing', 'listEnrollmentDocuments', controller);
expect('controller delegates creation', 'addEnrollmentDocument', controller);
expect('controller delegates transition', 'transitionEnrollmentDocument', controller);
expect('root imports document routes', 'registerEnrollmentDocumentRoutes', root);
expect('root registers document routes', 'registerEnrollmentDocumentRoutes(app);', root);

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S02.3 document HTTP contract passed (8 assertions).');
