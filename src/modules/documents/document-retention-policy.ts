/**
 * Documents Foundation I6 — Configurable Retention Policy Engine
 * Mission: DOCUMENTS-FOUNDATION-I6
 *
 * PRODUCTION_AUTOMATED_RETENTION=BLOCKED
 * No legal periods, jurisdiction defaults, or authorization role defaults exist here.
 * All policies are injected from explicit governed configuration or SYNTHETIC_TEST_FIXTURE.
 *
 * Policy hierarchy (per Master Spec):
 *   Global Platform Policy → Jurisdiction Profile → Institutional Policy → Category/Process Rule
 *
 * Missing or invalid policy → FAIL_CLOSED (no invented defaults).
 */

export interface RetentionPolicyConfig {
  policyId: string;
  policyVersion: string;
  jurisdictionProfileId: string;
  jurisdictionProfileVersion: string;
  category: string;
  /** Clock trigger type from governed config — never assumed to be 'uploaded_at' */
  clockTriggerType: string;
  /** Retention duration in whole days — sourced from approved jurisdiction profile */
  retentionDurationDays: number;
  /** Which hold types this policy permits to be placed */
  allowedHoldTypes: Array<'legal' | 'administrative'>;
  /** Which authority scopes may authorize deletion under this policy */
  allowedDeletionAuthorityScopePatterns: string[];
}

export interface RetentionPolicyLookupParams {
  institutionId: string;
  category: string;
  jurisdictionProfileId: string;
  policyId?: string;
}

export interface RetentionPolicyEngine {
  /**
   * Resolve the applicable policy for a given context.
   * Returns null if no matching policy exists — caller MUST fail closed on null.
   */
  resolvePolicy(params: RetentionPolicyLookupParams): RetentionPolicyConfig | null;

  /**
   * Calculate retain_until from clock trigger event.
   * Never uses uploaded_at as a default.
   */
  calculateRetainUntil(policy: RetentionPolicyConfig, clockTriggerEventAt: Date): Date;

  /**
   * Check if a given authority scope is permitted to authorize deletion under this policy.
   */
  isDeletionAuthorized(policy: RetentionPolicyConfig, actorAuthorityScope: string): boolean;

  /**
   * Check if a given authority scope is permitted to place a hold under this policy.
   */
  isHoldAuthorized(policy: RetentionPolicyConfig, holdType: 'legal' | 'administrative', actorAuthorityScope: string): boolean;
}

/**
 * ConfigurableRetentionPolicyEngine — accepts an explicit list of synthetic/governed policy configs.
 * Used in tests with SYNTHETIC_TEST_FIXTURE values.
 * Production requires approved jurisdiction profiles; no fallbacks exist.
 */
export class ConfigurableRetentionPolicyEngine implements RetentionPolicyEngine {
  constructor(private readonly policies: RetentionPolicyConfig[]) {}

  resolvePolicy(params: RetentionPolicyLookupParams): RetentionPolicyConfig | null {
    const match = this.policies.find(
      (p) =>
        p.category === params.category &&
        p.jurisdictionProfileId === params.jurisdictionProfileId &&
        (params.policyId == null || p.policyId === params.policyId),
    );
    return match ?? null;
  }

  calculateRetainUntil(policy: RetentionPolicyConfig, clockTriggerEventAt: Date): Date {
    const result = new Date(clockTriggerEventAt);
    result.setDate(result.getDate() + policy.retentionDurationDays);
    return result;
  }

  isDeletionAuthorized(policy: RetentionPolicyConfig, actorAuthorityScope: string): boolean {
    return policy.allowedDeletionAuthorityScopePatterns.some(
      (pattern) => actorAuthorityScope === pattern || actorAuthorityScope.startsWith(pattern),
    );
  }

  isHoldAuthorized(
    policy: RetentionPolicyConfig,
    holdType: 'legal' | 'administrative',
    actorAuthorityScope: string,
  ): boolean {
    if (!policy.allowedHoldTypes.includes(holdType)) return false;
    // All authorized scopes may place holds — authority is further validated by the policy's
    // allowedDeletionAuthorityScopePatterns; for holds the same scopes are permitted.
    return policy.allowedDeletionAuthorityScopePatterns.some(
      (pattern) => actorAuthorityScope === pattern || actorAuthorityScope.startsWith(pattern),
    );
  }
}
