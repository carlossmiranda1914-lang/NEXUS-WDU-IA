import { readFile } from 'node:fs/promises';

const workspace = await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8');
let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };

assert(workspace.includes("import EnrollmentDocumentChecklist from './EnrollmentDocumentChecklist.tsx';"), 'S02.4 checklist component must be imported by the operational workspace.');
assert(workspace.includes('<EnrollmentDocumentChecklist enrollmentId={record.id} enrollmentStatus={process.enrollmentStatus} light={light} request={request} onChanged={loadProcess} />'), 'S02.4 checklist must remain inside the selected persisted process drawer.');
assert(workspace.includes('<EnrollmentLifecycleActions status={process.enrollmentStatus} light={light}'), 'S02.4 must preserve authorized lifecycle actions while adding S03 projection.');
assert(workspace.indexOf('<EnrollmentLifecycleActions status={process.enrollmentStatus}') < workspace.indexOf('<EnrollmentDocumentChecklist enrollmentId={record.id}'), 'Document checklist must follow lifecycle context inside the drawer.');

console.log(`Secretariat S02.4 integration gate passed (${assertions} assertions).`);
