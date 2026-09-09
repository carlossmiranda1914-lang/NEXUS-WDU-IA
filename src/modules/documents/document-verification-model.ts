/**
 * Documents Foundation I4 Technical Verification Model
 * Mission: DOCUMENTS-FOUNDATION-I4
 */

export type TechnicalVerificationStatus =
  | 'pending'
  | 'under_verification'
  | 'available'
  | 'quarantined'
  | 'inconclusive'
  | 'failed';

export type TechnicalAssessmentType = 'integrity' | 'size' | 'real_type' | 'malware';

export type TechnicalAssessmentStatus = 'pending' | 'pass' | 'fail' | 'inconclusive' | 'error';

export interface DocumentTechnicalVerification {
  id: string;
  institutionId: string;
  documentId: string;
  versionId: string;
  status: TechnicalVerificationStatus;
  startedAt: Date;
  dueAt: Date;
  completedAt?: Date | null;
  attemptCount: number;
  lastAttemptAt: Date;
  nextRetryAt?: Date | null;
  quarantineReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentTechnicalAssessment {
  id: string;
  institutionId: string;
  documentId: string;
  versionId: string;
  verificationId: string;
  assessmentType: TechnicalAssessmentType;
  status: TechnicalAssessmentStatus;
  provider: string;
  attemptNumber: number;
  startedAt: Date;
  completedAt?: Date | null;
  facts: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
}

export interface TechnicalVerificationRetryPolicy {
  maxAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
}

export const MANDATORY_ASSESSMENT_TYPES: readonly TechnicalAssessmentType[] = [
  'integrity',
  'size',
  'real_type',
  'malware',
] as const;

export interface VerificationEvaluationResult {
  overallStatus: TechnicalVerificationStatus;
  isReadyForAvailability: boolean;
  quarantineReason?: string;
  failureReason?: string;
  allMandatoryPassed: boolean;
}

/**
 * Pure domain function evaluating the aggregated technical verification state.
 *
 * Rules:
 * 1. ANY 'fail' -> immediately QUARANTINED (fail-closed, malicious/fail dominates clean).
 * 2. ANY 'error' or 'inconclusive' (without failure) -> INCONCLUSIVE (version not available).
 * 3. ANY mandatory assessment missing or 'pending' -> UNDER_VERIFICATION (version not available).
 * 4. ALL mandatory assessments 'pass' -> AVAILABLE.
 */
export function evaluateVerificationOutcome(
  assessments: DocumentTechnicalAssessment[],
): VerificationEvaluationResult {
  // 1. FAIL/MALICIOUS dominates across all attempts: if ANY assessment ever failed, quarantined is terminal
  const failedAssessment = assessments.find((a) => a.status === 'fail');
  if (failedAssessment) {
    const reason =
      failedAssessment.errorMessage ||
      (failedAssessment.facts.reason as string) ||
      `Technical assessment ${failedAssessment.assessmentType} failed`;
    return {
      overallStatus: 'quarantined',
      isReadyForAvailability: false,
      allMandatoryPassed: false,
      quarantineReason: `Assessment ${failedAssessment.assessmentType} failed: ${reason}`,
    };
  }

  // Find latest assessment per type
  const latestByType = new Map<TechnicalAssessmentType, DocumentTechnicalAssessment>();
  for (const a of assessments) {
    const existing = latestByType.get(a.assessmentType);
    if (!existing || a.attemptNumber > existing.attemptNumber) {
      latestByType.set(a.assessmentType, a);
    }
  }

  // 2. Check for ANY 'error' or 'inconclusive'
  for (const [type, assessment] of latestByType.entries()) {
    if (assessment.status === 'error' || assessment.status === 'inconclusive') {
      const reason =
        assessment.errorMessage ||
        (assessment.facts.reason as string) ||
        `Assessment ${type} returned ${assessment.status}`;
      return {
        overallStatus: 'inconclusive',
        isReadyForAvailability: false,
        allMandatoryPassed: false,
        failureReason: reason,
      };
    }
  }

  // 3. Check that ALL mandatory assessments exist and passed
  const passedTypes = new Set<TechnicalAssessmentType>();
  for (const type of MANDATORY_ASSESSMENT_TYPES) {
    const a = latestByType.get(type);
    if (a && a.status === 'pass') {
      passedTypes.add(type);
    }
  }

  const allMandatoryPassed = MANDATORY_ASSESSMENT_TYPES.every((t) => passedTypes.has(t));

  if (allMandatoryPassed) {
    return {
      overallStatus: 'available',
      isReadyForAvailability: true,
      allMandatoryPassed: true,
    };
  }

  // Still pending / under verification
  return {
    overallStatus: 'under_verification',
    isReadyForAvailability: false,
    allMandatoryPassed: false,
  };
}

/**
 * Calculate next retry timestamp using exponential backoff within 24h due_at window.
 */
export function calculateNextRetry(
  attemptCount: number,
  policy: TechnicalVerificationRetryPolicy,
  startedAt: Date,
  dueAt: Date,
): Date | null {
  if (attemptCount >= policy.maxAttempts) {
    return null; // Max attempts reached
  }

  const backoffMs = Math.min(
    policy.baseBackoffMs * Math.pow(2, attemptCount - 1),
    policy.maxBackoffMs,
  );
  const candidateNext = new Date(Date.now() + backoffMs);

  if (candidateNext.getTime() > dueAt.getTime()) {
    return null; // Exceeds 24h window
  }

  return candidateNext;
}
