import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const drawer = await readFile(new URL('../src/components/EnrollmentNewEntryDrawer.tsx', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/modules/enrollments/enrollment-intake-client.ts', import.meta.url), 'utf8');
const controller = await readFile(new URL('../src/modules/enrollments/enrollment.controller.ts', import.meta.url), 'utf8');

assert.match(drawer, /RESTRICTED_POSSIBLE_MATCH/, 'Restricted results must have an explicit product path.');
assert.match(drawer, /REVIEW_REQUIRED/, 'Ambiguous results must have an explicit product path.');
assert.match(drawer, /Pedir revisão de identidade/, 'An operator must be able to ask for safe review rather than reach an informational dead end.');
assert.match(drawer, /Revisar decisões pendentes/, 'Authorized reviewers must be able to reach server-confirmed pending decisions.');
assert.match(drawer, /A aguardar revisão autorizada/, 'Waiting status must be understandable without internal terminology.');
assert.match(drawer, /São necessárias mais informações/, 'More-information status must be understandable.');
assert.match(drawer, /Decisão rejeitada/, 'Rejected status must be understandable.');
assert.match(drawer, /Decisão aprovada/, 'Approved status must be understandable.');
assert.match(drawer, /Pedir mais informações/, 'Authorized review must provide the existing more-information outcome.');
assert.match(drawer, /Aprovar decisão/, 'Authorized review must provide the existing approval outcome.');
assert.match(drawer, /Rejeitar decisão/, 'Authorized review must provide the existing rejection outcome.');
assert.match(drawer, /Enviar informações/, 'More-information state must expose evidence resubmission.');
assert.match(drawer, /capabilities\?\.canApprove/, 'Review actions must be rendered only from server-derived capabilities.');
assert.match(drawer, /capabilities\?\.canRequestMoreInformation/, 'More-information actions must be rendered only from server-derived capabilities.');
assert.match(drawer, /decisionRef/, 'The UI must retain the opaque server decision reference.');
assert.match(client, /identity-decisions/, 'The client must use the existing identity decision endpoint.');
assert.match(client, /listIdentityReviewQueue/, 'The client must consume the existing authorized review queue.');
assert.match(client, /\/evidence/, 'Evidence must use the existing re-resolution endpoint.');
assert.match(client, /resumeApprovedIdentityReview/, 'An approved queue decision must resume intake from the server-owned binding, not editable browser fields.');
assert.match(client, /identity-decisions\/\$\{decisionRef\}\/intake/, 'Approved intake resume must address only the opaque decision reference.');
assert.match(controller, /identity-decisions\/:ref\/intake/, 'The server must own the reviewed-intake resume boundary.');
assert.match(client, /decisionRef/, 'Canonical intake resume must use only the opaque decision reference.');
assert.doesNotMatch(drawer + client, /candidatePersonId|candidate_person_id|personId:|person_id|decisionId|decision_id/, 'The browser must never select a Person/candidate or send internal decision ids.');
assert.doesNotMatch(client, /candidate|selectedPerson|resolvedPerson/, 'The client must not derive a Person choice from a decision.');

console.log('[ALUNOS-01A.3] identity review continuity contract: PASS.');
