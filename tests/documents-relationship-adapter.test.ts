/**
 * Unit & Integration Test Suite for Canonical Documents Relationship Authority Adapter
 * Checkpoint: H1-02B — Canonical Relationship Authority Adapter
 *
 * Verifies:
 * 1. Student rules (self, other same-tenant, inactive profile, cross-tenant)
 * 2. Parent rules (active guardian relationship, unrelated student, inactive relationship, revoked relationship, cross-tenant)
 * 3. Teacher rules (target student, relationship-like input fail-closed)
 * 4. Management / Other roles (relationship semantics do not apply -> unknown)
 * 5. Tenant safety (derivation strictly from InstitutionalContext, foreign tenant cannot leak)
 * 6. Client untrusted inputs (cannot spoof relationship, teacherAssigned, or institutionId)
 * 7. DefaultDocumentRelationshipAdapter class wrapper delegation
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { InstitutionalContext, QueryExecutor } from '../src/auth/institutional-context.ts';
import {
  resolveDocumentRelationshipContext,
  DefaultDocumentRelationshipAdapter,
} from '../src/modules/documents/document-relationship-adapter.ts';

// ─── Test Fixture & Mock DB Simulation ──────────────────────────────────────

interface MockStudentProfile {
  id: string;
  person_id: string;
  institution_id: string;
  name: string;
  student_number: string | null;
  legacy_student_id: string | null;
  status: 'active' | 'inactive';
}

interface MockGuardianRelationship {
  id: string;
  guardian_person_id: string;
  student_person_id: string;
  institution_id: string;
  status: 'active' | 'inactive' | 'revoked';
}

function createMockExecutor(data: {
  studentProfiles?: MockStudentProfile[];
  guardianRelationships?: MockGuardianRelationship[];
  onQuery?: (sql: string, params: unknown[]) => void;
}): QueryExecutor {
  const profiles = data.studentProfiles ?? [];
  const relationships = data.guardianRelationships ?? [];

  return {
    query: async (sql: string, params: unknown[]) => {
      data.onQuery?.(sql, params);

      if (sql.includes('guardian_relationships')) {
        // Parent query: guardian_relationships JOIN student_profiles
        const [instId, guardianPersonId] = params as [string, string];
        const matched = relationships
          .filter(
            (r) =>
              r.institution_id === instId &&
              r.guardian_person_id === guardianPersonId &&
              r.status === 'active',
          )
          .map((r) => {
            const profile = profiles.find(
              (p) =>
                p.person_id === r.student_person_id &&
                p.institution_id === instId &&
                p.status === 'active',
            );
            if (!profile) return null;
            return {
              student_profile_id: profile.id,
              person_id: profile.person_id,
              name: profile.name,
              student_number: profile.student_number,
              legacy_student_id: profile.legacy_student_id,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);

        return { rows: matched };
      } else if (sql.includes('student_profiles')) {
        // Student query: student_profiles WHERE institution_id = $1 AND person_id = $2 AND status = 'active'
        const [instId, personId] = params as [string, string];
        const matched = profiles
          .filter(
            (p) =>
              p.institution_id === instId &&
              p.person_id === personId &&
              p.status === 'active',
          )
          .map((p) => ({
            student_profile_id: p.id,
            person_id: p.person_id,
            name: p.name,
            student_number: p.student_number,
            legacy_student_id: p.legacy_student_id,
          }));

        return { rows: matched };
      }

      return { rows: [] };
    },
  };
}

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const STUDENT_1_PERSON = 'student-1-person-id';
const STUDENT_2_PERSON = 'student-2-person-id';
const STUDENT_INACTIVE_PERSON = 'student-inactive-person-id';
const STUDENT_TENANT_B_PERSON = 'student-tenant-b-person-id';

const PARENT_1_PERSON = 'parent-1-person-id';
const PARENT_UNRELATED_PERSON = 'parent-unrelated-person-id';
const TEACHER_1_PERSON = 'teacher-1-person-id';
const ADMIN_1_PERSON = 'admin-1-person-id';

const MOCK_PROFILES: MockStudentProfile[] = [
  {
    id: 'sp-1',
    person_id: STUDENT_1_PERSON,
    institution_id: TENANT_A,
    name: 'Alice Student',
    student_number: 'STU-001',
    legacy_student_id: null,
    status: 'active',
  },
  {
    id: 'sp-2',
    person_id: STUDENT_2_PERSON,
    institution_id: TENANT_A,
    name: 'Bob Student',
    student_number: 'STU-002',
    legacy_student_id: null,
    status: 'active',
  },
  {
    id: 'sp-inactive',
    person_id: STUDENT_INACTIVE_PERSON,
    institution_id: TENANT_A,
    name: 'Charlie Inactive',
    student_number: 'STU-003',
    legacy_student_id: null,
    status: 'inactive',
  },
  {
    id: 'sp-tenant-b',
    person_id: STUDENT_TENANT_B_PERSON,
    institution_id: TENANT_B,
    name: 'David Foreign Tenant',
    student_number: 'STU-999',
    legacy_student_id: null,
    status: 'active',
  },
];

const MOCK_RELATIONSHIPS: MockGuardianRelationship[] = [
  // Parent 1 -> Student 1 (active)
  {
    id: 'gr-1',
    guardian_person_id: PARENT_1_PERSON,
    student_person_id: STUDENT_1_PERSON,
    institution_id: TENANT_A,
    status: 'active',
  },
  // Parent 1 -> Student Inactive (inactive relationship)
  {
    id: 'gr-2',
    guardian_person_id: PARENT_1_PERSON,
    student_person_id: STUDENT_INACTIVE_PERSON,
    institution_id: TENANT_A,
    status: 'inactive',
  },
  // Parent 1 -> Student 2 (revoked relationship)
  {
    id: 'gr-3',
    guardian_person_id: PARENT_1_PERSON,
    student_person_id: STUDENT_2_PERSON,
    institution_id: TENANT_A,
    status: 'revoked',
  },
  // Parent 1 -> Tenant B Student (foreign tenant relationship)
  {
    id: 'gr-4',
    guardian_person_id: PARENT_1_PERSON,
    student_person_id: STUDENT_TENANT_B_PERSON,
    institution_id: TENANT_B,
    status: 'active',
  },
];

// Helper to construct InstitutionalContext
function makeContext(overrides: Partial<InstitutionalContext>): InstitutionalContext {
  return {
    personId: STUDENT_1_PERSON,
    personName: 'Test User',
    identityEmail: 'user@test.edu',
    membershipId: 'mem-1',
    institutionId: TENANT_A,
    institutionName: 'Tenant A Academy',
    institutionSlug: 'tenant-a',
    role: 'student',
    ...overrides,
  };
}

// ─── 1. Student Relationship Rules ──────────────────────────────────────────

test('STUDENT: student + own active StudentProfile => self', async () => {
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
  });
  const context = makeContext({
    personId: STUDENT_1_PERSON,
    role: 'student',
    institutionId: TENANT_A,
  });

  const res = await resolveDocumentRelationshipContext(executor, context, STUDENT_1_PERSON);
  assert.equal(res.relationshipContext, 'self');
  assert.equal(res.subjectPersonId, STUDENT_1_PERSON);
  assert.equal(res.evidence?.resolvedCount, 1);
});

test('STUDENT: student + another same-tenant student => unrelated', async () => {
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
  });
  const context = makeContext({
    personId: STUDENT_1_PERSON,
    role: 'student',
    institutionId: TENANT_A,
  });

  const res = await resolveDocumentRelationshipContext(executor, context, STUDENT_2_PERSON);
  assert.equal(res.relationshipContext, 'unrelated');
  assert.equal(res.subjectPersonId, STUDENT_2_PERSON);
});

test('STUDENT: student + inactive StudentProfile => unrelated', async () => {
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
  });
  const context = makeContext({
    personId: STUDENT_INACTIVE_PERSON,
    role: 'student',
    institutionId: TENANT_A,
  });

  const res = await resolveDocumentRelationshipContext(executor, context, STUDENT_INACTIVE_PERSON);
  assert.equal(res.relationshipContext, 'unrelated');
  assert.equal(res.subjectPersonId, STUDENT_INACTIVE_PERSON);
  assert.equal(res.evidence?.resolvedCount, 0);
});

test('STUDENT: student + cross-tenant target => unrelated', async () => {
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
  });
  const context = makeContext({
    personId: STUDENT_1_PERSON,
    role: 'student',
    institutionId: TENANT_A,
  });

  const res = await resolveDocumentRelationshipContext(executor, context, STUDENT_TENANT_B_PERSON);
  assert.equal(res.relationshipContext, 'unrelated');
  assert.equal(res.subjectPersonId, STUDENT_TENANT_B_PERSON);
});

// ─── 2. Parent Relationship Rules ───────────────────────────────────────────

test('PARENT: parent + active GuardianRelationship => guardian_of_subject', async () => {
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
  });
  const context = makeContext({
    personId: PARENT_1_PERSON,
    role: 'parent',
    institutionId: TENANT_A,
  });

  const res = await resolveDocumentRelationshipContext(executor, context, STUDENT_1_PERSON);
  assert.equal(res.relationshipContext, 'guardian_of_subject');
  assert.equal(res.subjectPersonId, STUDENT_1_PERSON);
  assert.equal(res.evidence?.resolvedCount, 1);
});

test('PARENT: parent + unrelated student => unrelated', async () => {
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
  });
  const context = makeContext({
    personId: PARENT_UNRELATED_PERSON,
    role: 'parent',
    institutionId: TENANT_A,
  });

  const res = await resolveDocumentRelationshipContext(executor, context, STUDENT_1_PERSON);
  assert.equal(res.relationshipContext, 'unrelated');
  assert.equal(res.subjectPersonId, STUDENT_1_PERSON);
  assert.equal(res.evidence?.resolvedCount, 0);
});

test('PARENT: parent + inactive relationship => unrelated', async () => {
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
  });
  const context = makeContext({
    personId: PARENT_1_PERSON,
    role: 'parent',
    institutionId: TENANT_A,
  });

  // gr-2 is status: 'inactive'
  const res = await resolveDocumentRelationshipContext(executor, context, STUDENT_INACTIVE_PERSON);
  assert.equal(res.relationshipContext, 'unrelated');
  assert.equal(res.subjectPersonId, STUDENT_INACTIVE_PERSON);
});

test('PARENT: parent + revoked relationship => unrelated', async () => {
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
  });
  const context = makeContext({
    personId: PARENT_1_PERSON,
    role: 'parent',
    institutionId: TENANT_A,
  });

  // gr-3 is status: 'revoked'
  const res = await resolveDocumentRelationshipContext(executor, context, STUDENT_2_PERSON);
  assert.equal(res.relationshipContext, 'unrelated');
  assert.equal(res.subjectPersonId, STUDENT_2_PERSON);
});

test('PARENT: parent + cross-tenant target => unrelated', async () => {
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
  });
  // Parent is authenticated in Tenant A
  const context = makeContext({
    personId: PARENT_1_PERSON,
    role: 'parent',
    institutionId: TENANT_A,
  });

  // Target belongs to Tenant B (even if parent has a relationship in Tenant B, current context is Tenant A)
  const res = await resolveDocumentRelationshipContext(executor, context, STUDENT_TENANT_B_PERSON);
  assert.equal(res.relationshipContext, 'unrelated');
  assert.equal(res.subjectPersonId, STUDENT_TENANT_B_PERSON);
});

// ─── 3. Teacher Rules ───────────────────────────────────────────────────────

test('TEACHER: teacher + target student => unrelated (fail-closed)', async () => {
  let queryExecuted = false;
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
    onQuery: () => {
      queryExecuted = true;
    },
  });
  const context = makeContext({
    personId: TEACHER_1_PERSON,
    role: 'teacher',
    institutionId: TENANT_A,
  });

  const res = await resolveDocumentRelationshipContext(executor, context, STUDENT_1_PERSON);
  assert.equal(res.relationshipContext, 'unrelated');
  assert.equal(res.subjectPersonId, STUDENT_1_PERSON);
  // Invariant: TeacherAssignment is NOT queried in H1-02B; query should NOT even execute for teacher
  assert.equal(queryExecuted, false, 'No relationship or teacher query should be executed for teacher');
});

test('TEACHER: teacher + any relationship-like input => unrelated', async () => {
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
  });
  const context = makeContext({
    personId: TEACHER_1_PERSON,
    role: 'teacher',
    institutionId: TENANT_A,
  });

  const res = await resolveDocumentRelationshipContext(executor, context, 'some-student-id');
  assert.equal(res.relationshipContext, 'unrelated');
});

// ─── 4. Management & Other Roles ────────────────────────────────────────────

test('MANAGEMENT: institution_admin + target student => unknown', async () => {
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
  });
  const context = makeContext({
    personId: ADMIN_1_PERSON,
    role: 'institution_admin',
    institutionId: TENANT_A,
  });

  const res = await resolveDocumentRelationshipContext(executor, context, STUDENT_1_PERSON);
  assert.equal(res.relationshipContext, 'unknown');
  assert.equal(res.subjectPersonId, STUDENT_1_PERSON);
});

test('TARGET_ABSENT: missing target student ID returns unrelated for student/parent/teacher', async () => {
  const executor = createMockExecutor({});
  const studentContext = makeContext({ role: 'student' });
  const parentContext = makeContext({ role: 'parent' });
  const teacherContext = makeContext({ role: 'teacher' });
  const adminContext = makeContext({ role: 'institution_admin' });

  assert.equal(
    (await resolveDocumentRelationshipContext(executor, studentContext)).relationshipContext,
    'unrelated',
  );
  assert.equal(
    (await resolveDocumentRelationshipContext(executor, parentContext, '')).relationshipContext,
    'unrelated',
  );
  assert.equal(
    (await resolveDocumentRelationshipContext(executor, teacherContext, null)).relationshipContext,
    'unrelated',
  );
  assert.equal(
    (await resolveDocumentRelationshipContext(executor, adminContext)).relationshipContext,
    'unknown',
  );
});

// ─── 5. Tenant Safety & Query Parameter Verification ────────────────────────

test('TENANT_SAFETY: queries are strictly bound to context.institutionId', async () => {
  let capturedParams: unknown[] = [];
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
    onQuery: (_sql, params) => {
      capturedParams = params;
    },
  });

  const context = makeContext({
    personId: PARENT_1_PERSON,
    role: 'parent',
    institutionId: TENANT_A,
  });

  await resolveDocumentRelationshipContext(executor, context, STUDENT_1_PERSON);
  assert.equal(capturedParams[0], TENANT_A, 'SQL $1 must strictly equal context.institutionId');
  assert.equal(capturedParams[1], PARENT_1_PERSON, 'SQL $2 must strictly equal context.personId');
});

test('TENANT_SAFETY: missing context institution or person fails closed', async () => {
  const executor = createMockExecutor({});
  const invalidContext = makeContext({ institutionId: '', personId: '' });

  const res = await resolveDocumentRelationshipContext(executor, invalidContext, STUDENT_1_PERSON);
  assert.equal(res.relationshipContext, 'unrelated');
});

// ─── 6. Client Untrusted Inputs Proof ───────────────────────────────────────

test('CLIENT_TRUST: client-injected relationship, teacherAssigned, or foreign tenant cannot alter result', async () => {
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
  });

  // Simulate an untrusted client attempting to pass extra properties
  const maliciousPayload = {
    ...makeContext({
      personId: STUDENT_1_PERSON,
      role: 'student',
      institutionId: TENANT_A,
    }),
    relationship: 'self',
    teacherAssigned: true,
    institutionId_client: TENANT_B,
  } as unknown as InstitutionalContext;

  // 1. Attempting to claim 'self' on another student's personId
  const resOtherStudent = await resolveDocumentRelationshipContext(
    executor,
    maliciousPayload,
    STUDENT_2_PERSON,
  );
  assert.equal(
    resOtherStudent.relationshipContext,
    'unrelated',
    'Cannot forge relationship to another student',
  );

  // 2. Teacher attempting to supply teacherAssigned: true
  const teacherMalicious = {
    ...makeContext({
      personId: TEACHER_1_PERSON,
      role: 'teacher',
      institutionId: TENANT_A,
    }),
    teacherAssigned: true,
    relationship: 'teacher_assigned',
  } as unknown as InstitutionalContext;

  const resTeacher = await resolveDocumentRelationshipContext(
    executor,
    teacherMalicious,
    STUDENT_1_PERSON,
  );
  assert.equal(
    resTeacher.relationshipContext,
    'unrelated',
    'Teacher cannot bypass fail-closed policy with client claims',
  );
});

// ─── 7. DefaultDocumentRelationshipAdapter Class Delegation ──────────────────

test('ADAPTER_CLASS: DefaultDocumentRelationshipAdapter delegates cleanly', async () => {
  const executor = createMockExecutor({
    studentProfiles: MOCK_PROFILES,
    guardianRelationships: MOCK_RELATIONSHIPS,
  });
  const adapter = new DefaultDocumentRelationshipAdapter(executor);
  const context = makeContext({
    personId: STUDENT_1_PERSON,
    role: 'student',
    institutionId: TENANT_A,
  });

  const res = await adapter.resolveRelationship(context, STUDENT_1_PERSON);
  assert.equal(res.relationshipContext, 'self');
});
