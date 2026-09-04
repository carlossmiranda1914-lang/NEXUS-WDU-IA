import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { executeIdempotentFinanceCommand, createCanonicalFinanceFingerprint } from './finance-command.ts';
import {
  normalizeFeeCatalogueCreate,
  normalizeFeeCatalogueUpdate,
  FeeCatalogueValidationError,
  type CreateFeeCatalogueInput,
  type UpdateFeeCatalogueInput,
  type FeeCatalogueItem,
  type FeeCatalogueStatus,
  type FeeCatalogueVersion,
} from './fee-catalogue-model.ts';
import { requireFinancialContext, type FinancialProfileStore } from './financial-context.ts';

export class FeeCatalogueConflictError extends Error { readonly code = 'FEE_CATALOGUE_CONFLICT'; }
export class FeeCatalogueNotFoundError extends Error { readonly code = 'FEE_CATALOGUE_NOT_FOUND'; }
export interface FeeCatalogueActor { institutionId: string; personId: string; role: string; }
type Row = Record<string, unknown>;

const view = (r: Row): FeeCatalogueItem => ({
  id: String(r.item_id),
  institutionId: String(r.institution_id),
  code: String(r.code),
  status: r.status as FeeCatalogueStatus,
  currentVersion: Number(r.current_version),
  createdAt: new Date(r.item_created_at as Date | string).toISOString(),
  updatedAt: new Date(r.updated_at as Date | string).toISOString(),
  current: version(r),
});

const version = (r: Row): FeeCatalogueVersion => ({
  id: String(r.version_id),
  itemId: String(r.item_id),
  institutionId: String(r.institution_id),
  version: Number(r.version),
  name: String(r.name),
  description: r.description === null ? null : String(r.description),
  kind: String(r.kind),
  money: { amount: String(r.amount), currency: String(r.currency) },
  effectiveFrom: new Date(r.effective_from as Date | string).toISOString(),
  effectiveTo: r.effective_to === null ? null : new Date(r.effective_to as Date | string).toISOString(),
  createdAt: new Date(r.version_created_at as Date | string).toISOString(),
});

const selectCurrent = `SELECT i.id item_id, i.institution_id, i.code, i.status, i.current_version, i.created_at item_created_at, i.updated_at, v.id version_id, v.version, v.name, v.description, v.kind, v.amount::text amount, v.currency, v.effective_from, v.effective_to, v.created_at version_created_at FROM finance_fee_catalogue_items i JOIN finance_fee_catalogue_versions v ON (v.institution_id=i.institution_id AND v.item_id=i.id AND v.version=i.current_version)`;

export class PostgresFeeCatalogueRepository {
  constructor(private readonly pool: Pool, private readonly profiles: FinancialProfileStore) {}

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
        `SELECT v.id version_id, v.item_id, v.institution_id, v.version, v.name, v.description, v.kind, v.amount::text amount, v.currency, v.effective_from, v.effective_to, v.created_at version_created_at FROM finance_fee_catalogue_versions v WHERE v.institution_id=$1 AND v.item_id=$2 ORDER BY v.version DESC`,
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
        const id = randomUUID();
        await c.query(
          `INSERT INTO finance_fee_catalogue_items(id, institution_id, code, status, current_version, created_by_person_id) VALUES($1, $2, $3, 'active', 1, $4)`,
          [id, actor.institutionId, x.code, actor.personId],
        );
        await c.query(
          `INSERT INTO finance_fee_catalogue_versions(institution_id, item_id, version, name, description, kind, amount, currency, effective_from, created_by_person_id) VALUES($1, $2, 1, $3, $4, $5, $6, $7, $8, $9)`,
          [actor.institutionId, id, x.name, x.description, x.kind, x.amount, x.currency, x.effectiveFrom, actor.personId],
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
          `SELECT i.current_version, v.effective_from
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

        await c.query(
          `UPDATE finance_fee_catalogue_versions SET effective_to = $1 WHERE institution_id = $2 AND item_id = $3 AND version = $4`,
          [x.effectiveFrom, actor.institutionId, id, x.expectedVersion],
        );
        await c.query(
          `INSERT INTO finance_fee_catalogue_versions(institution_id, item_id, version, name, description, kind, amount, currency, effective_from, created_by_person_id) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [actor.institutionId, id, x.expectedVersion + 1, x.name, x.description, x.kind, x.amount, x.currency, x.effectiveFrom, actor.personId],
        );
        await c.query(
          `UPDATE finance_fee_catalogue_items SET current_version = $1, updated_at = now() WHERE institution_id = $2 AND id = $3`,
          [x.expectedVersion + 1, actor.institutionId, id],
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
