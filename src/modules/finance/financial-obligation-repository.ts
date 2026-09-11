import type { Pool, PoolClient } from 'pg';
import { Money } from './money.ts';
import {
  FinancialObligation,
  FinancialObligationStatus,
  FinancialObligationValidationError,
  normalizeIssueObligationInput,
} from './financial-obligation-model.ts';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { FinancialProfileStore, requireFinancialContext } from './financial-context.ts';
import { executeIdempotentFinanceCommand, createCanonicalFinanceFingerprint } from './finance-command.ts';

export class FinancialObligationNotFoundError extends Error {
  readonly code = 'FINANCIAL_OBLIGATION_NOT_FOUND';
  constructor(message = 'Obrigação financeira não encontrada.') {
    super(message);
    this.name = 'FinancialObligationNotFoundError';
  }
}

export class FinancialObligationConflictError extends Error {
  readonly code = 'FINANCIAL_OBLIGATION_CONFLICT';
  constructor(message = 'Conflito de obrigação financeira.') {
    super(message);
    this.name = 'FinancialObligationConflictError';
  }
}

interface ObligationRow {
  id: string;
  institution_id: string;
  financial_account_id: string;
  account_number?: string;
  account_name?: string;
  beneficiary_person_id?: string | null;
  beneficiary_name?: string | null;
  fee_catalogue_item_id: string;
  fee_catalogue_version: number;
  fee_item_code?: string;
  fee_item_name?: string;
  source_type: string;
  source_ref: string;
  amount: string | number;
  currency: string;
  effective_at: string | Date;
  due_at?: string | Date | null;
  status: string;
  notes?: string | null;
  financial_profile_version: number;
  created_by_person_id: string;
  idempotency_key: string;
  created_at: string | Date;
  updated_at: string | Date;
}

function mapObligation(row: ObligationRow): FinancialObligation {
  return {
    id: String(row.id),
    institutionId: String(row.institution_id),
    financialAccountId: String(row.financial_account_id),
    accountNumber: row.account_number ? String(row.account_number) : undefined,
    accountName: row.account_name ? String(row.account_name) : undefined,
    beneficiaryPersonId: row.beneficiary_person_id ? String(row.beneficiary_person_id) : null,
    beneficiaryName: row.beneficiary_name ? String(row.beneficiary_name) : null,
    feeCatalogueItemId: String(row.fee_catalogue_item_id),
    feeCatalogueVersion: Number(row.fee_catalogue_version),
    feeItemCode: row.fee_item_code ? String(row.fee_item_code) : undefined,
    feeItemName: row.fee_item_name ? String(row.fee_item_name) : undefined,
    sourceType: row.source_type as any,
    sourceRef: String(row.source_ref),
    money: {
      amount: Money.parse(String(row.amount), String(row.currency)).canonicalAmount(),
      currency: String(row.currency),
    },
    effectiveAt: row.effective_at instanceof Date ? row.effective_at.toISOString() : new Date(String(row.effective_at)).toISOString(),
    dueAt: row.due_at ? (row.due_at instanceof Date ? row.due_at.toISOString() : new Date(String(row.due_at)).toISOString()) : null,
    status: row.status as FinancialObligationStatus,
    notes: row.notes ? String(row.notes) : null,
    financialProfileVersion: Number(row.financial_profile_version),
    createdByPersonId: String(row.created_by_person_id),
    idempotencyKey: String(row.idempotency_key),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(String(row.created_at)).toISOString(),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(String(row.updated_at)).toISOString(),
  };
}

export class PostgresFinancialObligationRepository {
  constructor(
    private readonly pool: Pool,
    private readonly profiles: FinancialProfileStore,
  ) {}

