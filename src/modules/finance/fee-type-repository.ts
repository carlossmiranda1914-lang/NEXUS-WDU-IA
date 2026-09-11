import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { executeIdempotentFinanceCommand, createCanonicalFinanceFingerprint } from './finance-command.ts';
import {
  type FeeType,
  type FeeTypeStatus,
  type CreateFeeTypeInput,
  type UpdateFeeTypeInput,
  normalizeFeeTypeCreate,
  normalizeFeeTypeUpdate,
  NEXUS_BASELINE_FEE_TYPES,
} from './fee-type-model.ts';

export interface FeeTypeActor {
  institutionId: string;
  personId: string;
  role: string;
}

export class FeeTypeNotFoundError extends Error {
  readonly code = 'FEE_TYPE_NOT_FOUND';
  constructor(message = 'Tipo de emolumento não encontrado') {
    super(message);
    this.name = 'FeeTypeNotFoundError';
    Object.setPrototypeOf(this, FeeTypeNotFoundError.prototype);
  }
}

export class FeeTypeConflictError extends Error {
  readonly code = 'FEE_TYPE_CONFLICT';
  constructor(message = 'Conflito no tipo de emolumento') {
    super(message);
    this.name = 'FeeTypeConflictError';
    Object.setPrototypeOf(this, FeeTypeConflictError.prototype);
  }
}

interface FeeTypeRow {
  id: string;
  institution_id: string;
  canonical_key: string | null;
  source: 'nexus_base' | 'institution_custom';
  display_name: string;
  code_prefix: string;
  status: 'active' | 'inactive';
  created_at: string | Date;
  updated_at: string | Date;
}

function view(r: FeeTypeRow): FeeType {
  const createdAt = r.created_at instanceof Date ? r.created_at.toISOString() : new Date(String(r.created_at)).toISOString();
  const updatedAt = r.updated_at instanceof Date ? r.updated_at.toISOString() : new Date(String(r.updated_at)).toISOString();
  return {
    id: String(r.id),
    institutionId: String(r.institution_id),
    canonicalKey: r.canonical_key ? String(r.canonical_key) : null,
    source: r.source,
    displayName: String(r.display_name),
    codePrefix: String(r.code_prefix),
    status: r.status as FeeTypeStatus,
    createdAt,
    updatedAt,
  };
}

export class PostgresFeeTypeRepository {
  constructor(private readonly pool: Pool) {}

  async ensureBaselineTypes(institutionId: string, client?: PoolClient): Promise<void> {
    const runner = client || this.pool;
    for (const b of NEXUS_BASELINE_FEE_TYPES) {
      await runner.query(
        `INSERT INTO finance_fee_types (institution_id, canonical_key, source, display_name, code_prefix, status)
         VALUES ($1, $2, 'nexus_base', $3, $4, 'active')
         ON CONFLICT (institution_id, code_prefix) DO NOTHING`,
        [institutionId, b.canonicalKey, b.displayName, b.codePrefix],
      );
    }
  }

  async list(actor: FeeTypeActor, status: FeeTypeStatus | 'all' = 'all'): Promise<FeeType[]> {
    await this.ensureBaselineTypes(actor.institutionId);
    const r = await this.pool.query<FeeTypeRow>(
      `SELECT id, institution_id, canonical_key, source, display_name, code_prefix, status, created_at, updated_at
       FROM finance_fee_types
       WHERE institution_id = $1 ${status === 'all' ? '' : 'AND status = $2'}
       ORDER BY display_name ASC`,
      status === 'all' ? [actor.institutionId] : [actor.institutionId, status],
    );
    return r.rows.map(view);
  }

  async getById(actor: FeeTypeActor, id: string): Promise<FeeType> {
    const r = await this.pool.query<FeeTypeRow>(
      `SELECT id, institution_id, canonical_key, source, display_name, code_prefix, status, created_at, updated_at
       FROM finance_fee_types
       WHERE institution_id = $1 AND id = $2`,
      [actor.institutionId, id],
    );
    if (!r.rows[0]) throw new FeeTypeNotFoundError();
    return view(r.rows[0]);
  }

