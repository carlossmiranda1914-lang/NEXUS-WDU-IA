import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('src/App.tsx', 'utf8');
const client = await readFile('src/supabaseClient.ts', 'utf8');
const workflows = await readFile('src/components/WorkflowsCentral.tsx', 'utf8');
const workspace = await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8');
let assertions = 0;
const expect = (condition: unknown, message: string) => { assertions += 1; assert(condition, message); };

expect(!client.includes('upsertLiveStudent'), 'The frontend client must not expose the legacy student POST writer.');
expect(!client.includes('deleteLiveStudent'), 'The frontend client must not expose the legacy student DELETE writer.');
expect(!app.includes('upsertLiveStudent') && !app.includes('deleteLiveStudent'), 'App must not import or call legacy student writers.');
expect(client.includes("fetch('/api/students', { headers })"), 'Legacy student reading remains available during the transition.');
expect(!client.includes("method: 'POST'\n") || !client.includes("fetch('/api/students', {\n      method: 'POST'"), 'The client must not POST to /api/students.');
expect(!client.includes('fetch(`/api/students/${id}`'), 'The client must not DELETE legacy students.');
expect(workflows.includes('onStartCanonicalEnrollment') && !workflows.includes('onAddStudent'), 'The workflow entry must redirect to canonical enrollment rather than create a legacy student.');
expect(workspace.includes('/api/enrollments'), 'EnrollmentOperationsWorkspace remains the canonical enrollment consumer.');
console.log(`[LEGACY-STUDENT-FRONTEND-FENCE-CONTRACT] passed (${assertions} assertions).`);
