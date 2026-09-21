import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { executeIdempotentFinanceCommand, createCanonicalFinanceFingerprint } from './finance-command.ts';
import { requireFinancialContext, type FinancialProfileStore } from './financial-context.ts';
import {
  type CreateFeeCatalogueInput,
  type FeeCatalogueItem,
  type FeeCatalogueStatus,
  type FeeCatalogueVersion,
  type UpdateFeeCatalogueInput,
  normalizeFeeCatalogueCreate,
  normalizeFeeCatalogueUpdate,
  FeeCatalogueValidationError,
} from './fee-catalogue-model.ts';

export interface FeeCatalogueActor {
  institutionId: string;
  personId: string;
  role: string;
}

export class FeeCatalogueNotFoundError extends Error {
  readonly code = 'FEE_CATALOGUE_NOT_FOUND';
  constructor(message = 'Catalogue item not found') {
    super(message);
    this.name = 'FeeCatalogueNotFoundError';
    Object.setPrototypeOf(this, FeeCatalogueNotFoundError.prototype);
  }
}

export class FeeCatalogueConflictError extends Error {
  readonly code = 'FEE_CATALOGUE_CONFLICT';
  constructor(message = 'Catalogue conflict') {
    super(message);
    this.name = 'FeeCatalogueConflictError';
    Object.setPrototypeOf(this, FeeCatalogueConflictError.prototype);
  }
}

interface Row {
  id: string;
  institution_id: string;
  fee_type_id: string;
  fee_type_display_name?: string;
  fee_type_code_prefix?: string;
  fee_type_canonical_key?: string | null;
  code: string;
  status: string;
  current_version: number;
  created_at: string | Date;
  updated_at: string | Date;
  version_id: string;
  item_id?: string;
  version: number;
  name: string;
  description: string | null;
  kind: string;
  amount: string;
  currency: string;
  effective_from: string | Date;
  effective_to: string | Date | null;
  version_created_at: string | Date;
}

const selectCurrent = `
  SELECT
    i.id,
    i.institution_id,
    i.fee_type_id,
    ft.display_name AS fee_type_display_name,
    ft.code_prefix AS fee_type_code_prefix,
    ft.canonical_key AS fee_type_canonical_key,
    i.code,
    i.status,
    i.current_version,
    i.created_at,
    i.updated_at,
    v.id AS version_id,
    v.version,
    v.name,
    v.description,
    v.kind,
    v.amount::text AS amount,
    v.currency,
    v.effective_from,
    v.effective_to,
    v.created_at AS version_created_at
  FROM finance_fee_catalogue_items i
  JOIN finance_fee_catalogue_versions v
    ON (v.institution_id = i.institution_id AND v.item_id = i.id AND v.version = i.current_version)
  JOIN finance_fee_types ft
    ON (ft.institution_id = v.institution_id AND ft.id = v.fee_type_id)
`;

function version(row: Row): FeeCatalogueVersion {
  const effectiveFrom = row.effective_from instanceof Date ? row.effective_from.toISOString() : new Date(String(row.effective_from)).toISOString();
  const effectiveTo = row.effective_to ? (row.effective_to instanceof Date ? row.effective_to.toISOString() : new Date(String(row.effective_to)).toISOString()) : null;
  const createdAt = row.version_created_at instanceof Date ? row.version_created_at.toISOString() : new Date(String(row.version_created_at)).toISOString();

  return {
    id: String(row.version_id),
    itemId: String(row.item_id || row.id),
    institutionId: String(row.institution_id),
    feeTypeId: String(row.fee_type_id),
    feeType: row.fee_type_display_name
      ? {
        id: String(row.fee_type_id),
        displayName: String(row.fee_type_display_name),
        codePrefix: String(row.fee_type_code_prefix),
        canonicalKey: row.fee_type_canonical_key ? String(row.fee_type_canonical_key) : null,
      }
      : undefined,
    version: Number(row.version),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    // P1-03: kind is compatibility-only derived data from fee_type_id.
    // Classification authority is fee_type_canonical_key / fee_type_code_prefix from fee_types.
    // The raw row.kind is the stored derived value (set from fee type at write time) — it is
    // used here only as a fallback for history rows where fee_type columns are not joined.
    // It CANNOT diverge from the fee type authority by design (set at write-time from fee type).
    // Removal boundary: Phase 2, once all history consumers use fee_type_id directly.
    kind: String(row.fee_type_canonical_key || row.fee_type_code_prefix || row.kind),
    money: { amount: String(row.amount), currency: String(row.currency) },
    effectiveFrom,
    effectiveTo,
    createdAt,
  };
}

