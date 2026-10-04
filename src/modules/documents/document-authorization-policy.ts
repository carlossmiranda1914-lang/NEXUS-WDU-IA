/**
 * Central Functional Authorization Authority for Documents Module
 * Checkpoint: H1-01 — Central Authorization Authority
 *
 * Implements canonical, server-side, fail-closed, tenant-aware,
 * role-aware, category-aware, and relationship-aware authorization.
 *
 * Answering: CAN actor perform ACTION on RESOURCE under CONTEXT?
 */

import type { InstitutionalRole } from '../../auth/institutional-context.ts';
import type {
  DocumentStatus,
  DocumentVersionStatus,
  StorageContentAvailability,
} from './document-model.ts';
import type { DocumentAccessPolicyEngine } from './document-access-policy.ts';
import type { RetentionPolicyEngine } from './document-retention-policy.ts';

// ─── 1. Canonical Actions ──────────────────────────────────────────────────

export const CANONICAL_DOCUMENT_ACTIONS = [
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
] as const;

export type DocumentAction = (typeof CANONICAL_DOCUMENT_ACTIONS)[number];

export function isCanonicalDocumentAction(value: unknown): value is DocumentAction {
  return typeof value === 'string' && CANONICAL_DOCUMENT_ACTIONS.includes(value as DocumentAction);
}

// ─── 2. Canonical Reason Codes ─────────────────────────────────────────────

export const CANONICAL_AUTHORIZATION_REASON_CODES = [
  'ALLOWED',
  'ROLE_NOT_AUTHORIZED',
  'RELATIONSHIP_REQUIRED',
  'CATEGORY_NOT_AUTHORIZED',
  'ACTION_NOT_AUTHORIZED',
  'RESOURCE_CONTEXT_MISSING',
  'TENANT_CONTEXT_INVALID',
  'POLICY_NOT_CONFIGURED',
  'LIFECYCLE_STATE_INVALID',
  'DELEGATED_POLICY_DENIED',
] as const;

export type AuthorizationReasonCode = (typeof CANONICAL_AUTHORIZATION_REASON_CODES)[number];

export interface AuthorizationDecision {
  allowed: boolean;
  reasonCode: AuthorizationReasonCode;
  action: DocumentAction;
  details?: Record<string, unknown>;
}

// ─── 3. Relationship Context Contract ──────────────────────────────────────

export const RELATIONSHIP_CONTEXT_KINDS = [
  'self',
  'guardian_of_subject',
  'teacher_assigned',
  'administrative_scope',
  'manager_scope',
  'system',
  'unrelated',
  'unknown',
] as const;

export type RelationshipContextKind = (typeof RELATIONSHIP_CONTEXT_KINDS)[number];

// ─── 4. Management Role Helper ─────────────────────────────────────────────

export const MANAGEMENT_ROLES = [
  'admin',
  'institution_admin',
  'director',
  'superadmin',
  'system',
] as const;

export type ManagementRole = (typeof MANAGEMENT_ROLES)[number];

export function isManagementRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (MANAGEMENT_ROLES as readonly string[]).includes(role);
}

// ─── 5. Canonical Authorization Context ────────────────────────────────────

export interface AuthorizationContext {
  institutionId: string;
  personId: string;
  role: InstitutionalRole | string;
  action: DocumentAction;
  membershipId?: string;
  documentCategory?: string;
  documentId?: string;
  versionId?: string;
  resourceOwnerPersonId?: string;
  targetDomain?: string;
  targetResourceType?: string;
  targetResourceId?: string;
  relationshipContext?: RelationshipContextKind;
  // Lifecycle flags if available for delegated checks:
  documentStatus?: DocumentStatus;
  versionStatus?: DocumentVersionStatus;
  contentAvailability?: StorageContentAvailability;
}

// ─── 6. Policy Rules Model ─────────────────────────────────────────────────

export interface DocumentAuthorizationRule {
  role?: InstitutionalRole | string | readonly (InstitutionalRole | string)[] | '*';
  actions: readonly DocumentAction[] | '*';
  categories?: readonly string[] | '*';
  requiredRelationships?: readonly RelationshipContextKind[];
  effect?: 'allow' | 'deny'; // default 'allow'. Deny rules take precedence!
}

export interface DocumentAuthorizationAuthorityConfig {
  rules: readonly DocumentAuthorizationRule[];
  delegates?: {
    accessPolicyEngine?: DocumentAccessPolicyEngine;
    retentionPolicyEngine?: RetentionPolicyEngine;
  };
}

// ─── 7. Central Authority Interface & Implementation ───────────────────────

export interface DocumentAuthorizationAuthority {
  authorize(context: AuthorizationContext): AuthorizationDecision;
  getAllowedCategories(actor: {
    institutionId: string;
    personId: string;
    role: string;
    action: DocumentAction;
    relationshipContext?: RelationshipContextKind;
  }): string[] | '*';
}

