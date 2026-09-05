import type { Pool, PoolClient } from 'pg';
import {
  FinancialAccount,
  FinancialAccountParty,
  FinancialAccountStatus,
  FinancialAccountValidationError,
  normalizeCreateFinancialAccount,
  normalizeUpdateFinancialAccount,
} from './financial-account-model.ts';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { executeIdempotentFinanceCommand, createCanonicalFinanceFingerprint } from './finance-command.ts';

export class FinancialAccountNotFoundError extends Error {
  readonly code = 'FINANCIAL_ACCOUNT_NOT_FOUND';
  constructor(message = 'Conta financeira não encontrada.') {
    super(message);
    this.name = 'FinancialAccountNotFoundError';
  }
}

export class FinancialAccountConflictError extends Error {
  readonly code = 'FINANCIAL_ACCOUNT_CONFLICT';
  constructor(message = 'Conflito de conta financeira.') {
    super(message);
    this.name = 'FinancialAccountConflictError';
  }
}

interface AccountRow {
  id: string;
  institution_id: string;
  account_number: string;
  name: string;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
  party_id?: string | null;
  person_id?: string | null;
  person_name?: string | null;
  party_role?: string | null;
  party_status?: string | null;
}

function mapAccount(r: AccountRow): FinancialAccount {
  const createdAt = r.created_at instanceof Date ? r.created_at.toISOString() : new Date(String(r.created_at)).toISOString();
  const updatedAt = r.updated_at instanceof Date ? r.updated_at.toISOString() : new Date(String(r.updated_at)).toISOString();

  let primaryParty: FinancialAccountParty | undefined = undefined;
  if (r.party_id && r.person_id) {
    primaryParty = {
      id: String(r.party_id),
      financialAccountId: String(r.id),
      personId: String(r.person_id),
      personName: r.person_name ? String(r.person_name) : undefined,
      role: (r.party_role || 'primary_debtor') as any,
      status: (r.party_status || 'active') as any,
    };
  }

  return {
    id: String(r.id),
    institutionId: String(r.institution_id),
    accountNumber: String(r.account_number),
    name: String(r.name),
    status: r.status as FinancialAccountStatus,
    primaryParty,
    createdAt,
    updatedAt,
  };
}

export class PostgresFinancialAccountRepository {
  constructor(private readonly pool: Pool) {}

  async list(actor: InstitutionalContext, status: FinancialAccountStatus | 'all' = 'all'): Promise<FinancialAccount[]> {
    const statusClause = status === 'all' ? '' : 'AND a.status = $2';
    const params = status === 'all' ? [actor.institutionId] : [actor.institutionId, status];

    const sql = `
      SELECT 
        a.id,
        a.institution_id,
        a.account_number,
        a.name,
        a.status,
        a.created_at,
        a.updated_at,
        p.id AS party_id,
        p.person_id,
        pe.name AS person_name,
        p.role AS party_role,
        p.status AS party_status
      FROM finance_financial_accounts a
      LEFT JOIN finance_financial_account_parties p 
        ON p.financial_account_id = a.id AND p.role = 'primary_debtor' AND p.status = 'active'
      LEFT JOIN people pe 
        ON pe.id = p.person_id
      WHERE a.institution_id = $1 ${statusClause}
      ORDER BY a.account_number ASC
    `;

    const res = await this.pool.query<AccountRow>(sql, params);
    return res.rows.map(mapAccount);
  }

