import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = await readFile('server.ts', 'utf8');
const routes = await readFile('src/modules/legacy-students/legacy-student.routes.ts', 'utf8');
const workspace = await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8');
const studentStart = routes.indexOf("app.post('/api/students'");
const studentEnd = routes.indexOf("app.delete('/api/students/:id'", studentStart);
const migrationStart = routes.indexOf("app.post('/api/migration/execute'");
const migrationEnd = routes.length;
if (studentStart < 0 || studentEnd < 0 || migrationStart < 0 || migrationEnd < 0) throw new Error('P0-B.1 routes were not found.');

const studentsPost = routes.slice(studentStart, studentEnd);
const migrationPost = routes.slice(migrationStart, migrationEnd);
let assertions = 0;
const expect = (condition: unknown, message: string) => { assertions += 1; assert(condition, message); };

const gone = "return res.status(410).json({ error: 'A criação de alunos é feita exclusivamente pelo fluxo de matrícula.' });";
expect(studentsPost.includes(gone), 'POST /api/students must reject a missing id with 410.');
expect(studentsPost.indexOf(gone) < studentsPost.indexOf('const existing = await db.select().from(students)'), 'Creation must be rejected before querying or writing legacy student data.');
expect(studentsPost.includes("if (!existing.length) return res.status(404)"), 'An unknown student id must return 404 rather than create.');
expect(studentsPost.includes("if (!isInstitutionOwned(id, ownedIds)) return res.status(404)"), 'A cross-tenant student id must fail closed with 404.');
expect(studentsPost.includes("action: 'STUDENT_UPDATE'"), 'An owned existing student must retain the temporary legacy update path.');
expect(!studentsPost.includes('db.insert(students)'), 'POST /api/students must contain no legacy student insert.');
expect(!studentsPost.includes('db.insert(invoices)'), 'POST /api/students must contain no invoice creation.');
expect(!studentsPost.includes("action: 'STUDENT_CREATION'"), 'POST /api/students must create no student-creation audit event.');
expect(!studentsPost.includes("FLUX-03"), 'POST /api/students must not trigger legacy enrollment automation.');
expect(migrationPost.includes("res.status(410).json({ error: 'A criação de alunos é feita exclusivamente pelo fluxo de matrícula.' })"), 'POST /api/migration/execute must be retired before import work.');
expect(!migrationPost.includes('db.insert(students)') && !migrationPost.includes('db.insert(invoices)'), 'Migration route must contain no legacy student or invoice creation branch.');
expect(!workspace.includes("/api/students"), 'EnrollmentOperationsWorkspace must never create students through the legacy API.');
expect(server.includes('registerLegacyStudentRoutes(app,'), 'The production server must register the extracted legacy routes.');

console.log(`[LEGACY-STUDENT-CREATION-FENCE-CONTRACT] passed (${assertions} assertions).`);
