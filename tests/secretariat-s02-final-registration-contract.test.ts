import { readFile } from 'node:fs/promises';

const migration = await readFile('src/db/migrations/0014_s02_final_registration_profile.sql', 'utf8');
const controller = await readFile('src/modules/enrollments/enrollment.controller.ts', 'utf8');
const registrationController = await readFile('src/modules/enrollments/enrollment-registration.controller.ts', 'utf8');
const panel = await readFile('src/components/EnrollmentRegistrationPanel.tsx', 'utf8');
const newEntry = await readFile('src/components/EnrollmentNewEntryDrawer.tsx', 'utf8');
let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };

assert(migration.includes('national_id_number'), 'Schema must store BI/identity number.');
assert(migration.includes('whatsapp'), 'Schema must store WhatsApp separately from phone.');
assert(migration.includes('municipality') && migration.includes('province'), 'Schema must store administrative address context.');
assert(migration.includes('financial_responsible'), 'Guardian relationship must capture financial responsibility.');
assert(registrationController.includes("app.get('/api/enrollments/:id/registration'"), 'Registration API must expose read endpoint.');
assert(registrationController.includes("app.put('/api/enrollments/:id/registration'"), 'Registration API must expose update endpoint.');
assert(controller.includes('registerEnrollmentRegistrationRoutes(app)'), 'Enrollment routes must register complete registration API.');
assert(controller.includes('getEnrollmentRegistrationReadiness'), 'Validated transition must consult registration readiness.');
assert(controller.includes('Complete o cadastro da matrícula antes da validação'), 'Incomplete registration must produce an explicit user-facing validation error.');
assert(panel.includes('N.º do BI / identificação'), 'UI must expose BI/identity field.');
assert(panel.includes('WhatsApp'), 'UI must expose WhatsApp field.');
assert(panel.includes('Encarregado / responsável'), 'UI must expose guardian section.');
assert(panel.includes('Província *') && panel.includes('Município *') && panel.includes('Morada *'), 'UI must expose required address fields.');
assert(panel.includes('Cadastro incompleto') && panel.includes('Cadastro completo'), 'UI must expose progress/readiness state.');
assert(newEntry.includes('createdEnrollmentId'), 'New intake must continue into progressive registration instead of ending after creation.');
assert(newEntry.includes('EnrollmentRegistrationPanel'), 'New-entry flow must render the complete registration panel after intake.');
assert(newEntry.includes('Nenhum aluno existente encontrado'), 'Existing-student flow must explain a no-match outcome explicitly.');
assert(newEntry.includes('Tratar como aluno novo'), 'No-match existing flow must offer the correct next action.');

console.log(`Secretariat S02 final registration contract passed (${assertions} assertions).`);
