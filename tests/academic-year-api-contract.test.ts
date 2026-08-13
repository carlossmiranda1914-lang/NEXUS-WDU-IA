import { readFile } from 'node:fs/promises';
import {
  canEditAcademicYearDefinition,
  canManageAcademicYear,
  canTransitionAcademicYear,
} from '../src/modules/enrollments/academic-year-policy.ts';

const failures: string[] = [];
let assertions = 0;
function expect(condition: unknown, message: string) {
  assertions += 1;
  if (!condition) failures.push(message);
}

const source = await readFile(
  new URL('../src/modules/enrollments/academic-year.controller.ts', import.meta.url),
  'utf8',
);

expect(source.includes("app.get('/api/academic-years'"), 'AY-2.1 must expose academic-year listing.');
expect(source.includes("app.post('/api/academic-years'"), 'AY-2.1 must expose draft creation.');
expect(source.includes("app.patch('/api/academic-years/:id'"), 'AY-2.1 must expose draft definition editing.');
expect(source.includes("app.post('/api/academic-years/:id/activate'"), 'AY-2.1 must expose explicit activation.');
expect(source.includes("app.post('/api/academic-years/:id/close'"), 'AY-2.1 must expose explicit closure.');

expect(/VALUES\s*\(\$1,\s*\$2,\s*\$3,\s*\$4,\s*'draft'\)/s.test(source), 'New academic years must always start in draft.');
expect(!/INSERT INTO enrollment_offers/.test(source), 'Academic-year lifecycle API must not create enrollment offers.');
expect(!/UPDATE enrollment_offers/.test(source), 'Academic-year lifecycle API must not mutate enrollment offers.');
expect(source.includes('WHERE institution_id = $1'), 'Academic-year listing must be institution-scoped.');
expect(source.includes('WHERE id = $1 AND institution_id = $2 FOR UPDATE'), 'Lifecycle transitions must lock only institution-owned academic years.');
expect(source.includes('SELECT id FROM institutions WHERE id = $1 FOR UPDATE'), 'Activation must serialize lifecycle governance per institution.');
expect(source.includes("error?.code === '23505'"), 'Unique-active conflicts must be handled as domain conflicts.');

expect(canManageAcademicYear('institution_admin'), 'Institution admin must govern academic years.');
expect(canManageAcademicYear('director'), 'Director must govern academic years.');
expect(!canManageAcademicYear('secretariat'), 'Secretariat must not govern academic-year lifecycle.');
expect(canEditAcademicYearDefinition('draft'), 'Draft definition must remain editable.');
expect(!canEditAcademicYearDefinition('active'), 'Active definition must remain immutable.');
expect(canTransitionAcademicYear('institution_admin', 'draft', 'active'), 'Draft must activate explicitly.');
expect(canTransitionAcademicYear('director', 'active', 'closed'), 'Active year must close explicitly.');
expect(!canTransitionAcademicYear('institution_admin', 'draft', 'closed'), 'Draft must not skip activation.');
expect(!canTransitionAcademicYear('institution_admin', 'closed', 'active'), 'Closed year must never reopen.');

if (failures.length) throw new Error(failures.join('\n'));
console.log(`Academic year API contract tests passed (${assertions} assertions).`);
