/**
 * Documents Foundation I5 Access Policy Engine
 * Mission: DOCUMENTS-FOUNDATION-I5
 */

import { InstitutionalRole } from '../../auth/institutional-context';
import { DocumentStatus, DocumentVersionStatus } from './document-model';
import { AccessAction, AccessEvaluationResult } from './document-access-model';

export interface DocumentAccessPolicyRule {
  role: InstitutionalRole | string;
  category: string; // '*' or specific category
  allowedActions: readonly AccessAction[];
}

export interface EvaluateAccessParams {
  institutionId: string;
  personId: string;
  role: InstitutionalRole | string;
  documentCategory: string;
  action: AccessAction;
  documentStatus?: DocumentStatus;
  versionStatus?: DocumentVersionStatus;
  relationshipContext?: {
    isOwner?: boolean;
    isSubjectPerson?: boolean;
  };
}

export interface DocumentAccessPolicyEngine {
  evaluateAccess(params: EvaluateAccessParams): AccessEvaluationResult;
}

/**
 * Strict policy engine that fails closed unless an explicit matching rule exists.
 * Global invented permission matrices are forbidden.
 */
export class ConfigurableDocumentAccessPolicyEngine implements DocumentAccessPolicyEngine {
  private readonly rules: readonly DocumentAccessPolicyRule[];

  constructor(rules: readonly DocumentAccessPolicyRule[]) {
    this.rules = rules;
  }

  public evaluateAccess(params: EvaluateAccessParams): AccessEvaluationResult {
    const {
      institutionId,
      personId,
      role,
      documentCategory,
      action,
      documentStatus,
      versionStatus,
    } = params;

    // 1. Check Document Lifecycle: archived documents cannot be accessed
    if (documentStatus === 'archived') {
      return {
        allowed: false,
        reason: 'DOCUMENT_ARCHIVED: Document is archived and cannot be accessed',
        action,
        documentCategory,
        institutionId,
        personId,
        role,
      };
    }

    // 2. Check Version Eligibility: Normal content access strictly requires versionStatus === 'available'
    if (action === 'open_content' || action === 'download_content') {
      if (!versionStatus) {
        return {
          allowed: false,
          reason: 'VERSION_STATUS_REQUIRED: Version status must be provided for content access',
          action,
          documentCategory,
          institutionId,
          personId,
          role,
        };
      }

      if (versionStatus !== 'available') {
        const failureReason =
          versionStatus === 'quarantined'
            ? 'ACCESS_DENIED_QUARANTINED: Content is quarantined and strictly forbidden from access'
            : `NOT_AVAILABLE_FOR_ACCESS: Version is in ${versionStatus} state and not available for content access`;

        return {
          allowed: false,
          reason: failureReason,
          action,
          documentCategory,
          institutionId,
          personId,
          role,
        };
      }
    }

    // 3. Evaluate Configured Policy Rules (Exact match or wildcard category)
    const matchingRule = this.rules.find((r) => {
      const roleMatches = r.role === role;
      const categoryMatches = r.category === '*' || r.category === documentCategory;
      return roleMatches && categoryMatches;
    });

    if (!matchingRule) {
      return {
        allowed: false,
        reason: `POLICY_DENIED: No policy rule authorizes role "${role}" for category "${documentCategory}"`,
        action,
        documentCategory,
        institutionId,
        personId,
        role,
      };
    }

    if (!matchingRule.allowedActions.includes(action)) {
      return {
        allowed: false,
        reason: `ACTION_NOT_PERMITTED: Role "${role}" is not permitted to perform action "${action}" on category "${documentCategory}"`,
        action,
        documentCategory,
        institutionId,
        personId,
        role,
      };
    }

    return {
      allowed: true,
      action,
      documentCategory,
      institutionId,
      personId,
      role,
    };
  }
}