  async create(
    actor: FeeTypeActor,
    input: CreateFeeTypeInput,
    key: string,
  ): Promise<{ replayed: boolean; result: FeeType }> {
    const x = normalizeFeeTypeCreate(input);
    await this.ensureBaselineTypes(actor.institutionId);

    return executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: {
        institutionId: actor.institutionId,
        operationNamespace: 'finance.fee_type.create',
        idempotencyKey: key,
        canonicalFingerprint: createCanonicalFinanceFingerprint(x),
      },
      execute: async (c) => {
        const existing = await c.query(
          `SELECT id FROM finance_fee_types WHERE institution_id = $1 AND code_prefix = $2`,
          [actor.institutionId, x.codePrefix],
        );
        if (existing.rowCount && existing.rowCount > 0) {
          throw new FeeTypeConflictError(`Já existe um tipo de emolumento com o prefixo ${x.codePrefix}.`);
        }

        const id = randomUUID();
        await c.query(
          `INSERT INTO finance_fee_types (id, institution_id, canonical_key, source, display_name, code_prefix, status)
           VALUES ($1, $2, NULL, 'institution_custom', $3, $4, 'active')`,
          [id, actor.institutionId, x.displayName, x.codePrefix],
        );

        await c.query(
          `INSERT INTO finance_audit_records(institution_id, event_type, metadata)
           VALUES($1, 'fee_type.created', jsonb_build_object('actor_person_id', $2::text, 'fee_type_id', $3::text, 'prefix', $4::text))`,
          [actor.institutionId, actor.personId, id, x.codePrefix],
        );

        const r = await c.query<FeeTypeRow>(
          `SELECT id, institution_id, canonical_key, source, display_name, code_prefix, status, created_at, updated_at
           FROM finance_fee_types WHERE institution_id = $1 AND id = $2`,
          [actor.institutionId, id],
        );
        return { resultRef: id, result: view(r.rows[0]) };
      },
      loadResult: (_, id) => this.getById(actor, id),
    });
  }

  async update(
    actor: FeeTypeActor,
    id: string,
    input: UpdateFeeTypeInput,
    key: string,
  ): Promise<{ replayed: boolean; result: FeeType }> {
    const x = normalizeFeeTypeUpdate(input);

    return executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: {
        institutionId: actor.institutionId,
        operationNamespace: 'finance.fee_type.update',
        idempotencyKey: key,
        canonicalFingerprint: createCanonicalFinanceFingerprint({ id, ...x }),
      },
      execute: async (c) => {
        const current = await c.query<FeeTypeRow>(
          `SELECT id, source, code_prefix FROM finance_fee_types WHERE institution_id = $1 AND id = $2`,
          [actor.institutionId, id],
        );
        if (!current.rows[0]) throw new FeeTypeNotFoundError();

        if (x.codePrefix && x.codePrefix !== current.rows[0].code_prefix) {
          // P1-02: Application-layer defence — check prefix namespace before DB trigger fires.
          // Rule 1: prefix is immutable after any catalogue codes have been generated.
          const counters = await c.query<{ last_sequence: number }>(
            `SELECT last_sequence FROM finance_fee_code_counters WHERE institution_id = $1 AND fee_type_id = $2`,
            [actor.institutionId, id],
          );
          if (counters.rows[0] && counters.rows[0].last_sequence > 0) {
            throw new FeeTypeConflictError(
              `O prefixo do tipo de emolumento não pode ser alterado após códigos terem sido gerados (${counters.rows[0].last_sequence} código(s) existente(s)).`,
            );
          }
          // Rule 2: reject if the new prefix was historically used by any other fee type.
          const historyConflict = await c.query(
            `SELECT fee_type_id FROM finance_fee_type_prefix_history
             WHERE institution_id = $1 AND code_prefix = $2 AND fee_type_id <> $3
             LIMIT 1`,
            [actor.institutionId, x.codePrefix, id],
          );
          if (historyConflict.rowCount && historyConflict.rowCount > 0) {
            throw new FeeTypeConflictError(
              `O prefixo '${x.codePrefix}' já foi utilizado por outro tipo de emolumento nesta instituição e não pode ser reutilizado.`,
            );
          }
          // Rule 0: check current active duplicates
          const conflict = await c.query(
            `SELECT id FROM finance_fee_types WHERE institution_id = $1 AND code_prefix = $2 AND id <> $3`,
            [actor.institutionId, x.codePrefix, id],
          );
          if (conflict.rowCount && conflict.rowCount > 0) {
            throw new FeeTypeConflictError(`Já existe um tipo de emolumento com o prefixo ${x.codePrefix}.`);
          }
          await c.query(
            `UPDATE finance_fee_types SET display_name = $1, code_prefix = $2, updated_at = now() WHERE institution_id = $3 AND id = $4`,
            [x.displayName, x.codePrefix, actor.institutionId, id],
          );
        } else {
          await c.query(
            `UPDATE finance_fee_types SET display_name = $1, updated_at = now() WHERE institution_id = $2 AND id = $3`,
            [x.displayName, actor.institutionId, id],
          );
        }

        await c.query(
          `INSERT INTO finance_audit_records(institution_id, event_type, metadata)
           VALUES($1, 'fee_type.updated', jsonb_build_object('actor_person_id', $2::text, 'fee_type_id', $3::text))`,
          [actor.institutionId, actor.personId, id],
        );

        const r = await c.query<FeeTypeRow>(
          `SELECT id, institution_id, canonical_key, source, display_name, code_prefix, status, created_at, updated_at
           FROM finance_fee_types WHERE institution_id = $1 AND id = $2`,
          [actor.institutionId, id],
        );
        return { resultRef: id, result: view(r.rows[0]) };
      },
      loadResult: (_, ref) => this.getById(actor, ref),
    });
  }

  async setStatus(
    actor: FeeTypeActor,
    id: string,
    status: FeeTypeStatus,
    key: string,
  ): Promise<{ replayed: boolean; result: FeeType }> {
    return executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: {
        institutionId: actor.institutionId,
        operationNamespace: `finance.fee_type.${status}`,
        idempotencyKey: key,
        canonicalFingerprint: createCanonicalFinanceFingerprint({ id, status }),
      },
      execute: async (c) => {
        const r = await c.query(
          `UPDATE finance_fee_types SET status = $1, updated_at = now() WHERE institution_id = $2 AND id = $3`,
          [status, actor.institutionId, id],
        );
        if (!r.rowCount) throw new FeeTypeNotFoundError();

        await c.query(
          `INSERT INTO finance_audit_records(institution_id, event_type, metadata)
           VALUES($1, $2, jsonb_build_object('actor_person_id', $3::text, 'fee_type_id', $4::text))`,
          [actor.institutionId, `fee_type.${status}`, actor.personId, id],
        );

        const r2 = await c.query<FeeTypeRow>(
          `SELECT id, institution_id, canonical_key, source, display_name, code_prefix, status, created_at, updated_at
           FROM finance_fee_types WHERE institution_id = $1 AND id = $2`,
          [actor.institutionId, id],
        );
        return { resultRef: id, result: view(r2.rows[0]) };
      },
      loadResult: (_, ref) => this.getById(actor, ref),
    });
  }
}