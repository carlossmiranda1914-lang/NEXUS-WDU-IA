import {
  IdentityDecisionError,
  decideIdentityDecision,
  proposeIdentityDecision,
  type IdentityDecisionPool,
} from '../src/modules/people/identity-resolution-decision.ts';

const failures: string[] = [];
let assertions = 0;
function expect(condition: unknown, message: string) {
  assertions += 1;
  if (!condition) failures.push(message);
}

class ScriptedClient {
  statements: string[] = [];
  released = false;
  constructor(private handler: (sql: string, values?: readonly unknown[]) => any) {}
  async query<T = any>(text: string, values?: readonly unknown[]) {
    const sql = text.replace(/\s+/g, ' ').trim();
    this.statements.push(sql);
    return this.handler(sql, values) as { rows: T[]; rowCount?: number | null };
  }
  release() { this.released = true; }
}

function poolFor(client: ScriptedClient): IdentityDecisionPool {
  return { connect: async () => client };
}

const instA = '11111111-1111-4111-8111-111111111111';
const secretariat = '22222222-2222-4222-8222-222222222222';
const director = '33333333-3333-4333-8333-333333333333';
const director2 = '44444444-4444-4444-8444-444444444444';
const admin = '55555555-5555-4555-8555-555555555555';
const candidate1 = '66666666-6666-4666-8666-666666666666';
const candidate2 = '77777777-7777-4777-8777-777777777777';

function membershipResult(personId: unknown) {
  if (personId === secretariat) return { rows: [{ role: 'secretariat' }], rowCount: 1 };
  if (personId === director || personId === director2) return { rows: [{ role: 'director' }], rowCount: 1 };
  if (personId === admin) return { rows: [{ role: 'institution_admin' }], rowCount: 1 };
  return { rows: [], rowCount: 0 };
}

let proposalInsertValues: readonly unknown[] | undefined;
const proposalClient = new ScriptedClient((sql, values) => {
  if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [{}], rowCount: 1 };
  if (sql.startsWith('SELECT role FROM memberships')) return membershipResult(values?.[1]);
  if (sql.startsWith('SELECT * FROM identity_resolution_decisions')) return { rows: [], rowCount: 0 };
  if (sql.startsWith('INSERT INTO identity_resolution_decisions')) {
    proposalInsertValues = values;
    return {
      rows: [{
        id: 'decision-b', institution_id: instA, case_key: 'case:multi:0001', risk_level: 'B',
        proposed_action: 'REUSE_PERSON', reason_code: 'MULTIPLE_CANDIDATES_RESOLVED',
        status: 'pending_confirmation', requested_by_person_id: secretariat, decided_by_person_id: null,
        approved_by_person_id: null, version: 1,
      }],
      rowCount: 1,
    };
  }
  throw new Error(`Unexpected SQL: ${sql}`);
});

const proposedB = await proposeIdentityDecision(poolFor(proposalClient), {
  institutionId: instA,
  actorPersonId: secretariat,
  caseKey: 'case:multi:0001',
  proposedAction: 'REUSE_PERSON',
  reasonCode: 'MULTIPLE_CANDIDATES_RESOLVED',
  proposedCandidatePersonId: candidate1,
  candidatePersonIds: [candidate1, candidate2],
  matchReasons: ['name', 'birth_date', 'national_id_number'],
  evidenceTypes: ['civil_document_presented'],
});
expect(proposedB.status === 'pending_confirmation', 'Secretariat may propose a level B resolution but not finalize it.');
expect(proposalClient.statements.some((s) => s.startsWith('SELECT role FROM memberships')), 'Proposal authority must be resolved from memberships.');
expect(!proposalClient.statements.some((s) => /INSERT INTO (people|student_profiles|enrollment_applications)/.test(s)), 'T5 must not create Person/Profile/Enrollment.');
expect(proposalClient.released, 'Proposal client must be released.');
expect(JSON.stringify(proposalInsertValues?.[9] ?? '').includes('national_id_number'), 'A match reason produced by the canonical resolver must survive the decision boundary without exposing the identifier itself.');