  async list(
    actor: InstitutionalContext,
    options?: { status?: string; financialAccountId?: string },
  ): Promise<FinancialObligation[]> {
    const conditions: string[] = ['o.institution_id = $1'];
    const params: any[] = [actor.institutionId];

    if (options?.status && options.status !== 'all') {
      params.push(options.status);
      conditions.push(`o.status = $${params.length}`);
    }

    if (options?.financialAccountId) {
      params.push(options.financialAccountId);
      conditions.push(`o.financial_account_id = $${params.length}`);
    }

    const sql = `
      SELECT
        o.id,
        o.institution_id,
        o.financial_account_id,
        a.account_number,
        a.name AS account_name,
        o.beneficiary_person_id,
        p.name AS beneficiary_name,
        o.fee_catalogue_item_id,
        o.fee_catalogue_version,
        fci.code AS fee_item_code,
        fcv.name AS fee_item_name,
        o.source_type,
        o.source_ref,
        o.amount,
        o.currency,
        o.effective_at,
        o.due_at,
        o.status,
        o.notes,
        o.financial_profile_version,
        o.created_by_person_id,
        o.idempotency_key,
        o.created_at,
        o.updated_at
      FROM finance_obligations o
      JOIN finance_financial_accounts a ON (a.institution_id = o.institution_id AND a.id = o.financial_account_id)
      LEFT JOIN people p ON p.id = o.beneficiary_person_id
      JOIN finance_fee_catalogue_items fci ON (fci.institution_id = o.institution_id AND fci.id = o.fee_catalogue_item_id)
      JOIN finance_fee_catalogue_versions fcv
        ON (fcv.institution_id = o.institution_id AND fcv.item_id = o.fee_catalogue_item_id AND fcv.version = o.fee_catalogue_version)
      WHERE ${conditions.join(' AND ')}
      ORDER BY o.effective_at DESC, o.created_at DESC
    `;

    const res = await this.pool.query<ObligationRow>(sql, params);
    return res.rows.map(mapObligation);
  }

  async getById(actor: InstitutionalContext, id: string, client: Pool | PoolClient = this.pool): Promise<FinancialObligation> {
    const sql = `
      SELECT
        o.id,
        o.institution_id,
        o.financial_account_id,
        a.account_number,
        a.name AS account_name,
        o.beneficiary_person_id,
        p.name AS beneficiary_name,
        o.fee_catalogue_item_id,
        o.fee_catalogue_version,
        fci.code AS fee_item_code,
        fcv.name AS fee_item_name,
        o.source_type,
        o.source_ref,
        o.amount,
        o.currency,
        o.effective_at,
        o.due_at,
        o.status,
        o.notes,
        o.financial_profile_version,
        o.created_by_person_id,
        o.idempotency_key,
        o.created_at,
        o.updated_at
      FROM finance_obligations o
      JOIN finance_financial_accounts a ON (a.institution_id = o.institution_id AND a.id = o.financial_account_id)
      LEFT JOIN people p ON p.id = o.beneficiary_person_id
      JOIN finance_fee_catalogue_items fci ON (fci.institution_id = o.institution_id AND fci.id = o.fee_catalogue_item_id)
      JOIN finance_fee_catalogue_versions fcv
        ON (fcv.institution_id = o.institution_id AND fcv.item_id = o.fee_catalogue_item_id AND fcv.version = o.fee_catalogue_version)
      WHERE o.institution_id = $1 AND o.id = $2
    `;

    const res = await client.query<ObligationRow>(sql, [actor.institutionId, id]);
    if (!res.rows[0]) {
      throw new FinancialObligationNotFoundError();
    }
    return mapObligation(res.rows[0]);
  }

