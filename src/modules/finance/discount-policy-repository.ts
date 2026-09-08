import pg from 'pg';
import { ExactDecimal } from './exact-decimal.ts';
import {
  DiscountPolicy,
  DiscountPolicyVersion,
  DiscountPolicySummary,
  CreateDiscountPolicyInput,
  CreateDiscountPolicyVersionInput,
  validateDiscountPolicyInputs,
} from './discount-policy-model.ts';
import { AuthenticatedActor } from './financial-context.ts';

export interface DiscountPolicyRepository {
  createDiscountPolicy(
    actor: AuthenticatedActor,
    input: CreateDiscountPolicyInput
  ): Promise<DiscountPolicy & { version: DiscountPolicyVersion }>;

  createDiscountPolicyVersion(
    actor: AuthenticatedActor,
    policyId: string,
    input: CreateDiscountPolicyVersionInput
  ): Promise<DiscountPolicyVersion>;

  archiveDiscountPolicy(
    actor: AuthenticatedActor,
    policyId: string
  ): Promise<DiscountPolicy>;

  resolveApplicablePolicyVersion(
    institutionId: string,
    policyId: string,
    applicationInstant: Date
  ): Promise<DiscountPolicyVersion | null>;

  getDiscountPolicyById(
    institutionId: string,
    policyId: string
  ): Promise<DiscountPolicy | null>;

  listDiscountPolicies(
    institutionId: string,
    applicationInstant?: Date
  ): Promise<readonly DiscountPolicySummary[]>;
}

export class PostgresDiscountPolicyRepository implements DiscountPolicyRepository {
  constructor(private readonly pool: pg.Pool) {}

