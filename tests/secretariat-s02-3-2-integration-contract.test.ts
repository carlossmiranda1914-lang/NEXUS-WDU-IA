import { readFile } from 'node:fs/promises';

const intakeImport = await readFile('scripts/apply-s02-3-2-intake-import.ts', 'utf8');
const intakeCall = await readFile('scripts/apply-s02-3-2-intake-call.ts', 'utf8');
const validationImport = await readFile('scripts/apply-s02-3-2-validation-import.ts', 'utf8');
const policyColumn = await readFile('scripts/apply-s02-3-2-transition-policy-column.ts', 'utf8');
const validationGate = await readFile('scripts/apply-s02-3-2-transition-document-gate.ts', 'utf8');
let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };

assert(intakeImport.includes('captureEnrollmentDocumentPolicy'), 'Intake must import snapshot service.');
assert(intakeCall.includes('await captureEnrollmentDocumentPolicy(client'), 'Intake must capture policy inside its transaction.');
assert(validationImport.includes('documentValidationGate'), 'Transition route must import document validation policy.');
assert(policyColumn.includes('document_policy_id'), 'Transition lock must load captured policy id.');
assert(validationGate.includes("target === 'validated'"), 'Document gate must run only for validated target.');
assert(validationGate.includes('enrollment_documents'), 'Validated gate must read captured document snapshot.');
assert(validationGate.includes('documentValidationGate('), 'Validated gate must use the shared pure policy.');
assert(validationGate.includes("ROLLBACK"), 'Failed document validation must rollback the transition.');
assert(validationGate.includes("409"), 'Incomplete document validation must return conflict.');

console.log(`Secretariat S02.3.2 integration contract passed (${assertions} assertions).`);