  async getById(actor: InstitutionalContext, id: string, client: Pool | PoolClient = this.pool): Promise<FinancialAccount> {
    const sql = `
      SELECT 
        a.id,
        a.institution_id,
        a.account_number,
        a.name,
        a.status,
        a.created_at,
        a.updated_at,
        p.id AS party_id,
        p.person_id,
        pe.name AS person_name,
        p.role AS party_role,
        p.status AS party_status
      FROM finance_financial_accounts a
      LEFT JOIN finance_financial_account_parties p 
        ON p.financial_account_id = a.id AND p.role = 'primary_debtor'
      LEFT JOIN people pe 
        ON pe.id = p.person_id
      WHERE a.institution_id = $1 AND a.id = $2
    `;

    const res = await client.query<AccountRow>(sql, [actor.institutionId, id]);
    if (!res.rows[0]) {
      throw new FinancialAccountNotFoundError();
    }

    const account = mapAccount(res.rows[0]);

    // Load all parties
    const partiesRes = await client.query<{
      id: string;
      financial_account_id: string;
      person_id: string;
      person_name: string | null;
      role: string;
      status: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT p.id, p.financial_account_id, p.person_id, pe.name AS person_name, p.role, p.status, p.created_at, p.updated_at
       FROM finance_financial_account_parties p
       LEFT JOIN people pe ON pe.id = p.person_id
       WHERE p.institution_id = $1 AND p.financial_account_id = $2
       ORDER BY p.created_at ASC`,
      [actor.institutionId, id],
    );

    account.parties = partiesRes.rows.map((r) => ({
      id: String(r.id),
      financialAccountId: String(r.financial_account_id),
      personId: String(r.person_id),
      personName: r.person_name ? String(r.person_name) : undefined,
      role: r.role as any,
      status: r.status as any,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : new Date(String(r.created_at)).toISOString(),
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : new Date(String(r.updated_at)).toISOString(),
    }));

    return account;
  }

  async create(actor: InstitutionalContext, rawInput: unknown, idempotencyKey: string): Promise<FinancialAccount> {
    const input = normalizeCreateFinancialAccount(rawInput);

    const result = await executeIdempotentFinanceCommand<FinancialAccount>({
      pool: this.pool,
      identity: {
        institutionId: actor.institutionId,
        operationNamespace: 'finance.account.create',
        idempotencyKey,
        canonicalFingerprint: createCanonicalFinanceFingerprint({
          primaryPersonId: input.primaryPersonId,
          ...(input.name ? { name: input.name } : {}),
        }),
      },
      execute: async (client) => {
        // Verify person exists and has institutional eligibility in active institution
        const personRes = await client.query<{ id: string; name: string }>(
          `SELECT p.id, p.name FROM people p
           WHERE p.id = $2
             AND (
               EXISTS (SELECT 1 FROM memberships m WHERE m.institution_id = $1 AND m.person_id = p.id)
               OR EXISTS (SELECT 1 FROM enrollment_applications ea WHERE ea.institution_id = $1 AND (ea.student_person_id = p.id OR ea.guardian_person_id = p.id))
             )`,
          [actor.institutionId, input.primaryPersonId],
        );
        if (!personRes.rows[0]) {
          throw new FinancialAccountValidationError('Pessoa responsável não encontrada ou não pertence à instituição ativa.');
        }

        const personName = personRes.rows[0].name || 'Titular';
        const accountName = input.name || `Conta de ${personName}`;

        // Increment sequence atomically
        const counterRes = await client.query<{ last_sequence: number }>(
          `INSERT INTO finance_financial_account_counters (institution_id, last_sequence, updated_at)
           VALUES ($1, 1, NOW())
           ON CONFLICT (institution_id)
           DO UPDATE SET last_sequence = finance_financial_account_counters.last_sequence + 1, updated_at = NOW()
           RETURNING last_sequence`,
          [actor.institutionId],
        );
        const seq = counterRes.rows[0].last_sequence;
        const accountNumber = `CTA-${String(seq).padStart(6, '0')}`;

        // Insert account
        const accountRes = await client.query<AccountRow>(
          `INSERT INTO finance_financial_accounts (institution_id, account_number, name, status)
           VALUES ($1, $2, $3, 'active')
           RETURNING id, institution_id, account_number, name, status, created_at, updated_at`,
          [actor.institutionId, accountNumber, accountName],
        );
        const acc = accountRes.rows[0];

        // Insert primary responsible party
        await client.query(
          `INSERT INTO finance_financial_account_parties (institution_id, financial_account_id, person_id, role, status)
           VALUES ($1, $2, $3, 'primary_debtor', 'active')`,
          [actor.institutionId, acc.id, input.primaryPersonId],
        );

        const createdAccount = await this.getById(actor, acc.id, client);
        return { resultRef: acc.id, result: createdAccount };
      },
      loadResult: (_, resultRef) => this.getById(actor, resultRef),
    });

    return result.result;
  }

  async update(actor: InstitutionalContext, id: string, rawInput: unknown): Promise<FinancialAccount> {
    const input = normalizeUpdateFinancialAccount(rawInput);
    if (!input.name) {
      return this.getById(actor, id);
    }

    const res = await this.pool.query<AccountRow>(
      `UPDATE finance_financial_accounts 
       SET name = $3, updated_at = NOW() 
       WHERE institution_id = $1 AND id = $2 
       RETURNING id, institution_id, account_number, name, status, created_at, updated_at`,
      [actor.institutionId, id, input.name],
    );
    if (!res.rows[0]) {
      throw new FinancialAccountNotFoundError();
    }
    return this.getById(actor, id);
  }

  async setStatus(actor: InstitutionalContext, id: string, status: FinancialAccountStatus): Promise<FinancialAccount> {
    const res = await this.pool.query<AccountRow>(
      `UPDATE finance_financial_accounts 
       SET status = $3, updated_at = NOW() 
       WHERE institution_id = $1 AND id = $2 
       RETURNING id, institution_id, account_number, name, status, created_at, updated_at`,
      [actor.institutionId, id, status],
    );
    if (!res.rows[0]) {
      throw new FinancialAccountNotFoundError();
    }
    return this.getById(actor, id);
  }
}