const approveBClient = new ScriptedClient((sql, values) => {
  if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT * FROM identity_resolution_decisions')) return {
    rows: [{ id: 'decision-b', institution_id: instA, case_key: 'case:multi:0001', risk_level: 'B', proposed_action: 'REUSE_PERSON', reason_code: 'MULTIPLE_CANDIDATES_RESOLVED', status: 'pending_confirmation', requested_by_person_id: secretariat, approved_by_person_id: null, version: 1 }], rowCount: 1,
  };
  if (sql.startsWith('SELECT role FROM memberships')) return membershipResult(values?.[1]);
  if (sql.startsWith('UPDATE identity_resolution_decisions')) return {
    rows: [{ id: 'decision-b', institution_id: instA, case_key: 'case:multi:0001', risk_level: 'B', proposed_action: 'REUSE_PERSON', reason_code: 'MULTIPLE_CANDIDATES_RESOLVED', status: 'approved', requested_by_person_id: secretariat, decided_by_person_id: director, approved_by_person_id: director, version: 2 }], rowCount: 1,
  };
  throw new Error(`Unexpected SQL: ${sql}`);
});
const approvedB = await decideIdentityDecision(poolFor(approveBClient), { institutionId: instA, actorPersonId: director, decisionId: 'decision-b', outcome: 'approve' });
expect(approvedB.status === 'approved', 'Director may approve a B decision proposed by Secretariat.');
expect(approvedB.approvedByPersonId === director, 'Approved decision must identify the actual approver.');

