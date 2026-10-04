/**
 * Canonical Relationship Authority Adapter for Documents Module
 * Checkpoint: H1-02B — Canonical Relationship Authority Adapter
 *
 * Resolves:
 *   actor (InstitutionalContext) + targetStudentPersonId
 *         ↓
 *   DocumentRelationshipResolution (relationshipContext: 'self' | 'guardian_of_subject' | 'unrelated' | 'unknown')
 *
 * Invariants:
 * - Strictly reuses canonical resolveAuthorizedStudents(executor, context) from src/auth/authorized-students.ts.
 * - No duplicated SQL queries for student profiles or guardian relationships.
 * - Derived exclusively from server-side InstitutionalContext (tenant safe).
 * - Teacher role fail-closed: always 'unrelated' (TeacherAssignment does NOT grant document access under STUDENT-360-01).
 * - Client parameters cannot dictate relationshipContext, teacherAssigned, or institutionId.
 */

import type { InstitutionalContext, QueryExecutor } from '../../auth/institutional-context.ts';
import { resolveAuthorizedStudents } from '../../auth/authorized-students.ts';
import type { RelationshipContextKind } from './document-authorization-policy.ts';

export type DocumentRelationshipContextKind = Extract<
  RelationshipContextKind,
  'self' | 'guardian_of_subject' | 'unrelated' | 'unknown'
>;

export interface DocumentRelationshipResolution {
  relationshipContext: DocumentRelationshipContextKind;
  subjectPersonId?: string;
  evidence?: {
    resolvedCount: number;
  };
}

export interface DocumentRelationshipAdapter {
  resolveRelationship(
    context: InstitutionalContext,
    targetStudentPersonId?: string | null,
  ): Promise<DocumentRelationshipResolution>;
}

/**
 * Resolves the server-side relationship between an authenticated actor and an optional target student person ID.
 *
 * Rules:
 * - 'student': returns 'self' if target matches an active student profile personId; otherwise 'unrelated'.
 * - 'parent': returns 'guardian_of_subject' if target matches an active guardian relationship; otherwise 'unrelated'.
 * - 'teacher': fail-closed returns 'unrelated' (TeacherAssignment does NOT grant document access).
 * - other roles (management/system): returns 'unknown' since relationship semantics do not apply.
 *
 * Tenant Safety:
 * - Derives institutionId strictly from context.institutionId.
 * - Cross-tenant targets fail-closed as 'unrelated'.
 */
export async function resolveDocumentRelationshipContext(
  executor: QueryExecutor,
  context: InstitutionalContext,
  targetStudentPersonId?: string | null,
): Promise<DocumentRelationshipResolution> {
  const normalizedTargetId = targetStudentPersonId?.trim();

  // Tenant and identity fail-closed guard
  if (!context?.institutionId || !context?.personId) {
    return {
      relationshipContext: 'unrelated',
      subjectPersonId: normalizedTargetId || undefined,
    };
  }

  // If no target student person ID is supplied, relationship to a subject cannot be established
  if (!normalizedTargetId) {
    if (context.role === 'student' || context.role === 'parent' || context.role === 'teacher') {
      return {
        relationshipContext: 'unrelated',
      };
    }
    return {
      relationshipContext: 'unknown',
    };
  }

  // Teacher role is strictly fail-closed in H1-02B
  if (context.role === 'teacher') {
    return {
      relationshipContext: 'unrelated',
      subjectPersonId: normalizedTargetId,
    };
  }

  // Student and parent roles resolve via canonical resolveAuthorizedStudents
  if (context.role === 'student' || context.role === 'parent') {
    const authorizedStudents = await resolveAuthorizedStudents(executor, context);
    const isAuthorized = authorizedStudents.some(
      (student) => student.personId === normalizedTargetId,
    );

    if (isAuthorized) {
      return {
        relationshipContext: context.role === 'student' ? 'self' : 'guardian_of_subject',
        subjectPersonId: normalizedTargetId,
        evidence: {
          resolvedCount: authorizedStudents.length,
        },
      };
    }

    return {
      relationshipContext: 'unrelated',
      subjectPersonId: normalizedTargetId,
      evidence: {
        resolvedCount: authorizedStudents.length,
      },
    };
  }

  // Management or other roles: relationship semantics do not apply to target student; return 'unknown'
  return {
    relationshipContext: 'unknown',
    subjectPersonId: normalizedTargetId,
  };
}

export class DefaultDocumentRelationshipAdapter implements DocumentRelationshipAdapter {
  constructor(private readonly executor: QueryExecutor) {}

  async resolveRelationship(
    context: InstitutionalContext,
    targetStudentPersonId?: string | null,
  ): Promise<DocumentRelationshipResolution> {
    return resolveDocumentRelationshipContext(this.executor, context, targetStudentPersonId);
  }
}