export function createDefaultDocumentAuthorizationRules(): DocumentAuthorizationRule[] {
  return [
    // 1. Canonical Management roles: explicit access for administrative, lifecycle and governance operations
    {
      role: MANAGEMENT_ROLES,
      actions: [
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
      ],
      categories: '*',
      effect: 'allow',
    },
    // 2. Non-management roles: require explicit verified relationship context (fail-closed when unknown/unresolved)
    {
      role: 'student',
      actions: ['list_metadata', 'view_metadata', 'view_versions'],
      categories: ['identification', 'academic_transcript', 'student_record', 'general'],
      requiredRelationships: ['self'],
      effect: 'allow',
    },
    {
      role: 'parent',
      actions: ['list_metadata', 'view_metadata', 'view_versions'],
      categories: ['academic_transcript', 'student_record'],
      requiredRelationships: ['guardian_of_subject'],
      effect: 'allow',
    },
  ];
}

export class DefaultDocumentAuthorizationAuthority implements DocumentAuthorizationAuthority {
  private readonly rules: readonly DocumentAuthorizationRule[];
  private readonly accessPolicyEngine?: DocumentAccessPolicyEngine;
  private readonly retentionPolicyEngine?: RetentionPolicyEngine;

  constructor(config: DocumentAuthorizationAuthorityConfig) {
    this.rules = config.rules;
    this.accessPolicyEngine = config.delegates?.accessPolicyEngine;
    this.retentionPolicyEngine = config.delegates?.retentionPolicyEngine;
  }

  public getAllowedCategories(actor: {
    institutionId: string;
    personId: string;
    role: string;
    action: DocumentAction;
    relationshipContext?: RelationshipContextKind;
  }): string[] | '*' {
    if (!actor.role || !actor.action || !actor.institutionId || !actor.personId) {
      return [];
    }

    const roleMatches = (ruleRole: DocumentAuthorizationRule['role'], userRole: string): boolean => {
      if (!ruleRole || ruleRole === '*') return true;
      if (Array.isArray(ruleRole)) return ruleRole.includes(userRole);
      return ruleRole === userRole;
    };

    const actionMatches = (ruleActions: DocumentAuthorizationRule['actions'], userAction: DocumentAction): boolean => {
      if (ruleActions === '*') return true;
      return ruleActions.includes(userAction);
    };

    // Filter matching ALLOW rules
    const matchingRules = this.rules.filter((r) => {
      if (r.effect === 'deny') return false;
      return roleMatches(r.role, actor.role) && actionMatches(r.actions, actor.action);
    });

    if (matchingRules.length === 0) {
      return [];
    }

    // Filter rules by relationship requirement if specified
    const validRules = matchingRules.filter((r) => {
      if (!r.requiredRelationships || r.requiredRelationships.length === 0) {
        return true;
      }
      const rel = actor.relationshipContext;
      if (!rel || rel === 'unknown' || rel === 'unrelated') {
        return false;
      }
      return r.requiredRelationships.includes(rel);
    });

    if (validRules.length === 0) {
      return [];
    }

    // If any valid rule grants all categories (*), return '*'
    if (validRules.some((r) => !r.categories || r.categories === '*')) {
      return '*';
    }

    // Collect specific allowed categories
    const categories = new Set<string>();
    for (const r of validRules) {
      if (Array.isArray(r.categories)) {
        for (const cat of r.categories) {
          categories.add(cat);
        }
      }
    }

    return Array.from(categories);
  }