const selfApprovalClient = new ScriptedClient((sql, values) => {
  if (['BEGIN', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT * FROM identity_resolution_decisions')) return {
    rows: [{ id: 'decision-self', institution_id: instA, reason_code: 'MULTIPLE_CANDIDATES_RESOLVED', status: 'pending_confirmation', requested_by_person_id: director }], rowCount: 1,
  };
  if (sql.startsWith('SELECT role FROM memberships')) return membershipResult(values?.[1]);
  throw new Error(`Unexpected SQL after segregation should stop flow: ${sql}`);
});
let selfError: unknown;
try {
  await decideIdentityDecision(poolFor(selfApprovalClient), { institutionId: instA, actorPersonId: director, decisionId: 'decision-self', outcome: 'approve' });
} catch (error) { selfError = error; }
expect(selfError instanceof IdentityDecisionError && selfError.code === 'SEGREGATION_REQUIRED', 'A proposer cannot approve their own ambiguous decision.');
expect(selfApprovalClient.statements.includes('ROLLBACK'), 'Self-approval attempt must rollback.');

const secretariatConflictClient = new ScriptedClient((sql, values) => {
  if (['BEGIN', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [{}], rowCount: 1 };
  if (sql.startsWith('SELECT role FROM memberships')) return membershipResult(values?.[1]);
  throw new Error(`Sensitive proposal should stop before persistence: ${sql}`);
});
let sensitiveProposalError: unknown;
try {
  await proposeIdentityDecision(poolFor(secretariatConflictClient), {
    institutionId: instA, actorPersonId: secretariat, caseKey: 'case:conflict:01', proposedAction: 'CREATE_PERSON',
    reasonCode: 'NEW_PERSON_APPROVED_DESPITE_CONFLICT', candidatePersonIds: [candidate1], evidenceTypes: ['civil_document_presented'],
  });
} catch (error) { sensitiveProposalError = error; }
expect(sensitiveProposalError instanceof IdentityDecisionError && sensitiveProposalError.code === 'UNAUTHORIZED_DECISION', 'Secretariat cannot propose create-new despite strong conflict.');

const createConflictRow = {
  id: 'decision-c', institution_id: instA, case_key: 'case:conflict:02', risk_level: 'C', proposed_action: 'CREATE_PERSON',
  reason_code: 'NEW_PERSON_APPROVED_DESPITE_CONFLICT', status: 'pending_second_approval', requested_by_person_id: director,
  approved_by_person_id: null, version: 1,
};
const directorOnlyClient = new ScriptedClient((sql, values) => {
  if (['BEGIN', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT * FROM identity_resolution_decisions')) return { rows: [createConflictRow], rowCount: 1 };
  if (sql.startsWith('SELECT role FROM memberships')) return membershipResult(values?.[1]);
  throw new Error(`Approval without Institution Admin must stop: ${sql}`);
});
let adminRequiredError: unknown;
try {
  await decideIdentityDecision(poolFor(directorOnlyClient), { institutionId: instA, actorPersonId: director2, decisionId: 'decision-c', outcome: 'approve' });
} catch (error) { adminRequiredError = error; }
expect(adminRequiredError instanceof IdentityDecisionError && adminRequiredError.code === 'INSTITUTION_ADMIN_REQUIRED', 'Create-new despite conflict requires Institution Admin among the two authorities.');

const adminApprovalClient = new ScriptedClient((sql, values) => {
  if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT * FROM identity_resolution_decisions')) return { rows: [createConflictRow], rowCount: 1 };
  if (sql.startsWith('SELECT role FROM memberships')) return membershipResult(values?.[1]);
  if (sql.startsWith('UPDATE identity_resolution_decisions')) return {
    rows: [{ ...createConflictRow, status: 'approved', decided_by_person_id: admin, approved_by_person_id: admin, version: 2 }], rowCount: 1,
  };
  throw new Error(`Unexpected SQL: ${sql}`);
});
const approvedConflict = await decideIdentityDecision(poolFor(adminApprovalClient), { institutionId: instA, actorPersonId: admin, decisionId: 'decision-c', outcome: 'approve' });
expect(approvedConflict.status === 'approved', 'Independent Institution Admin may complete conflict exception approval.');
expect(approvedConflict.requestedByPersonId !== approvedConflict.approvedByPersonId, 'Sensitive approval must preserve segregation of duties.');

const identifierRow = {
  id: 'decision-id', institution_id: instA, case_key: 'case:identifier:1', risk_level: 'C', proposed_action: 'REUSE_PERSON',
  reason_code: 'IDENTIFIER_CONFLICT', status: 'pending_confirmation', requested_by_person_id: director,
  approved_by_person_id: null, version: 1,
};
const identifierDirectorClient = new ScriptedClient((sql, values) => {
  if (['BEGIN', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT * FROM identity_resolution_decisions')) return { rows: [identifierRow], rowCount: 1 };
  if (sql.startsWith('SELECT role FROM memberships')) return membershipResult(values?.[1]);
  throw new Error(`Identifier conflict must require admin: ${sql}`);
});
let identifierError: unknown;
try {
  await decideIdentityDecision(poolFor(identifierDirectorClient), { institutionId: instA, actorPersonId: director2, decisionId: 'decision-id', outcome: 'approve' });
} catch (error) { identifierError = error; }
expect(identifierError instanceof IdentityDecisionError && identifierError.code === 'INSTITUTION_ADMIN_REQUIRED', 'Identifier conflict final approval requires Institution Admin.');

const crossInstitutionClient = new ScriptedClient((sql) => {
  if (['BEGIN', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT * FROM identity_resolution_decisions')) return { rows: [], rowCount: 0 };
  throw new Error(`Cross-institution lookup must stop after scoped miss: ${sql}`);
});
let crossInstitutionError: unknown;
try {
  await decideIdentityDecision(poolFor(crossInstitutionClient), {
    institutionId: '99999999-9999-4999-8999-999999999999', actorPersonId: admin, decisionId: 'decision-b', outcome: 'approve',
  });
} catch (error) { crossInstitutionError = error; }
expect(crossInstitutionError instanceof IdentityDecisionError && crossInstitutionError.code === 'DECISION_NOT_FOUND', 'A decision from another institution must be indistinguishable from missing.');

let unsafeEvidenceError: unknown;
try {
  await proposeIdentityDecision(poolFor(proposalClient), {
    institutionId: instA, actorPersonId: secretariat, caseKey: 'case:unsafe:0001', proposedAction: 'REVIEW_REQUIRED',
    reasonCode: 'INSUFFICIENT_EVIDENCE', evidenceTypes: ['BI-123456789LA001'],
  });
} catch (error) { unsafeEvidenceError = error; }
expect(unsafeEvidenceError instanceof IdentityDecisionError && unsafeEvidenceError.code === 'INVALID_DECISION_INPUT', 'Raw civil identifiers must not enter structured evidence fields.');

let candidateError: unknown;
try {
  await proposeIdentityDecision(poolFor(proposalClient), {
    institutionId: instA, actorPersonId: secretariat, caseKey: 'case:candidate:01', proposedAction: 'REUSE_PERSON',
    reasonCode: 'MULTIPLE_CANDIDATES_RESOLVED', proposedCandidatePersonId: candidate1, candidatePersonIds: [candidate2],
  });
} catch (error) { candidateError = error; }
expect(candidateError instanceof IdentityDecisionError && candidateError.code === 'INVALID_DECISION_INPUT', 'Selected reuse candidate must belong to the internal candidate set.');

if (failures.length) throw new Error(failures.join('\n'));
console.log(`Identity resolution decision tests passed (${assertions} assertions).`);
