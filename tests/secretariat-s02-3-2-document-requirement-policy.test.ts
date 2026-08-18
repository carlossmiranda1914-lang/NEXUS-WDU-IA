import {
  canConfigureDocumentRequirements,
  documentValidationGate,
  normalizeDocumentRequirements,
} from '../src/modules/enrollments/enrollment-document-requirement-policy.ts';

let assertions = 0;
function assert(condition: unknown, message: string): asserts condition { assertions += 1; if (!condition) throw new Error(message); }

assert(canConfigureDocumentRequirements('institution_admin'), 'Institution admin must configure document requirements.');
assert(canConfigureDocumentRequirements('director'), 'Director must configure document requirements.');
assert(!canConfigureDocumentRequirements('secretariat'), 'Secretariat must not govern document requirements.');
assert(!canConfigureDocumentRequirements('teacher'), 'Teacher must not govern document requirements.');

const normalized = normalizeDocumentRequirements(['  BI do aluno  ', 'BI   do aluno', 'Certificado escolar', 'x', '']);
assert(normalized.length === 2, 'Requirement names must be trimmed, deduplicated and validated.');
assert(normalized[0] === 'BI do aluno', 'Whitespace must normalize deterministically.');
assert(normalized[1] === 'Certificado escolar', 'Valid requirement must remain intact.');

const missingPolicy = documentValidationGate(false, []);
assert(!missingPolicy.ready && missingPolicy.reason === 'POLICY_NOT_CAPTURED', 'Missing policy snapshot must fail closed.');
const zeroRequirements = documentValidationGate(true, []);
assert(!zeroRequirements.ready && zeroRequirements.reason === 'REQUIREMENTS_NOT_CONFIGURED', 'A policy reference without materialized requirements must fail closed.');
const pendingRequired = documentValidationGate(true, [{ documentType: 'BI', required: true, status: 'submitted', sourceRequirementId: 'bi' }]);
assert(!pendingRequired.ready && pendingRequired.reason === 'REQUIRED_DOCUMENTS_UNVERIFIED', 'Required submitted document must wait for verification.');
const verifiedRequired = documentValidationGate(true, [{ documentType: 'BI', required: true, status: 'verified', sourceRequirementId: 'bi' }]);
assert(!verifiedRequired.ready, 'Historical evidence alone must not satisfy the physical-document gate.');
assert(documentValidationGate(true, [{ documentType: 'BI', required: true, status: 'verified', sourceRequirementId: 'bi', physicalFilePersisted: true }]).ready, 'Verified required document with a persisted physical file must satisfy validation.');
const optionalPending = documentValidationGate(true, [{ documentType: 'Foto extra', required: false, status: 'pending', sourceRequirementId: 'foto' }]);
assert(optionalPending.ready, 'Materialized optional document configuration must not block validation.');

console.log(`Secretariat S02.3.2 document requirement policy passed (${assertions} assertions).`);
