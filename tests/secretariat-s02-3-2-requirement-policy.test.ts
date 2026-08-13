import {
  canConfigureDocumentRequirements,
  documentValidationGate,
  normalizeDocumentRequirements,
} from '../src/modules/enrollments/enrollment-document-requirement-policy.ts';

let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };

assert(canConfigureDocumentRequirements('institution_admin'), 'Admin must configure document requirements.');
assert(canConfigureDocumentRequirements('director'), 'Director must configure document requirements.');
assert(!canConfigureDocumentRequirements('secretariat'), 'Secretariat must not configure document requirements.');
assert(!canConfigureDocumentRequirements('teacher'), 'Teacher must not configure document requirements.');

const normalized = normalizeDocumentRequirements([' BI ', 'bi', 'Certificado  escolar', '', 'x']);
assert(normalized.length === 2, 'Requirement names must normalize, deduplicate and reject invalid values.');
assert(normalized[0] === 'BI', 'First valid normalized requirement must be preserved.');
assert(normalized[1] === 'Certificado escolar', 'Internal whitespace must normalize.');

assert(documentValidationGate(false, []).reason === 'POLICY_NOT_CAPTURED', 'Missing captured policy must fail closed.');
assert(documentValidationGate(true, []).ready, 'Explicit policy with zero requirements must be valid.');
assert(!documentValidationGate(true, [{ documentType: 'BI', required: true, status: 'pending' }]).ready, 'Pending required document must block validation.');
assert(!documentValidationGate(true, [{ documentType: 'BI', required: true, status: 'submitted' }]).ready, 'Submitted required document must still block validation.');
assert(!documentValidationGate(true, [{ documentType: 'BI', required: true, status: 'rejected' }]).ready, 'Rejected required document must block validation.');
assert(documentValidationGate(true, [{ documentType: 'BI', required: true, status: 'verified' }]).ready, 'Verified required document must satisfy validation gate.');
assert(documentValidationGate(true, [{ documentType: 'Foto', required: false, status: 'pending' }]).ready, 'Optional pending document must not block validation.');

console.log(`Secretariat S02.3.2 requirement policy passed (${assertions} assertions).`);
