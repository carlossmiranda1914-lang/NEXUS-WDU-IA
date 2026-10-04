/**
 * Unit Test Suite for Central Documents Authorization Authority
 * Checkpoint: H1-01 — Central Authorization Authority
 *
 * Verifies:
 * 1. Default Deny (unknown role, unknown action, missing policy, missing relationship)
 * 2. Role-based gating (managers, teachers, students)
 * 3. Category-scoped authorization (category A allowed, category B denied)
 * 4. Relationship context evaluation (self, guardian, unrelated, unknown)
 * 5. Tenant and Identity context safety (missing tenant/person)
 * 6. Explicit Deny precedence over Allow
 * 7. Existing protected actions representation & composition with existing engines
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_DOCUMENT_ACTIONS,
  MANAGEMENT_ROLES,
  isManagementRole,
  isCanonicalDocumentAction,
  DefaultDocumentAuthorizationAuthority,
  createDefaultDocumentAuthorizationRules,
  type DocumentAuthorizationRule,
  type AuthorizationContext,
} from '../src/modules/documents/document-authorization-policy.ts';
import {
  ConfigurableDocumentAccessPolicyEngine,
  type DocumentAccessPolicyRule,
} from '../src/modules/documents/document-access-policy.ts';
import {
  ConfigurableRetentionPolicyEngine,
  type RetentionPolicyConfig,
} from '../src/modules/documents/document-retention-policy.ts';

const SAMPLE_INSTITUTION_ID = '11111111-1111-1111-1111-111111111111';
const SAMPLE_PERSON_ID = '22222222-2222-2222-2222-222222222222';

test('CANONICAL_ACTIONS: All 18 canonical actions are strictly defined and unique', () => {
  assert.equal(CANONICAL_DOCUMENT_ACTIONS.length, 18);
  const set = new Set(CANONICAL_DOCUMENT_ACTIONS);
  assert.equal(set.size, 18, 'No duplicate action names allowed');

  const expectedActions = [
    'list_metadata',
    'view_metadata',
    'view_versions',
    'view_activity',
    'create_document',
    'upload_version',
    'search_association_target',
    'create_association',
    'remove_association',
    'open_content',
    'download_content',
    'revoke_grant',
    'assign_retention',
    'place_hold',
    'release_hold',
    'authorize_deletion',
    'execute_deletion',
    'reconcile_deletion',
  ];

  for (const act of expectedActions) {
    assert.ok(set.has(act as any), `Action ${act} must be canonical`);
    assert.ok(isCanonicalDocumentAction(act), `isCanonicalDocumentAction(${act}) must be true`);
  }

  assert.equal(isCanonicalDocumentAction('unknown_action'), false);
  assert.equal(isCanonicalDocumentAction(''), false);
  assert.equal(isCanonicalDocumentAction(null), false);
});

test('MANAGEMENT_ROLES: Canonical helper identifies management roles', () => {
  assert.equal(isManagementRole('institution_admin'), true);
  assert.equal(isManagementRole('admin'), true);
  assert.equal(isManagementRole('director'), true);
  assert.equal(isManagementRole('superadmin'), true);
  assert.equal(isManagementRole('system'), true);

  assert.equal(isManagementRole('teacher'), false);
  assert.equal(isManagementRole('student'), false);
  assert.equal(isManagementRole('parent'), false);
  assert.equal(isManagementRole('guest'), false);
  assert.equal(isManagementRole(undefined), false);
});

test('DEFAULT_DENY: Unknown role, unknown action, missing policy, or missing rule fails closed', () => {
  // Empty rules config
  const authorityWithoutRules = new DefaultDocumentAuthorizationAuthority({ rules: [] });
  const decisionNoPolicy = authorityWithoutRules.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'institution_admin',
    action: 'list_metadata',
  });
  assert.equal(decisionNoPolicy.allowed, false);
  assert.equal(decisionNoPolicy.reasonCode, 'POLICY_NOT_CONFIGURED');

  // Configured authority with single limited rule
  const authority = new DefaultDocumentAuthorizationAuthority({
    rules: [
      {
        role: 'institution_admin',
        actions: ['list_metadata'],
      },
    ],
  });

  // Unknown role
  const decisionUnknownRole = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'unknown_role',
    action: 'list_metadata',
  });
  assert.equal(decisionUnknownRole.allowed, false);
  assert.equal(decisionUnknownRole.reasonCode, 'ROLE_NOT_AUTHORIZED');

  // Unknown action (not canonical)
  const decisionUnknownAction = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'institution_admin',
    action: 'invalid_action' as any,
  });
  assert.equal(decisionUnknownAction.allowed, false);
  assert.equal(decisionUnknownAction.reasonCode, 'ACTION_NOT_AUTHORIZED');

  // Known role, unconfigured action
  const decisionUnconfiguredAction = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'institution_admin',
    action: 'create_document',
  });
  assert.equal(decisionUnconfiguredAction.allowed, false);
  assert.equal(decisionUnconfiguredAction.reasonCode, 'ACTION_NOT_AUTHORIZED');
});

test('TENANT_AND_IDENTITY_SAFETY: Missing institutionId or personId fails closed', () => {
  const authority = new DefaultDocumentAuthorizationAuthority({
    rules: [{ role: '*', actions: '*' }],
  });

  // Missing institutionId
  const noTenant = authority.authorize({
    institutionId: '',
    personId: SAMPLE_PERSON_ID,
    role: 'institution_admin',
    action: 'list_metadata',
  });
  assert.equal(noTenant.allowed, false);
  assert.equal(noTenant.reasonCode, 'TENANT_CONTEXT_INVALID');

  // Missing personId
  const noPerson = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: '   ',
    role: 'institution_admin',
    action: 'list_metadata',
  });
  assert.equal(noPerson.allowed, false);
  assert.equal(noPerson.reasonCode, 'RESOURCE_CONTEXT_MISSING');

  // Missing role
  const noRole = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: '',
    action: 'list_metadata',
  });
  assert.equal(noRole.allowed, false);
  assert.equal(noRole.reasonCode, 'ROLE_NOT_AUTHORIZED');
});

test('ROLE_GATING: Managers vs Teachers vs Students on sensitive management actions', () => {
  const rules: DocumentAuthorizationRule[] = [
    {
      role: MANAGEMENT_ROLES,
      actions: [
        'list_metadata',
        'create_document',
        'upload_version',
        'create_association',
        'remove_association',
        'assign_retention',
        'place_hold',
        'release_hold',
        'authorize_deletion',
        'execute_deletion',
        'reconcile_deletion',
      ],
    },
    {
      role: 'teacher',
      actions: ['list_metadata', 'view_metadata', 'view_versions'],
    },
    {
      role: 'student',
      actions: ['view_metadata'],
    },
  ];

  const authority = new DefaultDocumentAuthorizationAuthority({ rules });

  // Manager: permitted actions ALLOW
  assert.equal(
    authority.authorize({
      institutionId: SAMPLE_INSTITUTION_ID,
      personId: SAMPLE_PERSON_ID,
      role: 'institution_admin',
      action: 'assign_retention',
    }).allowed,
    true,
  );
  assert.equal(
    authority.authorize({
      institutionId: SAMPLE_INSTITUTION_ID,
      personId: SAMPLE_PERSON_ID,
      role: 'director',
      action: 'place_hold',
    }).allowed,
    true,
  );

  // Student: restricted management actions DENY
  const studentDelete = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'student',
    action: 'authorize_deletion',
  });
  assert.equal(studentDelete.allowed, false);
  assert.equal(studentDelete.reasonCode, 'ACTION_NOT_AUTHORIZED');

  const studentUpload = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'student',
    action: 'upload_version',
  });
  assert.equal(studentUpload.allowed, false);
  assert.equal(studentUpload.reasonCode, 'ACTION_NOT_AUTHORIZED');

  // Teacher: restricted administrative actions DENY
  const teacherHold = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'teacher',
    action: 'place_hold',
  });
  assert.equal(teacherHold.allowed, false);
  assert.equal(teacherHold.reasonCode, 'ACTION_NOT_AUTHORIZED');
});

test('CATEGORY_SCOPING: Category-specific rules grant access only to authorized categories', () => {
  const rules: DocumentAuthorizationRule[] = [
    {
      role: 'teacher',
      actions: ['view_metadata', 'open_content'],
      categories: ['academic_transcript', 'exam_paper'],
    },
    {
      role: 'financial',
      actions: ['view_metadata', 'open_content'],
      categories: ['tuition_receipt', 'financial_proof'],
    },
  ];

  const authority = new DefaultDocumentAuthorizationAuthority({ rules });

  // Teacher accessing academic_transcript: ALLOW
  assert.equal(
    authority.authorize({
      institutionId: SAMPLE_INSTITUTION_ID,
      personId: SAMPLE_PERSON_ID,
      role: 'teacher',
      action: 'view_metadata',
      documentCategory: 'academic_transcript',
    }).allowed,
    true,
  );

  // Teacher accessing financial_proof: DENY with CATEGORY_NOT_AUTHORIZED
  const teacherFinance = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'teacher',
    action: 'view_metadata',
    documentCategory: 'financial_proof',
  });
  assert.equal(teacherFinance.allowed, false);
  assert.equal(teacherFinance.reasonCode, 'CATEGORY_NOT_AUTHORIZED');

  // Teacher accessing with missing category: DENY
  const teacherNoCategory = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'teacher',
    action: 'view_metadata',
  });
  assert.equal(teacherNoCategory.allowed, false);
  assert.equal(teacherNoCategory.reasonCode, 'CATEGORY_NOT_AUTHORIZED');
});

test('RELATIONSHIP_CONTEXT: Self and guardian allowed, unrelated and unknown fail closed', () => {
  const rules: DocumentAuthorizationRule[] = [
    {
      role: 'student',
      actions: ['view_metadata', 'open_content', 'download_content'],
      categories: ['identification', 'academic_transcript'],
      requiredRelationships: ['self'],
    },
    {
      role: 'parent',
      actions: ['view_metadata', 'open_content', 'download_content'],
      categories: ['academic_transcript'],
      requiredRelationships: ['guardian_of_subject'],
    },
  ];

  const authority = new DefaultDocumentAuthorizationAuthority({ rules });

  // Student + self relationship: ALLOW
  const studentSelf = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'student',
    action: 'open_content',
    documentCategory: 'identification',
    relationshipContext: 'self',
  });
  assert.equal(studentSelf.allowed, true);
  assert.equal(studentSelf.reasonCode, 'ALLOWED');

  // Student + guardian_of_subject: DENY (required 'self')
  const studentAsGuardian = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'student',
    action: 'open_content',
    documentCategory: 'identification',
    relationshipContext: 'guardian_of_subject',
  });
  assert.equal(studentAsGuardian.allowed, false);
  assert.equal(studentAsGuardian.reasonCode, 'RELATIONSHIP_REQUIRED');

  // Student + unrelated: DENY
  const studentUnrelated = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'student',
    action: 'open_content',
    documentCategory: 'identification',
    relationshipContext: 'unrelated',
  });
  assert.equal(studentUnrelated.allowed, false);
  assert.equal(studentUnrelated.reasonCode, 'RELATIONSHIP_REQUIRED');

  // Student + unknown relationship: FAIL CLOSED with RELATIONSHIP_REQUIRED
  const studentUnknown = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'student',
    action: 'open_content',
    documentCategory: 'identification',
    relationshipContext: 'unknown',
  });
  assert.equal(studentUnknown.allowed, false);
  assert.equal(studentUnknown.reasonCode, 'RELATIONSHIP_REQUIRED');

  // Student + missing relationship: FAIL CLOSED
  const studentMissingRel = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'student',
    action: 'open_content',
    documentCategory: 'identification',
  });
  assert.equal(studentMissingRel.allowed, false);
  assert.equal(studentMissingRel.reasonCode, 'RELATIONSHIP_REQUIRED');

  // Parent + guardian_of_subject: ALLOW
  const parentGuardian = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'parent',
    action: 'download_content',
    documentCategory: 'academic_transcript',
    relationshipContext: 'guardian_of_subject',
  });
  assert.equal(parentGuardian.allowed, true);
  assert.equal(parentGuardian.reasonCode, 'ALLOWED');
});

test('EXPLICIT_DENY_PRECEDENCE: Deny rule takes precedence over broad allow rule', () => {
  const rules: DocumentAuthorizationRule[] = [
    // Broad allow rule for teacher
    {
      role: 'teacher',
      actions: ['view_metadata', 'open_content', 'download_content'],
      categories: '*',
      effect: 'allow',
    },
    // Specific deny rule: teachers cannot download confidential_exam
    {
      role: 'teacher',
      actions: ['download_content'],
      categories: ['confidential_exam'],
      effect: 'deny',
    },
  ];

  const authority = new DefaultDocumentAuthorizationAuthority({ rules });

  // Normal category download: ALLOW
  assert.equal(
    authority.authorize({
      institutionId: SAMPLE_INSTITUTION_ID,
      personId: SAMPLE_PERSON_ID,
      role: 'teacher',
      action: 'download_content',
      documentCategory: 'general',
    }).allowed,
    true,
  );

  // Confidential exam download: DENIED by explicit deny rule
  const denyRes = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'teacher',
    action: 'download_content',
    documentCategory: 'confidential_exam',
  });
  assert.equal(denyRes.allowed, false);
  assert.equal(denyRes.reasonCode, 'ACTION_NOT_AUTHORIZED');
});

test('EXISTING_POLICY_COMPOSITION: Delegates to DocumentAccessPolicyEngine and RetentionPolicyEngine without weakening', () => {
  // Setup existing DocumentAccessPolicyEngine
  const accessRules: DocumentAccessPolicyRule[] = [
    {
      role: 'institution_admin',
      category: '*',
      allowedActions: ['open_content', 'download_content'],
    },
  ];
  const accessEngine = new ConfigurableDocumentAccessPolicyEngine(accessRules);

  // Setup existing RetentionPolicyEngine
  const retentionConfigs: RetentionPolicyConfig[] = [
    {
      policyId: 'RET-01',
      policyVersion: '1.0',
      jurisdictionProfileId: 'AO-STD',
      jurisdictionProfileVersion: '1.0',
      category: 'identification',
      clockTriggerType: 'uploaded_at',
      retentionDurationDays: 365,
      allowedHoldTypes: ['legal'],
      allowedDeletionAuthorityScopePatterns: ['institution_admin'],
    },
  ];
  const retentionEngine = new ConfigurableRetentionPolicyEngine(retentionConfigs);

  const rules: DocumentAuthorizationRule[] = [
    {
      role: 'institution_admin',
      actions: '*',
    },
  ];

  const authority = new DefaultDocumentAuthorizationAuthority({
    rules,
    delegates: {
      accessPolicyEngine: accessEngine,
      retentionPolicyEngine: retentionEngine,
    },
  });

  // 1. Available document content access: ALLOW
  const openAvailable = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'institution_admin',
    action: 'open_content',
    documentCategory: 'identification',
    documentStatus: 'active',
    versionStatus: 'available',
  });
  assert.equal(openAvailable.allowed, true);
  assert.equal(openAvailable.reasonCode, 'ALLOWED');

  // 2. Archived document: Delegate denies with LIFECYCLE_STATE_INVALID
  const openArchived = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'institution_admin',
    action: 'open_content',
    documentCategory: 'identification',
    documentStatus: 'archived',
    versionStatus: 'available',
  });
  assert.equal(openArchived.allowed, false);
  assert.equal(openArchived.reasonCode, 'LIFECYCLE_STATE_INVALID');

  // 3. Quarantined document: Delegate denies with LIFECYCLE_STATE_INVALID
  const downloadQuarantined = authority.authorize({
    institutionId: SAMPLE_INSTITUTION_ID,
    personId: SAMPLE_PERSON_ID,
    role: 'institution_admin',
    action: 'download_content',
    documentCategory: 'identification',
    documentStatus: 'active',
    versionStatus: 'quarantined',
  });
  assert.equal(downloadQuarantined.allowed, false);
  assert.equal(downloadQuarantined.reasonCode, 'LIFECYCLE_STATE_INVALID');

  // 4. Retention and deletion management operations: ALLOW for managers
  assert.equal(
    authority.authorize({
      institutionId: SAMPLE_INSTITUTION_ID,
      personId: SAMPLE_PERSON_ID,
      role: 'institution_admin',
      action: 'assign_retention',
    }).allowed,
    true,
  );
  assert.equal(
    authority.authorize({
      institutionId: SAMPLE_INSTITUTION_ID,
      personId: SAMPLE_PERSON_ID,
      role: 'institution_admin',
      action: 'place_hold',
    }).allowed,
    true,
  );
  assert.equal(
    authority.authorize({
      institutionId: SAMPLE_INSTITUTION_ID,
      personId: SAMPLE_PERSON_ID,
      role: 'institution_admin',
      action: 'release_hold',
    }).allowed,
    true,
  );
  assert.equal(
    authority.authorize({
      institutionId: SAMPLE_INSTITUTION_ID,
      personId: SAMPLE_PERSON_ID,
      role: 'institution_admin',
      action: 'authorize_deletion',
    }).allowed,
    true,
  );
});

test('CANONICAL_TEACHER_DENY: Role teacher with relationshipContext teacher_assigned fails closed under default-deny', () => {
  const authority = new DefaultDocumentAuthorizationAuthority({
    rules: createDefaultDocumentAuthorizationRules(),
  });

  const actionsToTest = ['list_metadata', 'view_metadata', 'view_versions'] as const;

  for (const action of actionsToTest) {
    const decision = authority.authorize({
      institutionId: SAMPLE_INSTITUTION_ID,
      personId: SAMPLE_PERSON_ID,
      role: 'teacher',
      action,
      documentCategory: 'academic_transcript',
      relationshipContext: 'teacher_assigned',
    });

    assert.equal(decision.allowed, false, `teacher must be denied for ${action} even with teacher_assigned relationship`);
    assert.equal(decision.reasonCode, 'ROLE_NOT_AUTHORIZED', `reasonCode must be ROLE_NOT_AUTHORIZED for ${action}`);
  }

  // Verify that no teacher Documents action becomes implicitly allowed through wildcard behavior
  for (const action of CANONICAL_DOCUMENT_ACTIONS) {
    const decision = authority.authorize({
      institutionId: SAMPLE_INSTITUTION_ID,
      personId: SAMPLE_PERSON_ID,
      role: 'teacher',
      action,
      documentCategory: 'academic_transcript',
      relationshipContext: 'teacher_assigned',
    });
    assert.equal(decision.allowed, false, `teacher must not be allowed action ${action}`);
  }
});