  public authorize(context: AuthorizationContext): AuthorizationDecision {
    const { action } = context;

    // A. Validate canonical action
    if (!action || !isCanonicalDocumentAction(action)) {
      return {
        allowed: false,
        reasonCode: 'ACTION_NOT_AUTHORIZED',
        action: action as DocumentAction,
      };
    }

    // B. Tenant and Identity Safety validation
    if (!context.institutionId || typeof context.institutionId !== 'string' || !context.institutionId.trim()) {
      return {
        allowed: false,
        reasonCode: 'TENANT_CONTEXT_INVALID',
        action,
      };
    }

    if (!context.personId || typeof context.personId !== 'string' || !context.personId.trim()) {
      return {
        allowed: false,
        reasonCode: 'RESOURCE_CONTEXT_MISSING',
        action,
      };
    }

    if (!context.role || typeof context.role !== 'string' || !context.role.trim()) {
      return {
        allowed: false,
        reasonCode: 'ROLE_NOT_AUTHORIZED',
        action,
      };
    }

    // C. Policy configuration check
    if (!this.rules || this.rules.length === 0) {
      return {
        allowed: false,
        reasonCode: 'POLICY_NOT_CONFIGURED',
        action,
      };
    }

    // D. Helper to check if role matches rule
    const roleMatches = (ruleRole: DocumentAuthorizationRule['role'], userRole: string): boolean => {
      if (!ruleRole || ruleRole === '*') return true;
      if (Array.isArray(ruleRole)) return ruleRole.includes(userRole);
      return ruleRole === userRole;
    };

    // E. Helper to check if action matches rule
    const actionMatches = (ruleActions: DocumentAuthorizationRule['actions'], userAction: DocumentAction): boolean => {
      if (ruleActions === '*') return true;
      return ruleActions.includes(userAction);
    };

    // F. Helper to check if category matches rule
    const categoryMatches = (ruleCategories: DocumentAuthorizationRule['categories'], userCategory?: string): boolean => {
      if (!ruleCategories || ruleCategories === '*') return true;
      if (!userCategory) return false;
      return ruleCategories.includes(userCategory);
    };

    // G. Check for any explicit DENY rule matching first (precedence)
    const matchingDenyRule = this.rules.find((r) => {
      if (r.effect !== 'deny') return false;
      return roleMatches(r.role, context.role) &&
             actionMatches(r.actions, action) &&
             categoryMatches(r.categories, context.documentCategory);
    });

    if (matchingDenyRule) {
      return {
        allowed: false,
        reasonCode: 'ACTION_NOT_AUTHORIZED',
        action,
      };
    }

    // H. Find matching ALLOW rules
    const matchingAllowRules = this.rules.filter((r) => {
      if (r.effect === 'deny') return false;
      return roleMatches(r.role, context.role) &&
             actionMatches(r.actions, action);
    });

    if (matchingAllowRules.length === 0) {
      // Check if role has any rules at all to provide more specific reason
      const roleHasAnyRule = this.rules.some((r) => roleMatches(r.role, context.role));
      return {
        allowed: false,
        reasonCode: roleHasAnyRule ? 'ACTION_NOT_AUTHORIZED' : 'ROLE_NOT_AUTHORIZED',
        action,
      };
    }

    // I. Evaluate category matching among allow rules
    const categoryMatchedRules = matchingAllowRules.filter((r) =>
      categoryMatches(r.categories, context.documentCategory)
    );

    if (categoryMatchedRules.length === 0) {
      return {
        allowed: false,
        reasonCode: 'CATEGORY_NOT_AUTHORIZED',
        action,
      };
    }

    // J. Evaluate relationship requirement
    // If a rule specifies requiredRelationships, the context must have a non-unknown matching relationship.
    const relationshipSatisfiedRule = categoryMatchedRules.find((r) => {
      if (!r.requiredRelationships || r.requiredRelationships.length === 0) {
        return true; // No relationship restriction
      }

      const rel = context.relationshipContext;
      if (!rel || rel === 'unknown' || rel === 'unrelated') {
        return false;
      }

      return r.requiredRelationships.includes(rel);
    });

    if (!relationshipSatisfiedRule) {
      return {
        allowed: false,
        reasonCode: 'RELATIONSHIP_REQUIRED',
        action,
      };
    }

    // K. Delegation to existing specialized engines if configured and applicable
    // 1. Content Access Policy Engine delegation for open_content and download_content
    if ((action === 'open_content' || action === 'download_content') && this.accessPolicyEngine) {
      const accessAction = action === 'open_content' ? 'open_content' : 'download_content';
      const evalResult = this.accessPolicyEngine.evaluateAccess({
        institutionId: context.institutionId,
        personId: context.personId,
        role: context.role,
        documentCategory: context.documentCategory || 'general',
        action: accessAction,
        documentStatus: context.documentStatus,
        versionStatus: context.versionStatus,
      });

      if (!evalResult.allowed) {
        const isLifecycle =
          evalResult.reason?.includes('DOCUMENT_ARCHIVED') ||
          evalResult.reason?.includes('NOT_AVAILABLE_FOR_ACCESS') ||
          evalResult.reason?.includes('ACCESS_DENIED_QUARANTINED');

        return {
          allowed: false,
          reasonCode: isLifecycle ? 'LIFECYCLE_STATE_INVALID' : 'DELEGATED_POLICY_DENIED',
          action,
          details: { delegateReason: evalResult.reason },
        };
      }
    }

    // 2. Retention Policy Engine delegation if applicable
    if (
      (action === 'assign_retention' ||
       action === 'place_hold' ||
       action === 'release_hold' ||
       action === 'authorize_deletion') &&
      this.retentionPolicyEngine
    ) {
      if (!isManagementRole(context.role)) {
        return {
          allowed: false,
          reasonCode: 'ROLE_NOT_AUTHORIZED',
          action,
        };
      }
    }

    // L. Decision: ALLOW
    return {
      allowed: true,
      reasonCode: 'ALLOWED',
      action,
    };
  }
}