  async issue(actor: InstitutionalContext, rawInput: unknown, idempotencyKey: string): Promise<FinancialObligation> {
    const input = normalizeIssueObligationInput(rawInput);

    const result = await executeIdempotentFinanceCommand<FinancialObligation>({
      pool: this.pool,
      identity: {
        institutionId: actor.institutionId,
        operationNamespace: 'finance.obligation.issue',
        idempotencyKey,
        canonicalFingerprint: createCanonicalFinanceFingerprint(input),
      },
      execute: async (client) => {
        // Verify Financial Account exists in this institution and is active
        const accountRes = await client.query<{ id: string; status: string }>(
          `SELECT id, status FROM finance_financial_accounts WHERE institution_id = $1 AND id = $2`,
          [actor.institutionId, input.financialAccountId],
        );
        if (!accountRes.rows[0]) {
          throw new FinancialObligationValidationError('Conta financeira não encontrada.');
        }
        if (accountRes.rows[0].status !== 'active') {
          throw new FinancialObligationValidationError('A conta financeira selecionada está inativa.');
        }

        // Verify beneficiary institutional eligibility in this institution
        if (input.beneficiaryPersonId) {
          const beneficiaryRes = await client.query(
            `SELECT p.id FROM people p
             WHERE p.id = $2
               AND (
                 EXISTS (SELECT 1 FROM memberships m WHERE m.institution_id = $1 AND m.person_id = p.id)
                 OR EXISTS (SELECT 1 FROM enrollment_applications ea WHERE ea.institution_id = $1 AND (ea.student_person_id = p.id OR ea.guardian_person_id = p.id))
               )`,
            [actor.institutionId, input.beneficiaryPersonId],
          );
          if (!beneficiaryRes.rows[0]) {
            throw new FinancialObligationValidationError('Pessoa beneficiária não encontrada ou não pertence à instituição ativa.');
          }
        }

        // Resolve active Fee Catalogue Item and its current version snapshot
        const feeItemRes = await client.query<{
          id: string;
          status: string;
          current_version: number;
          amount: string;
          currency: string;
        }>(
          `SELECT i.id, i.status, i.current_version, v.amount::text AS amount, v.currency
           FROM finance_fee_catalogue_items i
           JOIN finance_fee_catalogue_versions v
             ON (v.institution_id = i.institution_id AND v.item_id = i.id AND v.version = i.current_version)
           WHERE i.institution_id = $1 AND i.id = $2`,
          [actor.institutionId, input.feeCatalogueItemId],
        );
        if (!feeItemRes.rows[0]) {
          throw new FinancialObligationValidationError('Item do catálogo de emolumentos não encontrado.');
        }
        if (feeItemRes.rows[0].status !== 'active') {
          throw new FinancialObligationValidationError('O item do catálogo de emolumentos selecionado está inativo.');
        }

        const feeItem = feeItemRes.rows[0];
        const snapshotAmount = String(feeItem.amount);
        const snapshotCurrency = String(feeItem.currency);
        const snapshotVersion = Number(feeItem.current_version);

        // Resolve effective Financial Profile strictly (fails closed if missing or ineffective)
        const profile = await requireFinancialContext({
          institutionalContext: actor,
          effectiveAt: new Date(),
          store: this.profiles,
          requiredCurrency: snapshotCurrency,
        });

        // Insert obligation
        const insertRes = await client.query<{ id: string }>(
          `INSERT INTO finance_obligations (
            institution_id,
            financial_account_id,
            beneficiary_person_id,
            fee_catalogue_item_id,
            fee_catalogue_version,
            source_type,
            source_ref,
            amount,
            currency,
            effective_at,
            due_at,
            status,
            notes,
            financial_profile_version,
            created_by_person_id,
            idempotency_key
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, 'open', $11, $12, $13, $14)
          RETURNING id`,
          [
            actor.institutionId,
            input.financialAccountId,
            input.beneficiaryPersonId,
            input.feeCatalogueItemId,
            snapshotVersion,
            input.sourceType || 'manual_finance',
            input.sourceRef || 'manual',
            snapshotAmount,
            snapshotCurrency,
            input.dueAt,
            input.notes,
            profile.version,
            actor.personId,
            idempotencyKey,
          ],
        );

        const createdObligation = await this.getById(actor, insertRes.rows[0].id, client);
        return { resultRef: insertRes.rows[0].id, result: createdObligation };
      },
      loadResult: (_, resultRef) => this.getById(actor, resultRef),
    });

    return result.result;
  }
}
