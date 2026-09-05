import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const enrollmentChecklist = fs.readFileSync('src/components/EnrollmentDocumentChecklist.tsx', 'utf8');
const enrollmentController = fs.readFileSync('src/modules/enrollments/enrollment-document.controller.ts', 'utf8');
const genericFence = fs.readFileSync('tests/fnd03-document-storage-fence.test.ts', 'utf8');

assert.match(app, /Arquivo documental genérico indisponível/);
assert.match(app, /Assinaturas digitais indisponíveis/);
assert.match(app, /Integração Google Sheets indisponível/);
assert.match(app, /FinanceWorkspace/);
assert.doesNotMatch(app, /activeTab === 'sheets'[\s\S]{0,500}<GoogleSheetsCenter/);
assert.doesNotMatch(app, /activeTab === 'financials'[\s\S]{0,500}<FinancialPanel/);

assert.match(enrollmentChecklist, /Uma referência de evidência não é um ficheiro enviado ou armazenado no Nexus/);
assert.doesNotMatch(enrollmentController, /(multer|formidable|req\.file|req\.files|createReadStream|writeFile|sendFile|attachment\()/);
assert.match(enrollmentController, /institutionalContext\(req, res\)/);
assert.match(enrollmentController, /listEnrollmentDocuments/);
assert.match(enrollmentController, /transitionEnrollmentDocument/);
assert.match(genericFence, /CANONICAL_DOCUMENT_AUTHORITY_REQUIRED/);

console.log('FND-04 file and external-effect truth contract: PASS.');
