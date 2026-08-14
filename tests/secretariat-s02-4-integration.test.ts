import { readFile } from 'node:fs/promises';

const workspace = await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8');
let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };

assert(workspace.includes("import EnrollmentDocumentChecklist from './EnrollmentDocumentChecklist.tsx';"), 'S02.4 checklist component must be imported by the operational workspace.');
assert(workspace.includes('<EnrollmentDocumentChecklist enrollmentId={record.id} enrollmentStatus={record.status} light={light} request={request} />'), 'S02.4 checklist must be rendered inside the selected enrollment process drawer.');
assert(workspace.includes('<EnrollmentLifecycleActions status={record.status} light={light} onTransition={onTransition} />'), 'S02.4 must preserve lifecycle actions while adding document operations.');
assert(workspace.indexOf('<EnrollmentLifecycleActions status={record.status}') < workspace.indexOf('<EnrollmentDocumentChecklist enrollmentId={record.id}'), 'Document checklist must follow lifecycle context inside the drawer.');

console.log(`Secretariat S02.4 integration gate passed (${assertions} assertions).`);