function view(row: Row): FeeCatalogueItem {
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : new Date(String(row.created_at)).toISOString();
  const updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(String(row.updated_at)).toISOString();

  return {
    id: String(row.id),
    institutionId: String(row.institution_id),
    feeTypeId: String(row.fee_type_id),
    feeType: row.fee_type_display_name
      ? {
        id: String(row.fee_type_id),
        displayName: String(row.fee_type_display_name),
        codePrefix: String(row.fee_type_code_prefix),
        canonicalKey: row.fee_type_canonical_key ? String(row.fee_type_canonical_key) : null,
      }
      : undefined,
    code: String(row.code),
    status: row.status as FeeCatalogueStatus,
    currentVersion: Number(row.current_version),
    createdAt,
    updatedAt,


    current: version(row),
  };
}

export class PostgresFeeCatalogueRepository {
  constructor(private readonly pool: Pool, private readonly profiles: FinancialProfileStore) { }

  async list(actor: FeeCatalogueActor, status: FeeCatalogueStatus | 'all' = 'all'): Promise<FeeCatalogueItem[]> {
    const r = await this.pool.query<Row>(
      `${selectCurrent} WHERE i.institution_id=$1 ${status === 'all' ? '' : 'AND i.status=$2'} ORDER BY i.code`,
      status === 'all' ? [actor.institutionId] : [actor.institutionId, status],
    );
    return r.rows.map(view);
  }

  async get(actor: FeeCatalogueActor, id: string, history = false): Promise<FeeCatalogueItem> {
    const r = await this.pool.query<Row>(`${selectCurrent} WHERE i.institution_id=$1 AND i.id=$2`, [actor.institutionId, id]);
    if (!r.rows[0]) throw new FeeCatalogueNotFoundError('Catalogue item not found');
    const item = view(r.rows[0]);
    if (history) {
      const h = await this.pool.query<Row>(
        `SELECT
           v.id AS version_id,
           v.item_id,
           v.institution_id,
           v.fee_type_id,
           ft.display_name AS fee_type_display_name,
           ft.code_prefix AS fee_type_code_prefix,
           ft.canonical_key AS fee_type_canonical_key,
           v.version,
           v.name,
           v.description,
           v.kind,
           v.amount::text AS amount,
           v.currency,
           v.effective_from,
           v.effective_to,
           v.created_at AS version_created_at
         FROM finance_fee_catalogue_versions v
         JOIN finance_fee_types ft
           ON (ft.institution_id = v.institution_id AND ft.id = v.fee_type_id)
         WHERE v.institution_id=$1 AND v.item_id=$2
         ORDER BY v.version DESC`,
        [actor.institutionId, id],
      );
      item.history = h.rows.map((row) => version({ ...row, item_id: id, institution_id: actor.institutionId }));
    }
    return item;
  }