  async createDiscountPolicy(
    actor: AuthenticatedActor,
    input: CreateDiscountPolicyInput
  ): Promise<DiscountPolicy & { version: DiscountPolicyVersion }> {
    const code = input.code.trim().toUpperCase();
    if (!code || code.length > 64) {
      throw new Error('Discount policy code must be between 1 and 64 characters');
    }
    const name = input.name.trim();
    if (!name || name.length > 255) {
      throw new Error('Discount policy name must be between 1 and 255 characters');
    }

    const effFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : null;
    const effTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
    if (effFrom && effTo && effFrom > effTo) {
      throw new Error('effectiveFrom cannot be after effectiveTo');
    }

    const validated = validateDiscountPolicyInputs(
      input.calculationMode,
      input.value,
      input.currency,
      effFrom,
      effTo
    );

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const policyRes = await client.query(
        `INSERT INTO finance_discount_policies (institution_id, code, status)
         VALUES ($1, $2, 'active')
         RETURNING id, institution_id, code, status, created_at, updated_at`,
        [actor.institutionId, code]
      );
      const policyRow = policyRes.rows[0];

      const versionRes = await client.query(
        `INSERT INTO finance_discount_policy_versions (
           institution_id, policy_id, version, name, description, calculation_mode, value, currency, effective_from, effective_to, actor_person_id
         ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, institution_id, policy_id, version, name, description, calculation_mode, value, currency, effective_from, effective_to, created_at, actor_person_id`,
        [
          actor.institutionId,
          policyRow.id,
          name,
          input.description?.trim() || null,
          input.calculationMode,
          validated.value,
          validated.currency,
          effFrom,
          effTo,
          actor.personId || null,
        ]
      );
      const versionRow = versionRes.rows[0];

      await client.query('COMMIT');

      return {
        ...this.mapPolicyRow(policyRow),
        version: this.mapVersionRow(versionRow),
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async createDiscountPolicyVersion(
    actor: AuthenticatedActor,
    policyId: string,
    input: CreateDiscountPolicyVersionInput
  ): Promise<DiscountPolicyVersion> {
    const name = input.name.trim();
    if (!name || name.length > 255) {
      throw new Error('Discount policy name must be between 1 and 255 characters');
    }

    const effFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : null;
    const effTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
    if (effFrom && effTo && effFrom > effTo) {
      throw new Error('effectiveFrom cannot be after effectiveTo');
    }

    const validated = validateDiscountPolicyInputs(
      input.calculationMode,
      input.value,
      input.currency,
      effFrom,
      effTo
    );

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Lock policy identity row FOR UPDATE to serialize concurrent version creations
      const policyRes = await client.query(
        `SELECT id, status FROM finance_discount_policies
         WHERE institution_id = $1 AND id = $2
         FOR UPDATE`,
        [actor.institutionId, policyId]
      );
      if (policyRes.rows.length === 0) {
        throw new Error('Discount policy not found');
      }
      if (policyRes.rows[0].status === 'archived') {
        throw new Error('Cannot create version on an archived discount policy');
      }

      // 2. Check for overlapping effective interval with existing versions
      // Overlap condition between [A_start, A_end] and [B_start, B_end]:
      // (A_start IS NULL OR B_end IS NULL OR A_start <= B_end) AND (A_end IS NULL OR B_start IS NULL OR A_end >= B_start)
      const overlapRes = await client.query(
        `SELECT id, version, effective_from, effective_to
         FROM finance_discount_policy_versions
         WHERE institution_id = $1 AND policy_id = $2
           AND ($3::timestamptz IS NULL OR effective_to IS NULL OR $3::timestamptz <= effective_to)
           AND ($4::timestamptz IS NULL OR effective_from IS NULL OR $4::timestamptz >= effective_from)`,
        [actor.institutionId, policyId, effFrom, effTo]
      );

      if (overlapRes.rows.length > 0) {
        throw new Error(
          `DISCOUNT_POLICY_OVERLAPPING_INTERVAL: Proposed version effective interval overlaps with existing version ${overlapRes.rows[0].version}`
        );
      }

      // 3. Compute next version number
      const maxVerRes = await client.query(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_ver
         FROM finance_discount_policy_versions
         WHERE institution_id = $1 AND policy_id = $2`,
        [actor.institutionId, policyId]
      );
      const nextVersion = Number(maxVerRes.rows[0].next_ver);

      // 4. Insert immutable version
      const versionRes = await client.query(
        `INSERT INTO finance_discount_policy_versions (
           institution_id, policy_id, version, name, description, calculation_mode, value, currency, effective_from, effective_to, actor_person_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, institution_id, policy_id, version, name, description, calculation_mode, value, currency, effective_from, effective_to, created_at, actor_person_id`,
        [
          actor.institutionId,
          policyId,
          nextVersion,
          name,
          input.description?.trim() || null,
          input.calculationMode,
          validated.value,
          validated.currency,
          effFrom,
          effTo,
          actor.personId || null,
        ]
      );

      await client.query(
        `UPDATE finance_discount_policies SET updated_at = clock_timestamp() WHERE institution_id = $1 AND id = $2`,
        [actor.institutionId, policyId]
      );

      await client.query('COMMIT');
      return this.mapVersionRow(versionRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async archiveDiscountPolicy(
    actor: AuthenticatedActor,
    policyId: string
  ): Promise<DiscountPolicy> {
    const res = await this.pool.query(
      `UPDATE finance_discount_policies
       SET status = 'archived', updated_at = clock_timestamp()
       WHERE institution_id = $1 AND id = $2
       RETURNING id, institution_id, code, status, created_at, updated_at`,
      [actor.institutionId, policyId]
    );
    if (res.rows.length === 0) {
      throw new Error('Discount policy not found');
    }
    return this.mapPolicyRow(res.rows[0]);
  }

  async resolveApplicablePolicyVersion(
    institutionId: string,
    policyId: string,
    applicationInstant: Date
  ): Promise<DiscountPolicyVersion | null> {
    const res = await this.pool.query(
      `SELECT v.id, v.institution_id, v.policy_id, v.version, v.name, v.description, v.calculation_mode,
              v.value, v.currency, v.effective_from, v.effective_to, v.created_at, v.actor_person_id
       FROM finance_discount_policy_versions v
       JOIN finance_discount_policies p ON p.id = v.policy_id AND p.institution_id = v.institution_id
       WHERE v.institution_id = $1 AND v.policy_id = $2
         AND p.status = 'active'
         AND (v.effective_from IS NULL OR v.effective_from <= $3)
         AND (v.effective_to IS NULL OR v.effective_to >= $3)
       ORDER BY v.version DESC`,
      [institutionId, policyId, applicationInstant]
    );

    if (res.rows.length === 0) {
      return null;
    }
    if (res.rows.length > 1) {
      throw new Error(
        `DISCOUNT_POLICY_VERSION_AMBIGUITY: Multiple active versions found for policy ${policyId} at instant ${applicationInstant.toISOString()}`
      );
    }
    return this.mapVersionRow(res.rows[0]);
  }

  async getDiscountPolicyById(
    institutionId: string,
    policyId: string
  ): Promise<DiscountPolicy | null> {
    const res = await this.pool.query(
      `SELECT id, institution_id, code, status, created_at, updated_at
       FROM finance_discount_policies
       WHERE institution_id = $1 AND id = $2`,
      [institutionId, policyId]
    );
    return res.rows.length > 0 ? this.mapPolicyRow(res.rows[0]) : null;
  }

  async listDiscountPolicies(
    institutionId: string,
    applicationInstant: Date = new Date()
  ): Promise<readonly DiscountPolicySummary[]> {
    const policiesRes = await this.pool.query(
      `SELECT id, institution_id, code, status, created_at, updated_at
       FROM finance_discount_policies
       WHERE institution_id = $1
       ORDER BY code ASC`,
      [institutionId]
    );

    const summaries: DiscountPolicySummary[] = [];
    for (const pRow of policiesRes.rows) {
      const policy = this.mapPolicyRow(pRow);

      const latestVerRes = await this.pool.query(
        `SELECT id, institution_id, policy_id, version, name, description, calculation_mode,
                value, currency, effective_from, effective_to, created_at, actor_person_id
         FROM finance_discount_policy_versions
         WHERE institution_id = $1 AND policy_id = $2
         ORDER BY version DESC
         LIMIT 1`,
        [institutionId, policy.id]
      );
      if (latestVerRes.rows.length === 0) continue;
      const latestVersion = this.mapVersionRow(latestVerRes.rows[0]);

      let currentApplicableVersion: DiscountPolicyVersion | null = null;
      if (policy.status === 'active') {
        currentApplicableVersion = await this.resolveApplicablePolicyVersion(
          institutionId,
          policy.id,
          applicationInstant
        );
      }

      summaries.push({
        ...policy,
        latestVersion,
        currentApplicableVersion,
      });
    }

    return summaries;
  }

  private mapPolicyRow(row: any): DiscountPolicy {
    return {
      id: row.id,
      institutionId: row.institution_id,
      code: row.code,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapVersionRow(row: any): DiscountPolicyVersion {
    const rawVal = row.value.toString();
    const canonVal = ExactDecimal.parse(rawVal, 30, 12).toCanonicalString();
    return {
      id: row.id,
      institutionId: row.institution_id,
      policyId: row.policy_id,
      version: Number(row.version),
      name: row.name,
      description: row.description,
      calculationMode: row.calculation_mode,
      value: canonVal,
      currency: row.currency,
      effectiveFrom: row.effective_from ? new Date(row.effective_from) : null,
      effectiveTo: row.effective_to ? new Date(row.effective_to) : null,
      createdAt: new Date(row.created_at),
      actorPersonId: row.actor_person_id,
    };
  }
}