  async create(actor: FeeCatalogueActor, input: CreateFeeCatalogueInput, key: string): Promise<{ replayed: boolean; result: FeeCatalogueItem }> {
    const x = normalizeFeeCatalogueCreate(input);
    await requireFinancialContext({
      institutionalContext: actor,
      effectiveAt: new Date(x.effectiveFrom),
      store: this.profiles,
      requiredCurrency: x.currency,
    });

    return executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: {
        institutionId: actor.institutionId,
        operationNamespace: 'finance.fee_catalogue.create',
        idempotencyKey: key,
        canonicalFingerprint: createCanonicalFinanceFingerprint(x),
      },
      execute: async (c) => {
        // Validate Fee Type
        const feeTypeRes = await c.query<{ id: string; code_prefix: string; status: string; canonical_key: string | null }>(
          `SELECT id, code_prefix, status, canonical_key FROM finance_fee_types WHERE institution_id = $1 AND id = $2`,
          [actor.institutionId, x.feeTypeId],
        );
        if (!feeTypeRes.rows[0]) {
          throw new FeeCatalogueValidationError('Tipo de emolumento não encontrado.');
        }
        if (feeTypeRes.rows[0].status !== 'active') {
          throw new FeeCatalogueValidationError('Não é possível criar um emolumento com um tipo inativo.');
        }

        const feeType = feeTypeRes.rows[0];

        // Concurrently safe atomic code generation
        const counterRes = await c.query<{ last_sequence: number }>(
          `INSERT INTO finance_fee_code_counters (institution_id, fee_type_id, last_sequence)
           VALUES ($1, $2, 1)
           ON CONFLICT (institution_id, fee_type_id)
           DO UPDATE SET last_sequence = finance_fee_code_counters.last_sequence + 1
           RETURNING last_sequence`,
          [actor.institutionId, x.feeTypeId],
        );
        const sequence = counterRes.rows[0].last_sequence;
        const generatedCode = `${feeType.code_prefix}-${String(sequence).padStart(6, '0')}`;

        const id = randomUUID();
        const kind = feeType.canonical_key || feeType.code_prefix;

        await c.query(
          `INSERT INTO finance_fee_catalogue_items(id, institution_id, fee_type_id, code, status, current_version, created_by_person_id)
           VALUES($1, $2, $3, $4, 'active', 1, $5)`,
          [id, actor.institutionId, x.feeTypeId, generatedCode, actor.personId],
        );
        await c.query(
          `INSERT INTO finance_fee_catalogue_versions(institution_id, item_id, fee_type_id, version, name, description, kind, amount, currency, effective_from, created_by_person_id)
           VALUES($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10)`,
          [actor.institutionId, id, x.feeTypeId, x.name, x.description, kind, x.amount, x.currency, x.effectiveFrom, actor.personId],
        );
        await audit(c, actor, 'fee_catalogue.created', id);
        return { resultRef: id, result: await getIn(c, actor, id) };
      },
      loadResult: (_, id) => this.get(actor, id),
    });
  }

  async update(actor: FeeCatalogueActor, id: string, input: UpdateFeeCatalogueInput, key: string): Promise<{ replayed: boolean; result: FeeCatalogueItem }> {
    const x = normalizeFeeCatalogueUpdate(input);
    await requireFinancialContext({
      institutionalContext: actor,
      effectiveAt: new Date(x.effectiveFrom),
      store: this.profiles,
      requiredCurrency: x.currency,
    });

    return executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: {
        institutionId: actor.institutionId,
        operationNamespace: 'finance.fee_catalogue.update',
        idempotencyKey: key,
        canonicalFingerprint: createCanonicalFinanceFingerprint({ id, ...x }),
      },
      execute: async (c) => {
        const locked = await c.query<Row>(
          `SELECT i.current_version, i.fee_type_id, v.effective_from
           FROM finance_fee_catalogue_items i
           JOIN finance_fee_catalogue_versions v
             ON (v.institution_id = i.institution_id AND v.item_id = i.id AND v.version = i.current_version)
           WHERE i.institution_id = $1 AND i.id = $2
           FOR UPDATE OF i, v`,
          [actor.institutionId, id],
        );
        if (!locked.rows[0]) throw new FeeCatalogueNotFoundError('Catalogue item not found');
        if (Number(locked.rows[0].current_version) !== x.expectedVersion) throw new FeeCatalogueConflictError('Catalogue version is stale');

        const rawEffectiveFrom = locked.rows[0].effective_from;
        const currentEffectiveFrom = rawEffectiveFrom instanceof Date
          ? rawEffectiveFrom.getTime()
          : typeof rawEffectiveFrom === 'string'
            ? new Date(rawEffectiveFrom).getTime()
            : new Date(String(rawEffectiveFrom)).getTime();

        const newEffectiveFrom = new Date(x.effectiveFrom).getTime();
        if (newEffectiveFrom <= currentEffectiveFrom) {
          throw new FeeCatalogueValidationError(
            'A data de início da nova versão deve ser estritamente posterior à data de início da versão atual.',
          );
        }

        const currentFeeTypeId = String(locked.rows[0].fee_type_id);
        const targetFeeTypeId = x.feeTypeId || currentFeeTypeId;
        const isTypeChange = targetFeeTypeId !== currentFeeTypeId;

        // P1-04: Fetch target fee type; check active status only when the type is being CHANGED.
        // Same-type version publishes (amount/name changes) are allowed even if the type is later inactive
        // — historical validity is preserved.
        const feeTypeRes = await c.query<{ id: string; code_prefix: string; status: string; canonical_key: string | null }>(
          `SELECT id, code_prefix, status, canonical_key FROM finance_fee_types WHERE institution_id = $1 AND id = $2`,
          [actor.institutionId, targetFeeTypeId],
        );
        if (!feeTypeRes.rows[0]) {
          throw new FeeCatalogueValidationError('Tipo de emolumento não encontrado.');
        }
        if (isTypeChange && feeTypeRes.rows[0].status !== 'active') {
          throw new FeeCatalogueValidationError(
            'Não é possível alterar o tipo de emolumento para um tipo inativo. Selecione um tipo ativo.',
          );
        }
        const feeType = feeTypeRes.rows[0];
        // P1-03: kind is compatibility-only derived data from fee_type_id — never from user input.
        const kind = feeType.canonical_key || feeType.code_prefix;

        await c.query(
          `UPDATE finance_fee_catalogue_versions SET effective_to = $1 WHERE institution_id = $2 AND item_id = $3 AND version = $4`,
          [x.effectiveFrom, actor.institutionId, id, x.expectedVersion],
        );
        await c.query(
          `INSERT INTO finance_fee_catalogue_versions(institution_id, item_id, fee_type_id, version, name, description, kind, amount, currency, effective_from, created_by_person_id)
           VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [actor.institutionId, id, targetFeeTypeId, x.expectedVersion + 1, x.name, x.description, kind, x.amount, x.currency, x.effectiveFrom, actor.personId],
        );
        await c.query(
          `UPDATE finance_fee_catalogue_items SET current_version = $1, fee_type_id = $2, updated_at = now() WHERE institution_id = $3 AND id = $4`,
          [x.expectedVersion + 1, targetFeeTypeId, actor.institutionId, id],
        );
        await audit(c, actor, 'fee_catalogue.updated', id);
        return { resultRef: id, result: await getIn(c, actor, id) };
      },
      loadResult: (_, ref) => this.get(actor, ref),
    });
  }

  async setStatus(actor: FeeCatalogueActor, id: string, status: FeeCatalogueStatus, key: string): Promise<{ replayed: boolean; result: FeeCatalogueItem }> {
    return executeIdempotentFinanceCommand({
      pool: this.pool,
      identity: {
        institutionId: actor.institutionId,
        operationNamespace: `finance.fee_catalogue.${status}`,
        idempotencyKey: key,
        canonicalFingerprint: createCanonicalFinanceFingerprint({ id, status }),
      },
      execute: async (c) => {
        const r = await c.query(
          `UPDATE finance_fee_catalogue_items SET status = $1, updated_at = now() WHERE institution_id = $2 AND id = $3`,
          [status, actor.institutionId, id],
        );
        if (!r.rowCount) throw new FeeCatalogueNotFoundError('Catalogue item not found');
        await audit(c, actor, `fee_catalogue.${status}`, id);
        return { resultRef: id, result: await getIn(c, actor, id) };
      },
      loadResult: (_, ref) => this.get(actor, ref),
    });
  }
}

async function getIn(c: PoolClient, a: FeeCatalogueActor, id: string) {
  const r = await c.query<Row>(`${selectCurrent} WHERE i.institution_id = $1 AND i.id = $2`, [a.institutionId, id]);
  if (!r.rows[0]) throw new FeeCatalogueNotFoundError('Catalogue item not found');
  return view(r.rows[0]);
}

async function audit(c: PoolClient, a: FeeCatalogueActor, event: string, id: string) {
  await c.query(
    `INSERT INTO finance_audit_records(institution_id, event_type, metadata) VALUES($1, $2, jsonb_build_object('actor_person_id', $3::text, 'catalogue_item_id', $4::text))`,
    [a.institutionId, event, a.personId, id],
  );
}
